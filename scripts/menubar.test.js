const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const identity = JSON.parse(fs.readFileSync(path.join(root, "project.config.json"), "utf8"));
const templateOnly = identity.githubRepo === "go-cli-template" && identity.cliName === "mycli";
const mac = process.platform === "darwin";

function run(cwd, command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env });
  assert.equal(result.status, 0, command + " " + args.join(" ") + " failed:\n" + result.stdout + "\n" + result.stderr);
  return result.stdout;
}

test("menu bar flag cannot accompany npm", { skip: !templateOnly }, (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "go-menubar-invalid-"));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(root, fixture, {
    recursive: true,
    filter(file) {
      return !path.relative(root, file).split(path.sep).some((part) =>
        [".git", "node_modules", ".astro", "dist", ".DS_Store"].includes(part)
      );
    }
  });
  const result = spawnSync(process.execPath, ["scripts/setup.js", "--macos-menubar"], {
    cwd: fixture, encoding: "utf8"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--macos-menubar.*distribution direct/);
  assert.equal(fs.existsSync(path.join(fixture, "apps/menubar")), false);
});

test("opt-in menu bar builds, installs, verifies and survives bootstrap cleanup", {
  skip: !templateOnly || !mac
}, (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "go-menubar-"));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(root, fixture, {
    recursive: true,
    filter(file) {
      return !path.relative(root, file).split(path.sep).some((part) =>
        [".git", "node_modules", ".astro", "dist", ".DS_Store"].includes(part)
      );
    }
  });
  const readme = fs.readFileSync(path.join(fixture, "README.md"), "utf8");
  run(fixture, process.execPath, [
    "scripts/setup.js", "--cli-name", "spark", "--binary-name", "spark",
    "--github-owner", "example", "--github-repo", "spark",
    "--go-module", "github.com/example/spark", "--distribution", "direct",
    "--macos-menubar", "--description", "Swift demo",
    "--canonical-url", "https://spark.example.com"
  ]);
  assert.equal(fs.existsSync(path.join(fixture, "package.json")), false);
  assert.equal(fs.readFileSync(path.join(fixture, "README.md"), "utf8"), readme);
  assert.match(fs.readFileSync(path.join(fixture, ".github/workflows/release.yml"), "utf8"), /build-menubar:/);
  assert.match(fs.readFileSync(path.join(fixture, "docs/public/install.sh"), "utf8"), /Spark\.app/);
  assert.equal(fs.existsSync(path.join(fixture, "apps/menubar/Sources/main.swift")), true);

  const stage = path.join(fixture, "stage");
  fs.mkdirSync(stage);
  const binary = path.join(stage, "spark");
  run(fixture, "go", ["build", "-ldflags=-X github.com/example/spark/internal/buildinfo.Version=0.1.0",
    "-o", binary, "./cmd/spark"]);
  const app = path.join(stage, "Spark.app");
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  run(fixture, "bash", ["apps/menubar/build.sh", app, arch, "0.1.0"]);
  run(fixture, "codesign", ["--verify", "--deep", "--strict", app]);
  assert.match(run(fixture, path.join(app, "Contents/MacOS/spark-menubar"), ["--check"]), /companion CLI are ready/);

  const asset = "spark_darwin_" + arch + ".tar.gz";
  const archive = path.join(fixture, asset);
  const tar = spawnSync("tar", ["-czf", archive, "-C", stage, "spark", "Spark.app"], {
    cwd: fixture, encoding: "utf8", env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
  assert.equal(tar.status, 0, tar.stderr);
  const checksum = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  fs.writeFileSync(archive + ".sha256", checksum + "\n");

  const commands = path.join(fixture, "mock-tools");
  fs.mkdirSync(commands);
  const fakeCurl = path.join(commands, "curl");
  fs.writeFileSync(fakeCurl, [
    "#!/bin/sh",
    'target=""',
    'previous=""',
    'asset=""',
    'for argument in "$@"; do',
    '  if [ "$previous" = "-o" ]; then target="$argument"; fi',
    '  previous="$argument"',
    '  case "$argument" in',
    '    */' + asset + '.sha256) asset="' + asset + '.sha256" ;;',
    '    */' + asset + ') asset="' + asset + '" ;;',
    "  esac",
    "done",
    'test -n "$asset" && test -n "$target" || exit 40',
    'cp "$FAKE_RELEASE/$asset" "$target"'
  ].join("\n") + "\n");
  fs.chmodSync(fakeCurl, 0o755);
  const installDir = path.join(fixture, "installed");
  const env = {
    ...process.env, PATH: commands + ":" + process.env.PATH,
    FAKE_RELEASE: fixture, CLI_INSTALL_DIR: installDir, CLI_VERSION: "0.1.0",
    CLI_NO_LAUNCH: "1"
  };
  const install = (...args) => spawnSync("sh", ["docs/public/install.sh", ...args], {
    cwd: fixture, encoding: "utf8", env
  });
  let result = install();
  assert.equal(result.status, 0, result.stderr);
  const installedBinary = path.join(installDir, "spark");
  assert.deepEqual(fs.readFileSync(installedBinary), fs.readFileSync(binary));
  run(fixture, "codesign", ["--verify", "--deep", "--strict", path.join(installDir, "Spark.app")]);
  fs.writeFileSync(archive + ".sha256", "0".repeat(64) + "\n");
  result = install("upgrade");
  assert.notEqual(result.status, 0, "bad checksum must reject the complete bundle");
  assert.deepEqual(fs.readFileSync(installedBinary), fs.readFileSync(binary));
  fs.writeFileSync(archive + ".sha256", checksum + "\n");
  result = install("upgrade");
  assert.equal(result.status, 0, result.stderr);
  run(fixture, "codesign", ["--verify", "--deep", "--strict", path.join(installDir, "Spark.app")]);

  run(fixture, process.execPath, ["scripts/cleanup.js"]);
  assert.equal(fs.existsSync(path.join(fixture, "scripts/provision-vercel.mjs")), false);
  assert.doesNotMatch(fs.readFileSync(path.join(fixture, "Makefile"), "utf8"), /^vercel-provision:/m);
  assert.equal(JSON.parse(fs.readFileSync(path.join(fixture, "docs/vercel.json"), "utf8")).git.deploymentEnabled, false);
  assert.match(fs.readFileSync(path.join(fixture, ".github/workflows/docs.yml"), "utf8"), /docs\/\*\*/);
  assert.equal(fs.existsSync(path.join(fixture, "scripts/direct-templates/menubar")), false);
  assert.equal(fs.existsSync(path.join(fixture, "docs/scripts/should-build.mjs")), true);
  assert.equal(fs.existsSync(path.join(fixture, "apps/menubar/Sources/main.swift")), true);
  assert.equal(fs.existsSync(path.join(fixture, "docs/public/install.sh")), true);
  run(fixture, "go", ["test", "./..."]);
});
