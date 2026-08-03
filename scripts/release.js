#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  githubUrl,
  optionValue,
  parseArgs,
  readProjectConfig,
  requireCommand,
  rootDir,
  run
} = require("./project");

const registry = "https://registry.npmjs.org";
const releaseWorkflow = "release.yml";
const expectedTargets = [
  ["darwin", "amd64"],
  ["darwin", "arm64"],
  ["linux", "amd64"],
  ["linux", "arm64"],
  ["windows", "amd64"],
  ["windows", "arm64"]
];

function main() {
  const options = parseArgs(process.argv.slice(2));
  const command = options._?.[0] || "help";
  const config = readProjectConfig();

  switch (command) {
    case "preflight":
      releasePreflight(config);
      return;
    case "changelog":
      updateChangelog(config, resolveVersion(options));
      return;
    case "sync-token":
      syncNpmToken(config);
      return;
    case "npm-auth":
      validateNpmAuth(config);
      return;
    case "tag":
      pushTag(config, resolveVersion(options));
      return;
    case "watch":
      watchWorkflow(config, resolveVersion(options));
      return;
    case "verify":
      verifyRelease(config, resolveVersion(options));
      return;
    case "ship":
      ship(config, options);
      return;
    case "help":
      printHelp();
      return;
    default:
      throw new Error(`Unknown release command ${command}. Run make help for the available targets.`);
  }
}

function ship(config, options) {
  const version = resolveVersion(options);
  validateVersion(version);
  ensureClean("starting ship");
  releasePreflight(config, { allowPackageVersionChange: true });

  updatePackageVersion(version);
  runCommand("make", ["check"], "running Go/Node checks");
  runCommand("bun", ["run", "docs:check"], "checking the Astro/ZueDocs site");
  runCommand("bun", ["run", "docs:build"], "building the Astro/ZueDocs site");
  ensureReleaseChangesOnly();

  updateChangelog(config, version);
  commitReleaseFiles(version);
  syncNpmToken(config);
  validateNpmAuth(config);
  pushTag(config, version);
  watchWorkflow(config, version);
  verifyRelease(config, version);
}

function releasePreflight(config, options = {}) {
  const tools = [
    ["git", "checking repository state"],
    ["make", "running the local check target"],
    ["go", "running Go tests and vet"],
    ["node", "reading package metadata"],
    ["npm", "validating npm authentication"],
    ["bun", "checking the docs site"],
    ["gh", "checking GitHub authentication and releases"],
    ["security", "reading the macOS npm token keychain entry"]
  ];
  for (const [command, purpose] of tools) {
    requireCommand(command, purpose);
  }

  if (!options.allowPackageVersionChange) {
    ensureClean("release preflight");
  }

  runCommand("gh", ["auth", "status", "--active", "--hostname", "github.com"], "checking GitHub authentication");
  const repo = `${config.githubOwner}/${config.githubRepo}`;
  runCapture("gh", ["repo", "view", repo, "--json", "url,visibility"], "checking the GitHub repository");

  const secretResult = runCapture(
    "gh",
    ["secret", "list", "--repo", repo, "--json", "name"],
    "checking the NPM_TOKEN GitHub secret"
  );
  let secrets;
  try {
    secrets = JSON.parse(secretResult.stdout);
  } catch {
    throw new Error("GitHub returned an unreadable secret list. Check gh auth and repository access.");
  }
  if (!secrets.some((secret) => secret.name === "NPM_TOKEN")) {
    throw new Error(`GitHub secret NPM_TOKEN is missing in ${repo}. Run make release-sync-token.`);
  }

  const packageJSON = readPackageJSON();
  const npmView = runCapture(
    "npm",
    ["view", packageJSON.name, "version", "--json", "--registry", registry],
    "checking npm package name availability",
    true
  );
  if (npmView.status !== 0 && !/E404|not found|404/i.test(npmView.stderr)) {
    throw new Error(`npm could not inspect ${packageJSON.name}. Check npm auth and package scope access.`);
  }

  readNpmToken(config);
  console.log("Release preflight passed.");
}

function updateChangelog(config, version) {
  validateVersion(version);
  const changelogPath = path.join(rootDir, "src/content/docs/changelog.md");
  let original = fs.readFileSync(changelogPath, "utf8");
  if (new RegExp(`^## ${escapeRegExp(version)} - (?!YYYY-MM-DD)`, "m").test(original)) {
    console.log(`Changelog already contains ${version}; leaving it unchanged.`);
    return;
  }

  const placeholderPattern = new RegExp(
    `\\n## ${escapeRegExp(version)} - YYYY-MM-DD\\n\\n(?:- [^\\n]*\\n)+`,
    "m"
  );
  original = original.replace(placeholderPattern, "\n");

  const notes = releaseNotes(config);
  const section = [`## ${version} - ${new Date().toISOString().slice(0, 10)}`, "", ...notes, ""].join("\n");
  const frontmatterEnd = original.indexOf("---", 3);
  if (frontmatterEnd === -1) {
    throw new Error("Unable to find changelog frontmatter in src/content/docs/changelog.md.");
  }

  const insertionPoint = frontmatterEnd + 3;
  const updated = `${original.slice(0, insertionPoint)}\n\n${section}${original.slice(insertionPoint).replace(/^\n+/, "\n")}`;
  fs.writeFileSync(changelogPath, updated);
  console.log(`Updated changelog for ${version}.`);
}

