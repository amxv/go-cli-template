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
needed when editing the docs; Vercel handles that during deployment.

## Deployment

Vercel builds the docs site to static output in `docs/dist` during deployment.

For Vercel, use `docs` as the Root Directory. The committed `docs/vercel.json`
installs and builds the isolated docs workspace and serves `docs/dist` without
sharing the Go CLI's root `dist/` directory.

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
Agents only use `make docs-check` locally. `make docs-test` validates the GitHub
path trigger and the retained, independent Git diff helper
`docs/scripts/should-build.mjs`. The helper is **not** run by Vercel itself.
