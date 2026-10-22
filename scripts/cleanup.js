#!/usr/bin/env node
// Run once after bootstrap. Never run in the canonical template repository.
const fs = require("node:fs");
const path = require("node:path");
const { rootDir, readProjectConfig, templateConfig } = require("./project");

function main() {
  const config = readProjectConfig();
  if (config.githubOwner === templateConfig.githubOwner &&
      config.githubRepo === templateConfig.githubRepo &&
      config.cliName === templateConfig.cliName) {
    throw new Error("Refusing to clean the source template. Run bootstrap in a new project first.");
  }
  const makefilePath = path.join(rootDir, "Makefile");
  const oldMakefile = fs.readFileSync(makefilePath, "utf8");
  const recipe = /^bootstrap:\n\t@node scripts\/setup\.js \$\(BOOTSTRAP_ARGS\)\n\nbootstrap-clean:\n\t@node scripts\/cleanup\.js\n\n/m;
  if (!recipe.test(oldMakefile)) {
    throw new Error("Could not find the expected bootstrap/cleanup recipes in Makefile.");
  }
  let makefile = oldMakefile.replace(recipe, "");
  makefile = makefile.replace(/^vercel-provision:\n\t@node scripts\/provision-vercel\.mjs\n\n/m, "");
  makefile = makefile.replace(/ bootstrap bootstrap-clean vercel-provision /, " ");
  makefile = makefile.replace(/^\t@echo "  make bootstrap.*\n/gm, "");
  makefile = makefile.replace(/^\t@echo "  make vercel-provision.*\n/gm, "");
  fs.writeFileSync(makefilePath, makefile);

  if (config.distribution === "npm") {
    const packagePath = path.join(rootDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    pkg.scripts.test = `node --check bin/${config.cliName}.js && node --check scripts/postinstall.js`;
    pkg.files = (pkg.files || []).filter((item) => item !== "project.config.json");
    fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  const removable = [
    "project.config.json", "scripts/project.js", "scripts/setup.js", "scripts/setup.test.js",
    "scripts/menubar.test.js",
    "scripts/provision-vercel.mjs", "scripts/provision-vercel.test.mjs",
    "scripts/cleanup.js"
  ];
  for (const relative of removable) fs.rmSync(path.join(rootDir, relative), { force: true });
  fs.rmSync(path.join(rootDir, "scripts/direct-templates"), { recursive: true, force: true });
  try { fs.rmdirSync(path.join(rootDir, "scripts")); } catch (err) {
    if (err.code !== "ENOTEMPTY") throw err;
  }
  console.log("Bootstrap files removed. Keep the normal build, docs, and release workflows.");
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
