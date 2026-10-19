---
name: release
description: Cut a Taico release (patch, minor or major) — bump @taico versions on a release branch, merge to main, wait for the main build to produce the container image, tag the merge commit, publish a user-centric GitHub release, then hand the npm publish to Fran. Use when asked to cut, ship or publish a release.
---

# Release

Cut a Taico release: bump versions, merge to main, wait for the container image, tag, publish a GitHub release. Fran publishes the npm packages by hand at the end.

The request says which part of the version to bump: `patch`, `minor` or `major`. If none is given, ask.

## 1. Pick the version

```bash
git checkout main && git pull origin main && git fetch --tags origin
git tag --sort=-v:refname | head -3      # previous release, e.g. 0.8.3
gh release list --limit 3
```

- Tags have no `v` prefix: `0.8.4`, not `v0.8.4`.
- Start from the latest **published** release. Never reuse or move a tag that is already published. If the version you expected is taken, use the next one and say why in the PR.
- Check that `apps/backend/package.json` matches the previous release before bumping.

## 2. Bump on a release branch

```bash
git checkout -b feature/release-<NEW>
npm run release:taico:bump -- --from=<PREV> --to=<NEW>
```

`--from` must be the current version and `--to` the new one; the script refuses to run otherwise. It updates:
- the `version` of every `@taico/*` package in `apps/*` and `packages/*`
- `@taico/*` dependency ranges in those manifests and in `package-lock.json`
- the Socket badges in the READMEs
- `helpers/start-server.sh` (image tag) and `helpers/start-worker.sh`

Check with `git grep -n '<PREV>'`. The only hits left should be unrelated third-party versions in `package-lock.json`, such as `tinypool`.

Then:
```bash
npm run build:dev
git commit -am "chore: bump taico packages to <NEW>"
git push -u origin feature/release-<NEW>
gh pr create --base main --title "chore: release <NEW>" --body ...
```

PR body: a summary of what was bumped, **Changes since <PREV>** (one line per merged PR with its number), upgrade notes (migrations, API changes), and validation.

## 3. Merge, then wait for the main build

- Wait for the PR's `Build and Test` check: `gh pr checks <PR> --watch`
- Merge with a merge commit: `gh pr merge <PR> --merge --delete-branch`
- Find the `Build and Deploy` run for the merge commit on main and wait for it: `gh run list --branch main --limit 2`, then `gh run watch <RUN_ID> --exit-status`

**Do not tag or create the release before this run succeeds.** The main build pushes the container image `ghcr.io/galarzafrancisco/ai-monorepo:main-<short sha>`. Publishing a release triggers the `Tag existing image with release tag` job, which retags that image as `:<NEW>`. If the image does not exist yet, that job fails.

## 4. Tag the merge commit

```bash
git checkout main && git pull origin main
git log -1 --format=%H   # must be the merge commit the main build ran on
git tag <NEW> <MERGE_SHA>
git push origin <NEW>
```

## 5. Publish the GitHub release

```bash
gh release create <NEW> --verify-tag --title <NEW> --notes-file <notes.md>
```

Then make sure the `Tag existing image with release tag` job succeeds on the release run (`gh run list --event release --limit 1`).

### Release notes

Always compare with the previous release: `git log --first-parent --oneline <PREV>..<NEW>`, and read each merged PR (`gh pr view <n>`).

Write for the people who use Taico, not for the people who built it:
- Group by product area (`## Threads`, `## Projects`, `## UI`, …). Put the most visible changes first.
- Each bullet says what someone can do now or what got fixed, in plain words. Bold the key feature. Say where to find it (for example "Settings → Appearance").
- Describe fixes by their symptom ("Fixed: on mobile, the pin icon floated in the middle of the row"), not by the code change.
- Put toil and implementation details at the end: `## Developer` (dev scripts, tooling, refactors), then `## Upgrade notes` (migrations, API and event changes, "No migrations" when there are none, and "`@taico/client` and the other packages are now <NEW>").
- End with `**Full Changelog**: https://github.com/galarzafrancisco/ai-monorepo/compare/<PREV>...<NEW>`

The 0.8.3 and 0.8.4 releases on GitHub show the style.

## 6. Hand off the npm publish to Fran

Do not publish to npm yourself. Tell Fran the release is ready and to run:

```bash
npm run release:taico
```

It builds everything first (`npm run build:dev`, plus nx `build:prod` for the packages), then runs `npm login` only if `npm whoami` fails, then publishes each package and app in dependency order with no further prompts. Signing in and npm's 2FA check on the first publish happen back to back; ticking "skip 2FA for 5 minutes" on that check covers the remaining publishes. Packages already on npm at that version are skipped, so after a failure just run it again.

`npm run release:taico:all` is the same with a bump step first, so it needs `--from`/`--to` and refuses to run once the release PR has already bumped the versions. Use `release:taico`.
