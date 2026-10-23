---
title: Docs site maintenance
description: Run, edit, validate, and deploy the ZueDocs-powered documentation site embedded in this Go CLI template.
order: 5
category: Reference
summary: Developer notes for maintaining the Astro docs app alongside the Go CLI.
---

## Local development

Install dependencies and start Astro:

```bash
make docs-install
make docs-dev
```

Astro serves the docs locally, usually at `http://localhost:4321`.

## Files to edit

The docs site is intentionally small:

```bash
docs/package.json              # isolated docs dependencies and scripts
docs/astro.config.mjs          # Astro config
docs/src/data/docs.ts          # site name, repo URL, nav, categories
docs/src/pages/index.astro     # landing page
docs/src/pages/docs/index.astro # docs index
docs/src/pages/docs/[...slug].astro # article route
docs/src/content/docs/*.md     # documentation pages
docs/src/styles/global.css     # shared ZueDocs import
docs/vercel.json               # deployment config
```

For most updates, edit markdown in `docs/src/content/docs` first.

## ZueDocs package usage

This site imports the shared docs shell from `zuedocs`:

```astro
import BaseLayout from "zuedocs/layouts/BaseLayout.astro";
import DocsPageLayout from "zuedocs/layouts/DocsPageLayout.astro";
```

Local repos should keep their own docs content and `docs/src/data/docs.ts`, while shared shell behavior belongs in the `zuedocs` package.

## Validate changes

Run:

```bash
make docs-test
make docs-check
```

Astro check is sufficient for local validation. No separate production build is
needed when editing the docs; GitHub Actions builds before deploying to Vercel.

## Deployment

GitHub Actions builds the docs site to static output in `docs/dist` before deployment.

For Vercel, use `docs` as the Root Directory. The committed `docs/vercel.json`
installs and builds the isolated docs workspace and serves `docs/dist` without
sharing the Go CLI's root `dist/` directory.
The project settings should use framework `astro`, install command
`bun install --frozen-lockfile`, build command `bun run build`, and output
`dist`. A newly created Vercel project may otherwise default to repository
root `.`.

For a custom **subdomain**, attach it with the project name and read back the
specific DNS instructions:

```bash
vercel domains add <subdomain.example.com> <project-name> --scope <team>
vercel domains verify <subdomain.example.com> --project <project-name> --scope <team> --json
```

Use the exact `recommended.records` target for Cloudflare with proxying
disabled, then verify again. The generic `vercel domains inspect` output may
describe the parent domain instead of the subdomain's needed DNS record.

To avoid counting Go-only pushes toward Vercel's deployment quota, the
committed `.github/workflows/docs.yml` runs only when `docs/**` changes on
`main`. It tests and checks Astro before deploying production docs using the
Vercel CLI. The project remains connected to GitHub, but
`docs/vercel.json` sets `git.deploymentEnabled` to `false` to prevent duplicate
automatic Git deployments. Do not add `ignoreCommand`: canceled deployments
still count toward Vercel's deployment quota.

Before the first generated-project deployment, run `make vercel-provision`
from the repository root after linking `docs/` to Vercel and before running
`make bootstrap-clean`. The script mints a project-scoped CI token from the
protected Vercel CLI session (or a macOS Keychain fallback), writes
`VERCEL_TOKEN` as a GitHub Actions secret, and saves `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID` as GitHub Actions variables. GitHub CI produces a
Vercel Build Output API v3 static bundle and deploys with `--prebuilt` so
project-scoped tokens do not require Vercel's broad project-settings calls.
The build runs within `docs/` but the prebuilt bundle is copied from
`docs/.vercel/output` into repository-root `.vercel/output`; Vercel is invoked
**from the repository root**. Never deploy from `docs/` with Vercel Root
Directory already set to `docs`, or the CLI looks for `docs/docs`.
Agents only use `make docs-check` locally. `make docs-test` validates the GitHub
path trigger and the retained, independent Git diff helper
`docs/scripts/should-build.mjs`. The helper is **not** run by Vercel itself.
