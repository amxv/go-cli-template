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

The site also comes with `docs/scripts/should-build.mjs`, configured as Vercel's
Ignored Build Step. It builds on `main` when `docs/` changed (including website
installers), but skips Astro builds for code-only commits. It handles multi-commit
pushes and fails open if Vercel's shallow Git checkout cannot resolve the base.
Run `make docs-test` before deploying. **Ignored/canceled Vercel builds still
count toward deployment limits**; true zero-quota skipping requires an eligible
workspace or a docs-path-filtered GitHub Actions deploy instead of Git auto-deploy.
