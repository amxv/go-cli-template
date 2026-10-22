# Go CLI Template

A Go-first starter for shipping a command-line application with tests, GitHub Releases, and an Astro/ZueDocs website. Bootstrap **one** distribution method, implement your CLI, and remove the one-time setup machinery when the project is ready.

The two release paths are intentionally separate:

| | npm | Direct |
| --- | --- | --- |
| Install | `npm install -g @owner/cli` | Website-hosted shell/PowerShell installers |
| GitHub Releases | Native binaries | Native binaries plus `SHA256SUMS` |
| Publishing | GitHub Actions publishes to npm | GitHub Actions publishes release assets only |
| Native `upgrade` command | No | `upgrade [--check]` |
| Optional daily auto-updates | No | `auto-update on\|off\|status` |
| npm token required | Yes | No |

**npm is the default** if `--distribution` is omitted. Choose the distribution mode when bootstrapping; changing it later requires a fresh template rather than mixing the two paths.

## Create a project

Create a public GitHub repository from this template and clone it into your projects directory:

```bash
gh repo create acme/pluck --public --template amxv/go-cli-template --clone
cd pluck
```

Bootstrap a CLI distributed through **npm**:

```bash
make bootstrap BOOTSTRAP_ARGS='--cli-name pluck \
  --distribution npm \
  --npm-package @acme/pluck \
  --description "A fast file picker" \
  --license Apache-2.0'
```

Or bootstrap a **direct-install CLI** without npm:

```bash
make bootstrap BOOTSTRAP_ARGS='--cli-name pluck \
  --distribution direct \
  --description "A fast file picker" \
  --homepage https://pluck.example.com \
  --canonical-url https://pluck.example.com \
  --license Apache-2.0'
```

When cloning from the GitHub template, bootstrap normally infers the owner, repository, and Go module from `origin`. Override them with `--github-owner`, `--github-repo`, and `--go-module` when needed. `--binary-name` is available if the release asset name differs from the command name. The `--npm-package` option applies **only** to npm distribution.

Bootstrap updates the command entrypoint, `go.mod`, Go imports, version/build metadata, release workflow, package or installer configuration, Astro canonical URL, and identity fields in `docs/src/data/docs.ts`. Apache-2.0 is the default; other supported licenses may use `license-generator`.

**Bootstrap does not write product copy.** The agent building the new project should replace the sample command and author its README, landing page, and documentation pages. It should not blindly search-and-replace the starter prose.

## Develop and validate

The template starts with a deliberately small `mycli hello` command. After bootstrap, the generated command name replaces `mycli`.

```bash
make check            # Go tests, vet, formatting; Node checks in npm mode
make build            # Native binary in dist/
./dist/pluck --help   # After bootstrapping the example above
```

Application behavior belongs in `cmd/<cli>/` and `internal/app/`, with tests alongside it. `internal/buildinfo/` supplies the version injected by release builds. The normal Make targets remain available after bootstrap cleanup.

The docs application is independent of the root npm package, so even a direct-distribution project can use Bun/Astro without publishing anything to npm:

```bash
make docs-install
make docs-dev
make docs-test
make docs-check
```

Host the site on Vercel with **Root Directory `docs`**. `docs/src/data/docs.ts` receives generated name, description, repository, and footer identity; navigation, colors, and actual page content are the project's responsibility.

### Automatic docs deployments

**Quota-safe by default:** `.github/workflows/docs.yml` triggers on `main` only
when a file under `docs/` changes. It validates the Astro site, builds static
output in GitHub CI, and deploys through Vercel's Build Output API v3 with
`vercel deploy --prebuilt`. This avoids broad project-settings queries that
can fail with project-scoped tokens. Go source, root release metadata,
and optional Swift menu bar changes **do not start a docs deployment at all**.
Pull requests can run docs checks without deploying. You can request an explicit
production redeployment using the workflow's manual trigger.

Keep the Vercel project **connected to GitHub** and set its Root Directory to
`docs`, but leave `git.deploymentEnabled: false` in `docs/vercel.json`. That
disables Vercel's *automatic Git-triggered* deployments, preventing duplicates.
The build and install commands remain configured for the real docs deployments.
Do **not** add Vercel's `ignoreCommand`: that cancels a deployment after it is
created and **still counts against deployment quotas**.

Provision credentials **once per new project**, after linking `docs/` to its
Vercel project and authenticating with `gh`:

```bash
cd docs && vercel link --yes && cd ..
make vercel-provision
```

This reads the linked `docs/.vercel/project.json`, tries your existing Vercel
CLI session, and uses Vercel's API to mint a **project-scoped token**. It puts
`VERCEL_TOKEN` in GitHub Actions **secrets** and the non-secret
`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` in GitHub Actions **variables**, without
printing or committing credentials. An existing deployment token is preserved;
run `node scripts/provision-vercel.mjs --rotate` to replace it before cleanup.
Revoke the previous token separately in Vercel account settings afterward.
If CLI authentication cannot mint tokens, the setup script falls back to an
account-scoped provisioning credential in your local macOS Keychain under the
service name `amxv vercel bootstrap token`. The high-privilege credential never
goes to GitHub; each project gets its own restricted deployment token. Agents
only need `make docs-check` locally; Astro's production build runs in CI.

