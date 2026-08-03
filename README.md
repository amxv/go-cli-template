# go-cli-template

Minimal template for shipping a Go CLI with:

- one-command identity setup after GitHub template cloning
- a local command runner (`Makefile`)
- npm global install wrapper (`bin/mycli.js`)
- automatic GitHub Release + npm publish on tag
- bundled ZueDocs-powered docs site

## Install (template example)

```bash
npm i -g @amxv/go-cli-template
mycli --help
```

## Commands in this starter

```bash
mycli --help
mycli hello
mycli hello <name>
mycli --version
```

## Docs site

This template includes an Astro docs site powered by ZueDocs.

```bash
bun install
bun run docs:dev
bun run docs:check
bun run docs:build
```

Customize the docs alongside the CLI:

- `src/data/docs.ts`: site name, repo URL, footer sections, nav, categories
- `src/pages/index.astro`: landing page
- `src/content/docs/*.md`: guides and command reference

## Start a new CLI

Create the repository from the directory where the new clone should be placed:

```bash
gh repo create acme/pluck \
  --public \
  --template amxv/go-cli-template \
  --clone
```

Then run the identity setup from the new repository root:

```bash
cd pluck
make setup SETUP_ARGS='--cli-name pluck \
  --binary-name pluck \
  --go-module github.com/acme/pluck \
  --github-owner acme --github-repo pluck \
  --npm-package @acme/pluck \
  --description "A fast file picker" \
  --license Apache-2.0'
```

The setup command runs from the cloned repository root and never creates or
clones another repository. Omit `--public` in the GitHub command for the safe
private default, while public repositories are the normal path for anonymous npm
installs. If a private repo is intentionally paired with anonymous npm installs,
pass `--visibility private --anonymous-npm` to the setup command for the warning.

For any existing clone, `make setup` accepts the same identity options:

```bash
make setup SETUP_ARGS='--cli-name pluck \
  --binary-name pluck \
  --go-module github.com/acme/pluck \
  --github-owner acme --github-repo pluck \
  --npm-package @acme/pluck \
  --description "A fast file picker" \
  --homepage https://pluck.dev \
  --canonical-url https://pluck.dev \
  --license Apache-2.0'
```

The setup script updates the command path, Go module, npm metadata, GitHub URLs,
Makefile, release workflow, postinstall metadata, docs configuration, and license
references together. It uses `license-generator` for Apache-2.0 by default and
supports the other license-generator names listed by `license-generator --list`.

## Customize the CLI

After setup, replace starter logic:

- `internal/app/app.go`
- `internal/app/app_test.go`

Update bundled docs as the command surface changes:

- `src/data/docs.ts`
- `src/pages/index.astro`
- `src/content/docs/*.md`

## Release flow

The complete local release sequence is:

```bash
make ship VERSION=0.2.0
```

It runs `make check`, `bun run docs:check`, and `bun run docs:build` serially,
updates the changelog, reads the npm token from the macOS keychain, syncs
`NPM_TOKEN` to GitHub Actions, validates npm auth without printing the token,
commits and pushes release metadata, tags and pushes `v0.2.0`, watches the release
workflow, and verifies all six GitHub assets plus npm publication.

Use the individual `release-*` Make targets when you need manual control.

## Project layout

- `cmd/mycli/main.go`: CLI entrypoint
- `internal/app/`: command logic
- `internal/buildinfo/`: build-time version plumbing for `--version`
- `scripts/postinstall.js`: installs binary from GitHub release (falls back to local `go build`)
- `scripts/setup.js`: initializes the repeated project identity fields
- `scripts/release.js`: runs the focused release workflow
- `.github/workflows/release.yml`: automated release pipeline
- `project.config.json`: canonical project identity
- `src/`: ZueDocs-powered documentation site
- `astro.config.mjs`: docs site build config
- `AGENTS.md`: instructions for coding agents
- `CONTRIBUTORS.md`: maintainer/release operations

See `AGENTS.md` and `CONTRIBUTORS.md` for complete dev/release instructions.

## License

Apache-2.0
