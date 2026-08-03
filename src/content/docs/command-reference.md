---
title: Command reference
description: A compact map of the starter command and the files that usually change as the CLI grows.
order: 4
category: Reference
summary: Starter commands, make targets, and docs commands in one scannable page.
---

## Starter command

```bash
mycli --help
mycli hello
mycli hello <name>
mycli --version
```

Replace these commands with behavior specific to your project.

## Go development

```bash
make fmt
make test
make vet
make lint
make check
make build
make build-all
make install-local
make clean
```

## Project setup and release

```bash
make setup SETUP_ARGS='--cli-name pluck --github-owner acme --github-repo pluck'
make ship VERSION=0.2.0
```

Use `make release-preflight`, `make release-changelog`, `make release-sync-token`,
`make release-npm-auth`, `make release-tag`, `make release-watch`, and
`make release-verify` when the release needs to be operated step by step.

## Docs development

```bash
bun run docs:dev
bun run docs:check
bun run docs:build
bun run docs:preview
```

## Main files

```bash
cmd/mycli/main.go             # CLI entrypoint
internal/app/app.go           # command parser and handlers
internal/app/app_test.go      # starter tests
internal/buildinfo/buildinfo.go # version plumbing
bin/mycli.js                  # npm executable shim
scripts/postinstall.js        # release binary installer
.github/workflows/release.yml # release workflow
src/content/docs/*.md         # docs content
src/data/docs.ts              # docs site config
project.config.json           # canonical project identity
```
