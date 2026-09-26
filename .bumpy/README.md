# Bumpy

This directory is used by [Bumpy](https://bumpy.varlock.dev) to manage versioning and changelogs for the published packages, `@omote-social/lexicon` and `@omote-social/profiles`. The site (`apps/omote.social`) is private and deploys on its own.

Bump files (`*.md` other than this README) accumulate on `main` and are consumed when Bumpy opens a version PR. Each bump file declares which packages bump and by how much, plus the changelog body.

## Creating a bump file

```bash
yarn bumpy add
```

Non-interactive:

```bash
yarn bumpy add --packages "@omote-social/profiles:patch" --message "Description of changes" --name "my-change"
```

For PRs that don't need a release (docs, CI, the site):

```bash
yarn bumpy add --empty --name "docs-update"
```

Full documentation: https://bumpy.varlock.dev
