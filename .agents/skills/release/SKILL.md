---
name: release
description: Cut a tag-driven Go CLI release and update the changelog first.
allowed-tools: Bash, Read, Write, Edit
---

# Release a Go CLI from this template

Use this skill when cutting a release for a project generated from `go-cli-template`.

## Preconditions

- You are on `main` and synced with `origin/main`.
- The working tree is clean except intentional release edits.
- The package name in `package.json` is publishable.
- `NPM_TOKEN` is configured in GitHub secrets.
- The release workflow exists at `.github/workflows/release.yml`.

## Changelog first

Before tagging, update `src/content/docs/changelog.md`:

- prepend a section for the exact version being released
- keep the newest version at the top
- skip versions that do not have git tags
- summarize code and product changes from `main` since the previous existing version tag
- include internal code changes when useful because generated projects are OSS by default
- do not include docs-site-only changes such as site styling, docs package bumps, deploy plumbing, footer/layout changes, or documentation navigation changes
- rewrite technical commit subjects into clear release notes
- if the release contains only tag/version plumbing, write: `Maintenance release. No direct code behavior changes beyond release preparation.`

Commit and push the changelog update before tagging.

```bash
git add src/content/docs/changelog.md
git commit -m "docs: update changelog for v${VERSION}"
git push origin main
```

## Cut the release

```bash
make release-tag VERSION=${VERSION}
```

The release workflow should build native binaries, upload GitHub Release assets, and publish the npm package.

## Verify

```bash
gh run list --limit 5 --json databaseId,displayTitle,headBranch,headSha,status,conclusion,url,workflowName
gh release view "v${VERSION}" --json tagName,name,url,assets
```

Report the tag, workflow URL, release URL, and asset names.
