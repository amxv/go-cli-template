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
- The macOS keychain contains `<github-owner> npm publish token`, unless
  `NPM_KEYCHAIN_SERVICE` overrides that service name.

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

## Cut and verify the release

```bash
make ship VERSION=${VERSION}
```

`make ship` runs the Go/Node checks, `bun run docs:check`, and
`bun run docs:build` serially; updates and pushes the changelog; syncs the
keychain token to `NPM_TOKEN`; validates npm auth without printing the token;
creates and pushes `v${VERSION}`; watches the workflow; and verifies every
GitHub asset plus npm publication.

For manual control, run these targets in order:

```bash
make release-preflight
make release-changelog VERSION=${VERSION}
git add src/content/docs/changelog.md package.json
git commit -m "docs: update changelog for v${VERSION}"
git push origin HEAD
make release-sync-token
make release-npm-auth
make release-tag VERSION=${VERSION}
make release-watch VERSION=${VERSION}
make release-verify VERSION=${VERSION}
```

## Verify

```bash
gh run list --limit 5 --json databaseId,displayTitle,headBranch,headSha,status,conclusion,url,workflowName
gh release view "v${VERSION}" --json tagName,name,url,assets
```

Report the tag, workflow URL, release URL, and asset names.