function releaseNotes(config) {
  if (process.env.RELEASE_NOTES?.trim()) {
    return process.env.RELEASE_NOTES.trim().split(/\r?\n/).map((line) => {
      const note = line.replace(/^[-*]\s*/, "").trim();
      return note ? `- ${note}` : "- Maintenance release.";
    });
  }

  const previousTag = latestTag();
  const range = previousTag ? `${previousTag}..HEAD` : "-20";
  const result = runCapture("git", ["log", "--pretty=%s", range], "collecting release notes");
  const subjects = result.stdout
    .split(/\r?\n/)
    .map((subject) => subject.trim())
    .filter(Boolean)
    .filter((subject) => !/^docs:\s*(update changelog|site)/i.test(subject));
  if (subjects.length === 0) {
    return ["- Maintenance release. No direct code behavior changes beyond release preparation."];
  }

  return subjects.slice(0, 20).map((subject) => `- ${humanizeCommit(subject)}`);
}

function commitReleaseFiles(version) {
  const files = ["src/content/docs/changelog.md"];
  const packageJSON = readPackageJSON();
  if (packageJSON.version === version) {
    files.push("package.json");
  }
  runCommand("git", ["add", ...files], "staging release metadata");
  const status = runCapture("git", ["diff", "--cached", "--quiet"], "checking staged release metadata", true);
  if (status.status === 0) {
    console.log("Release metadata is already committed; continuing with token and tag steps.");
    return;
  }
  runCommand("git", ["commit", "-m", `docs: update changelog for v${version}`], "committing release metadata");
  runCommand("git", ["push", "origin", "HEAD"], "pushing release metadata before tagging");
}

function syncNpmToken(config) {
  requireCommand("security", "syncing the npm token");
  requireCommand("gh", "syncing the npm token");
  const token = readNpmToken(config);
  const repo = `${config.githubOwner}/${config.githubRepo}`;
  run("gh", ["secret", "set", "NPM_TOKEN", "--repo", repo], {
    input: `${token}\n`,
    stdio: ["pipe", "inherit", "inherit"]
  });
  console.log(`Synced the npm publish token to ${repo} as NPM_TOKEN without printing it.`);
}

function validateNpmAuth(config) {
  requireCommand("npm", "validating npm authentication");
  const token = readNpmToken(config);
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "go-cli-npm-auth-"));
  const npmrcPath = path.join(tempDirectory, ".npmrc");
  fs.writeFileSync(npmrcPath, `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 });

  try {
    run("npm", ["whoami", "--registry", registry], {
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
  console.log("npm authentication is valid; the token was not printed.");
}

function pushTag(config, version) {
  validateVersion(version);
  ensureClean("creating a release tag");
  const tag = `v${version}`;
  const existing = runCapture("git", ["tag", "--list", tag], "checking for an existing release tag");
  if (existing.stdout.trim()) {
    throw new Error(`${tag} already exists. Choose a new package version.`);
  }

  runCommand("git", ["tag", tag], `creating ${tag}`);
  runCommand("git", ["push", "origin", tag], `pushing ${tag}`);
  console.log(`Pushed ${tag}.`);
}

function watchWorkflow(config, version) {
  validateVersion(version);
  requireCommand("gh", "watching the release workflow");
  const repo = `${config.githubOwner}/${config.githubRepo}`;
  const tag = `v${version}`;
  const result = runCapture(
    "gh",
    ["run", "list", "--repo", repo, "--workflow", releaseWorkflow, "--limit", "20", "--json", "databaseId,headBranch"],
    "finding the release workflow run"
  );
  let runs;
  try {
    runs = JSON.parse(result.stdout);
  } catch {
    throw new Error("GitHub returned an unreadable workflow list. Run gh run list manually.");
  }
  const match = runs.find((runInfo) => runInfo.headBranch === tag);
  if (!match) {
    throw new Error(`No ${releaseWorkflow} run for ${tag} is visible yet. Retry with make release-watch VERSION=${version}.`);
  }
  runCommand(
    "gh",
    ["run", "watch", String(match.databaseId), "--repo", repo, "--compact", "--exit-status"],
    `watching ${releaseWorkflow} for ${tag}`
  );
}

function verifyRelease(config, version) {
  validateVersion(version);
  requireCommand("gh", "verifying GitHub release assets");
  requireCommand("npm", "verifying npm publication");
  const repo = `${config.githubOwner}/${config.githubRepo}`;
  const tag = `v${version}`;
  const release = runCapture(
    "gh",
    ["release", "view", tag, "--repo", repo, "--json", "assets,url"],
    "verifying GitHub release assets"
  );
  let releaseJSON;
  try {
    releaseJSON = JSON.parse(release.stdout);
  } catch {
    throw new Error(`GitHub returned an unreadable release response for ${tag}.`);
  }

  const assetNames = new Set((releaseJSON.assets || []).map((asset) => asset.name));
  const missing = expectedTargets
    .map(([goos, goarch]) => `${config.binaryName}_${goos}_${goarch}${goos === "windows" ? ".exe" : ""}`)
    .filter((asset) => !assetNames.has(asset));
  if (missing.length > 0) {
    throw new Error(`Release ${tag} is missing assets: ${missing.join(", ")}`);
  }

  const packageJSON = readPackageJSON();
  const npmResult = runCapture(
    "npm",
    ["view", `${packageJSON.name}@${version}`, "version", "--json", "--registry", registry],
    "verifying npm publication"
  );
  if (npmResult.status !== 0 || !npmResult.stdout.includes(version)) {
    throw new Error(`npm publication ${packageJSON.name}@${version} was not found.`);
  }
  console.log(`Verified ${releaseJSON.url || githubUrl(config)} and ${packageJSON.name}@${version}.`);
}

function updatePackageVersion(version) {
  const packagePath = path.join(rootDir, "package.json");
  const packageJSON = readPackageJSON();
  if (packageJSON.version === version) {
    return;
  }
  packageJSON.version = version;
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJSON, null, 2)}\n`);
  console.log(`Set package.json version to ${version}.`);
}

