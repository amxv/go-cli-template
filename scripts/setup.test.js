const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const templateRoot = path.resolve(__dirname, "..");
const projectIdentity = JSON.parse(fs.readFileSync(path.join(templateRoot, "project.config.json"), "utf8"));
// Generated projects inherit the template scripts but shouldn't run template-specific fixtures.
const templateOnly = projectIdentity.goModule === "github.com/amxv/go-cli-template"
  ? false
  : "These bootstrap regression tests run only in the canonical Go CLI template.";
const contentFiles = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTORS.md",
  "docs/src/pages/index.astro",
  "docs/src/pages/docs/index.astro",
  "docs/src/content/docs/quickstart.md",
  "docs/src/content/docs/changelog.md"
];

function copyTemplate(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "go-cli-bootstrap-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const checkout = path.join(tempDir, "checkout");
  fs.cpSync(templateRoot, checkout, {
    recursive: true,
    filter(source) {
      const relative = path.relative(templateRoot, source);
      return !relative.split(path.sep).some((part) =>
        [".git", ".astro", ".vercel", "dist", "node_modules", ".DS_Store"].includes(part)
      );
    }
  });
  return checkout;
}

function run(checkout, command, args) {
  const result = spawnSync(command, args, {
    cwd: checkout,
    encoding: "utf8",
    env: { ...process.env, LICENSE_YEAR: "2026", LICENSE_AUTHOR: "Template test" }
  });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function read(checkout, relativePath) {
  return fs.readFileSync(path.join(checkout, relativePath), "utf8");
}

function docsIdentity(checkout) {
  const match = read(checkout, "docs/src/data/docs.ts").match(
    /const generatedIdentity = (\{[\s\S]*?\}) as const;/
  );
  assert.ok(match, "generated docs metadata should be present");
  return JSON.parse(match[1]);
}

test("bootstrap rewrites Go module and machine metadata without touching prose", { skip: templateOnly }, (t) => {
  const checkout = copyTemplate(t);
  const originalContent = new Map(contentFiles.map((file) => [file, read(checkout, file)]));
  const description = 'A live LaTeX preview tool with "instant" updates';
  const args = [
    "scripts/setup.js",
    "--cli-name", "lampo",
    "--binary-name", "lampo-native",
    "--go-module", "example.com/graphics/lampo",
    "--github-owner", "example",
    "--github-repo", "lampo",
    "--npm-package", "@example/lampo",
    "--description", description,
    "--homepage", "https://lampo.example.com",
    "--canonical-url", "https://lampo.example.com"
  ];

  run(checkout, process.execPath, args);
  assert.match(read(checkout, "go.mod"), /^module example\.com\/graphics\/lampo$/m);
  assert.match(read(checkout, "cmd/lampo/main.go"), /example\.com\/graphics\/lampo\/internal\/app/);
  assert.match(read(checkout, "internal/app/app.go"), /example\.com\/graphics\/lampo\/internal\/buildinfo/);
  assert.match(read(checkout, "Makefile"), /example\.com\/graphics\/lampo\/internal\/buildinfo\.Version/);
  assert.match(read(checkout, ".github/workflows/release.yml"), /CLI_MODULE: "example\.com\/graphics\/lampo"/);
  assert.match(read(checkout, "docs/astro.config.mjs"), /https:\/\/lampo\.example\.com/);

  const pkg = JSON.parse(read(checkout, "package.json"));
  assert.equal(pkg.name, "@example/lampo");
  assert.equal(pkg.config.goModule, "example.com/graphics/lampo");
  assert.deepEqual(pkg.bin, { lampo: "bin/lampo.js" });
  assert.ok(pkg.files.includes("bin/lampo.js"));
  assert.ok(pkg.scripts.test.includes("bin/lampo.js"));
  assert.equal(JSON.parse(read(checkout, "docs/package.json")).name, "@example/lampo-docs");
  assert.match(read(checkout, "docs/bun.lock"), /@example\/lampo-docs/);

  assert.deepEqual(docsIdentity(checkout), {
    name: "lampo",
    strapline: description,
    description,
    repoUrl: "https://github.com/example/lampo",
    footerText: description
  });
  for (const [file, content] of originalContent) {
    assert.equal(read(checkout, file), content, `${file} should remain untouched`);
  }

  run(checkout, "go", ["test", "./..."]);
  // The newly scaffolded project's normal npm checks must still pass.
  run(checkout, "npm", ["test"]);
  const identityBefore = read(checkout, "docs/src/data/docs.ts");
  const moduleBefore = read(checkout, "go.mod");
  run(checkout, process.execPath, args);
  assert.equal(read(checkout, "docs/src/data/docs.ts"), identityBefore);
  assert.equal(read(checkout, "go.mod"), moduleBefore);
  for (const [file, content] of originalContent) {
    assert.equal(read(checkout, file), content, `${file} should still be untouched`);
  }
});

test("bootstrap infers the new repository's module, package, and docs links", { skip: templateOnly }, (t) => {
  const checkout = copyTemplate(t);
  run(checkout, "git", ["init", "-q"]);
  run(checkout, "git", ["remote", "add", "origin", "https://github.com/octo/mist.git"]);
  run(checkout, process.execPath, ["scripts/setup.js", "--cli-name", "mist", "--description", "Mist CLI"]);

  assert.match(read(checkout, "go.mod"), /^module github\.com\/octo\/mist$/m);
  assert.equal(JSON.parse(read(checkout, "package.json")).name, "@octo/mist");
  assert.equal(docsIdentity(checkout).repoUrl, "https://github.com/octo/mist");
  assert.equal(docsIdentity(checkout).description, "Mist CLI");
  run(checkout, "go", ["test", "./..."]);
});
