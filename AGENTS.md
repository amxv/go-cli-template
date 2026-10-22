# AGENTS.md

Guidance for coding agents working in `go-cli-template`.

## Purpose

This repo is a generic starter for Go command-line tools. Bootstrap can choose
`--distribution npm` or `--distribution direct` (GitHub Releases, website
install scripts, native `upgrade`, and optional daily background updates).

The sample command is `mycli`. Replace it with your actual CLI name and behavior.

## Architecture

- `cmd/mycli/main.go`: process entrypoint, error handling, exits non-zero on failure.
- `internal/app/app.go`: command parser + handlers.
- `internal/app/app_test.go`: starter tests.
- `bin/mycli.js`: npm shim that invokes packaged native binary.
- `scripts/postinstall.js`: downloads release binary on install, falls back to `go build`.
- `scripts/setup.js`: initializes command, module, repository, npm, docs, and license identity.
- `project.config.json`: canonical repeated project identity fields.
- `.github/workflows/release.yml`: tag-driven release pipeline.
- `docs/`: self-contained Astro/ZueDocs workspace with its own Bun lockfile and Vercel config.

## Local commands

Use `make` targets:

- `make fmt`
- `make test`
- `make vet`
- `make lint`
- `make check`
- `make build`
- `make build-all`
- `make install-local`
- `make bootstrap BOOTSTRAP_ARGS='...'`
- `make bootstrap-clean` (run once after final identity/docs setup)

Direct commands:

- `go test ./...`
- `go vet ./...`
- `npm run lint`
- `make docs-check`
- `make docs-test` (Vercel affected-path and production-branch regression tests)

## How to customize safely

1. Run `make bootstrap` with `--distribution npm|direct` to rename the CLI command consistently.
The bootstrap script updates the command path, npm wrapper, package metadata, Go
module (`go.mod` included), Makefile, workflow, postinstall, docs identity/config,
and license metadata. It intentionally does **not** rewrite `README.md` or the
Astro/Markdown documentation pages. Write those for the new project yourself.
For `direct`, don't pass `--npm-package`. Bootstrap removes npm packaging and
replaces it with website installers + GitHub Release checksums and `upgrade`.
It also adds `auto-update on|off|status` (off by default) and background
`upgrade --automatic`. Daily checks are managed by macOS LaunchAgents,
Linux systemd user timers, or Windows Task Scheduler. They compare the latest
stable version before installing and keep the opt-in after failed checks.
After all identity/deployment settings are finalized, run `make bootstrap-clean`
to retire bootstrap scripts, tests, and one-time config. Keep app/release/install
and docs files intact.

2. Keep binary naming convention unchanged unless you also update postinstall/workflow:
- release assets: `<binary>_<goos>_<goarch>[.exe]`
- npm-installed binary path: `bin/<binary>-bin` (or `.exe` on Windows)

3. If adding dependencies, commit `go.sum` and optionally enable Go cache in workflow.

4. Keep help output expressive and command-local (`<command> --help` should explain examples).

5. Update the bundled docs site when command behavior changes:
- `docs/src/data/docs.ts` has bootstrap-generated name, description, repo URL, and
  footer identity. Customize non-identity settings such as nav, colors, and categories as needed.
- `docs/src/pages/index.astro` for landing-page product copy
- `docs/src/content/docs/*.md` for guides and command reference

6. ZueDocs consumer pattern:
- import shared layouts from `zuedocs/layouts/*`
- import shared behavior/styles from `zuedocs/docsEnhancements` and `zuedocs/styles.css`
- keep repo-specific content/config local instead of forking shared shell files
- keep all web tooling under `docs/`; Vercel should use `docs` as the Root Directory

The committed `.github/workflows/docs.yml` filters `main` pushes through
`paths: ["docs/**"]` **before any Vercel deployment is requested**. It runs
Astro check and deploys to Vercel only after a docs change. Root code and Swift
app changes create no Vercel deployment/quota entry. Keep the Vercel project's
GitHub connection and Root Directory `docs`, but preserve
`git.deploymentEnabled: false` in `docs/vercel.json`, with no `ignoreCommand`
(which cancels *after* creating a counted deployment). Setup requires the
generated project's GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
and `VERCEL_PROJECT_ID` from the linked docs project; never commit them.
`docs/scripts/should-build.mjs` remains a tested local helper only. Check
`make docs-test` before deploying a scaffold. Do not re-enable Vercel Git
auto-deploys or introduce duplicate deployment triggers.

## Optional macOS menu bar scaffold

Only direct-distribution Bootstrap accepts **--macos-menubar**. When selected,
it creates a real Swift/AppKit app under apps/menubar, a menubar-build Make
target, and a paired macOS CLI + .app tarball release job. The website
installer verifies archive SHA-256 and the ad-hoc app signature, installs the
pair together, and reopens the menu bar app after upgrades if it was running.
The app uses the Go CLI's existing upgrade and auto-update commands.

Default/npm/direct-without-flag scaffolds must not contain apps/menubar or the
app release job. Bootstrap-clean removes any unused Swift templates and leaves
the selected app source only if opted in. Ad-hoc signing is not notarization:
the scripted curl/tar path does not carry Finder quarantine, but manually
downloaded apps may still trigger Gatekeeper.

## Release contract

Release pipeline triggers on `v*` tags and expects:

- For npm mode only: `NPM_TOKEN` GitHub secret is present before first release;
  the `package.json` name is publishable and postinstall points to the repo.
- For direct mode only: release workflow produces six native binaries and
  `SHA256SUMS`, the website serves `install.sh` and `install.ps1`, and the
  `upgrade [--check]` and `auto-update on|off|status` commands are implemented.
- public GitHub visibility is the normal anonymous npm install path.

## Guardrails

- Prefer additive changes; do not break the release asset naming contract unintentionally.
- If you change release artifacts or CLI binary name, update both workflow and postinstall script in the same PR.
- Use `make docs-check` for routine Astro validation; do not run a separate docs production build locally. Vercel handles production builds.

## Changelog and Release Skill

This template includes:

- `docs/src/content/docs/changelog.md` as a placeholder changelog page for generated projects.
- `.agents/skills/release/SKILL.md` as a release checklist that updates the changelog before tagging.

When customizing the template for a real CLI, keep both files and update the
placeholder changelog manually before each release. Run the checks and docs
validation, commit and push the changelog, then push a `v*` tag. GitHub Actions
builds the release assets and publishes npm only in npm mode.