function ensureReleaseChangesOnly() {
  const status = gitStatus();
  const allowed = new Set(["package.json"]);
  const unexpected = status.filter((filePath) => {
    return filePath !== "src/content/docs/changelog.md" && !allowed.has(filePath);
  });
  if (unexpected.length > 0) {
    throw new Error(`Checks changed unexpected files: ${unexpected.join(", ")}. Review them before shipping.`);
  }
}

function ensureClean(action) {
  const status = gitStatus();
  if (status.length > 0) {
    throw new Error(`Cannot continue ${action} with a dirty git tree: ${status.join(", ")}`);
  }
}

function gitStatus() {
  const result = runCapture("git", ["status", "--porcelain"], "checking git state");
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

function readNpmToken(config) {
  const service =
    process.env.NPM_KEYCHAIN_SERVICE || `${config.githubOwner} npm publish token`;
  const result = spawnSync("security", ["find-generic-password", "-w", "-s", service], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error(
      `No npm token found in the macOS keychain service "${service}". Store it with security add-generic-password, or set NPM_KEYCHAIN_SERVICE.`
    );
  }
  return result.stdout.trim();
}

function latestTag() {
  const result = runCapture("git", ["tag", "--list", "v*", "--sort=-version:refname"], "reading existing release tags");
  return result.stdout.split(/\r?\n/).map((tag) => tag.trim()).find(Boolean) || "";
}

function readPackageJSON() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
}

function resolveVersion(options) {
  const assignment = options._?.find((value) => value.startsWith("VERSION="));
  const version = optionValue(options, "version", "VERSION") || assignment?.slice("VERSION=".length) || readPackageJSON().version;
  return String(version).replace(/^v/, "");
}

function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`VERSION must be a semantic version such as 0.2.0; received ${version}.`);
  }
}

function runCommand(command, args, purpose) {
  requireCommand(command, purpose);
  return run(command, args);
}

function runCapture(command, args, purpose, allowFailure = false) {
  requireCommand(command, purpose);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error) {
    throw new Error(`${command} is unavailable while ${purpose}: ${result.error.message}`);
  }
  if (result.status !== 0 && !allowFailure) {
    const detail = result.stderr.trim();
    throw new Error(`${command} ${args.join(" ")} failed while ${purpose}.${detail ? ` ${detail}` : ""}`);
  }
  return result;
}

function humanizeCommit(subject) {
  const withoutPrefix = subject.replace(/^(build|chore|feat|fix|perf|refactor|test|ci)(\([^)]*\))?!?:\s*/i, "");
  return withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printHelp() {
  console.log(`Usage: node scripts/release.js <command>

Commands:
  preflight     Check only tools, GitHub auth/repo, NPM_TOKEN, and npm scope access
  changelog     Prepend a version section (RELEASE_NOTES may contain newline-separated bullets)
  sync-token    Read the macOS keychain and set GitHub Actions NPM_TOKEN
  npm-auth      Validate npm whoami without printing the token
  tag           Create and push vVERSION
  watch         Watch the tag's release workflow
  verify        Verify all release assets and npm publication
  ship          Run the complete check, docs, changelog, publish, and verification flow

The npm token service defaults to "<github-owner> npm publish token" and can be
overridden with NPM_KEYCHAIN_SERVICE. The release version defaults to package.json.
`);
}

try {
  main();
} catch (error) {
  console.error(`Release failed: ${error.message}`);
  process.exit(1);
}