The Actions job fails with a clear error if credentials are missing. Template-source
repositories skip the deployment step. `make docs-test` validates the path
decision and deployment configuration with isolated Git fixtures; the retained
`docs/scripts/should-build.mjs` is a **test helper**, not a Vercel ignored-build
step. Only actual documentation deployments use Vercel's deployment quota.

## Direct installation and upgrades

Direct bootstrap includes `docs/public/install.sh` and `docs/public/install.ps1`, served at the website root once deployed. After publishing a first GitHub Release, users can install with, for example:

```bash
curl -fsSL https://pluck.example.com/install.sh | sh
```

On Windows, use the PowerShell installer at `https://pluck.example.com/install.ps1`.

Direct releases contain binaries for macOS, Linux, and Windows (AMD64 and ARM64) and a `SHA256SUMS` file. The installers verify the checksum before replacing a binary. The generated native CLI also supports:

```bash
pluck upgrade --check
pluck upgrade
pluck auto-update on
pluck auto-update status
pluck auto-update off
```

Automatic updates are **off until the user opts in**. Enabling them creates a daily user-level OS job: launchd on macOS, a systemd user timer on Linux, or Task Scheduler on Windows. The CLI does not need to remain open. Scheduled checks compare the installed version with the latest stable GitHub Release and skip redundant installations. Checks are limited to once per 24 hours; failures do not revoke the user's preference or trigger a tight retry loop.

The site must be deployed at the supplied canonical URL before the upgrade command can retrieve its installer. Linux scheduling needs a working systemd user manager; individual CLIs with running services may need additional product-specific safeguards before replacing their binary.

### Optional Swift macOS menu bar app

Use **--macos-menubar** together with **--distribution direct** when a CLI should also ship a native macOS menu bar application:

~~~bash
make bootstrap BOOTSTRAP_ARGS='--cli-name pluck \
  --distribution direct --macos-menubar \
  --description "A fast file picker" \
  --canonical-url https://pluck.example.com'
~~~

Bootstrap then creates **apps/menubar/** with a Swift/AppKit starter, an Info.plist, and a signed app build script. The menu includes **Check for Updates**, **Automatic Updates (Daily)**, **Launch Menu Bar at Login**, **Open Documentation**, and **Quit**. It calls the companion Go CLI for updates and preferences, instead of implementing another updater.

To build locally on macOS:

~~~bash
make build VERSION=0.1.0
make menubar-build VERSION=0.1.0
codesign --verify --deep --strict dist/Pluck.app
~~~

GitHub Releases will include the normal native binaries plus a matching **CLI + signed app** archive for each macOS architecture (Apple Silicon and Intel), with SHA-256 checksum sidecars. The website installer verifies the archive and code signature, installs both under a user-writable directory such as ~/.local/bin, and opens the menu bar app on initial installation. Manual and scheduled upgrades replace both together, and **reopen the app if it was running**.

The Swift app is **ad-hoc signed by default**, following the Zodex-style script installation pattern. The usual curl/tar installation does not add browser quarantine metadata and therefore avoids the typical downloaded-app prompt in that path. **This is not notarization**: manually downloaded app bundles may still trigger Gatekeeper. No Gatekeeper settings are disabled or modified.

Without this flag, a generated project contains **no Swift app, app packaging job, or macOS bundle installer**. The one-time **make bootstrap-clean** command also removes the unused menu bar templates while preserving opted-in runtime app files.

## npm distribution

npm bootstrap instead keeps `package.json`, the JavaScript command shim, and `scripts/postinstall.js`. The release workflow uploads native binaries to GitHub Releases and then publishes the npm package. The postinstall script downloads the matching release asset, with a local Go build fallback.

Set the repository's **`NPM_TOKEN` GitHub Actions secret** securely before pushing the first release tag. Direct-distribution projects do not need that secret, npm publishing jobs, or a root `package.json`.

## Finish setup and remove Bootstrap

Once the project's identity, website URL, distribution choice, and release configuration are final, remove the temporary setup machinery:

```bash
make bootstrap-clean
make check
```

This removes `scripts/setup.js`, `scripts/project.js`, Bootstrap regression fixtures, distribution templates, `project.config.json`, and the Bootstrap Make targets. It **keeps** application source, tests, docs, release workflows, and whichever installer or npm runtime files the selected distribution mode needs. Cleanup is a one-time operation; make any final Bootstrap identity adjustments first.

## Release

Both methods publish on a pushed `v*` Git tag. Write the release notes in `docs/src/content/docs/changelog.md`, validate the app and docs, commit and push, then tag the intended version:

```bash
make check
make docs-check
# Edit and commit docs/src/content/docs/changelog.md, then push main.
make release-tag VERSION=0.2.0
```

GitHub Actions builds and publishes the configured artifacts. It also publishes to npm **only** for npm-mode projects. The repository-local [release skill](.agents/skills/release/SKILL.md) covers the complete release procedure; `AGENTS.md` and `CONTRIBUTORS.md` cover project development and maintenance.

## License

Apache-2.0
