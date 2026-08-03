# CONTRIBUTORS.md

Maintainer notes for this template repository.

## Prerequisites

- Go `1.26+`
- Node `18+`
- Bun `1+`
- `license-generator` for setup and license changes
- npm account with publish rights for the package name in `package.json`
- GitHub repo admin access

## Local development

```bash
make check
make build
./dist/mycli --help
```

Install command locally:

```bash
make install-local
mycli --help
```

For a new CLI, prefer the identity setup flow so the command, module, repository,
npm package, release metadata, docs config, and license stay synchronized:

```bash
make setup SETUP_ARGS='--cli-name pluck --go-module github.com/acme/pluck \
  --github-owner acme --github-repo pluck --npm-package @acme/pluck'
```

## Release process

1. Ensure `main` is green and the docs pass serially:

```bash
make check
bun run docs:check
bun run docs:build
```

2. Run the complete release flow:

```bash
make ship VERSION=0.1.0
```

3. GitHub Actions `release` workflow runs automatically:
- quality checks
- cross-platform binary build
- GitHub release publish
- npm publish

## Required GitHub secret

- `NPM_TOKEN`: npm automation token with publish rights for your package.

The release flow syncs it from the macOS keychain service
`<github-owner> npm publish token`:

```bash
make release-sync-token
```

## npm token setup

Create token at npm:

- Profile -> Access Tokens -> Create New Token
- Use an automation/granular token scoped to required package/org

Validate auth locally without printing the token:

```bash
make release-npm-auth
```

## Notes on package naming

Before first publish, set a package name you control in `package.json`.

- Example unscoped: `"name": "your-cli-name"`
- Example scoped: `"name": "@your-scope/your-cli-name"`

The default license is Apache-2.0. Use `make setup SETUP_ARGS='--license MIT'` (or another
name from `license-generator --list`) to regenerate `LICENSE` and synchronize the
package and docs metadata.

For a private GitHub repository, release assets require authenticated downloads.
The normal anonymous npm path is a public repository; use the explicit
`--anonymous-npm` warning before choosing a private repo for that flow.
