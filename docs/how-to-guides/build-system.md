# Build System

The monorepo uses [nx](https://nx.dev) to drive builds. nx walks the dependency graph (inferred from `package.json` workspace deps + per-project `project.json` overrides), runs tasks in parallel where possible, and caches results by content hash so unchanged projects skip entirely.

For the dependency graph itself, see [dependencies.md](../../dependencies.md).

## Top-level commands

```bash
npm run build:dev      # cloned -> ready to dev: npm ci + full prod build
npm run build:prod     # full prod build via nx (used by CI and Dockerfile)
npm run dev            # backend + ui-v1 + ui in watch mode (no nx involvement)
npm run graph          # opens the nx dependency graph in your browser
npm run affected:build # build only projects affected since main
npm run affected:test  # test only projects affected since main
```

Both `build:dev` and `build:prod` are safe to re-run — cached tasks return in milliseconds.

## How nx is wired here

### `nx.json`

Workspace-wide config. Defines:

- **`namedInputs.production`** — what counts as a "production input" for cache hashing. Excludes tests, configs, docs, `dist/`, `coverage/`, `.nx/`, `*.tsbuildinfo`. If you add a new artifact path that builds produce but shouldn't pollute their own input hash, exclude it here.
- **`targetDefaults`** — defaults applied to any project's `build`, `build:prod`, `typecheck`, `lint`, `test` target. The important ones: `dependsOn: ["^build"]` (build deps first) and `inputs: ["production", "^production"]` (hash own + dep production files).

### Per-project `project.json`

Most projects don't need one — nx infers targets from `package.json` scripts. We only override where inference can't see the truth:

- **`apps/backend/project.json`** — declares `openapi.json` as a `build:prod` output (so the cache captures it), and defines the `assemble-public` target (see below).
- **`packages/client/project.json`** — declares `implicitDependencies: [@taico/taico, @taico/openapi-sdkgen]` because client's `build:prod` needs them but they're not in client's `package.json` deps. Also declares `apps/backend/openapi.json` as an input so client's cache busts when the spec changes, and lists the generated source dirs as outputs.
- **`apps/ui/project.json`**, **`apps/ui-v1/project.json`** — minimal stubs with just the project name. Kept as anchor points in case targets need overrides later.

### The `assemble-public` target

`apps/backend/dist/public/` is the static frontend bundle served by the backend in prod. Both `apps/ui` and `apps/ui-v1` contribute, but neither owns the path.

Instead, `apps/backend` has a dedicated `assemble-public` target (declared in `apps/backend/project.json`, script in `apps/backend/package.json`) that:

1. `dependsOn` `@taico/ui:build:prod`, `@taico/ui-v1:build:prod`, and its own `build:prod`
2. Copies `apps/ui/dist` → `apps/backend/dist/public`
3. Copies `apps/ui-v1/dist` → `apps/backend/dist/public/beta`
4. Declares `apps/backend/dist/public` as its (sole) output

This is the only writer of `dist/public/`. ui and ui-v1 only own their own `dist/`.

If you ever need to change what gets bundled into `public/`, edit the `assemble-public` script and add the upstream project to the target's `dependsOn` and `inputs`.

## Adding a new package

Most additions need no nx config:

1. Create the package under `packages/<name>` or `apps/<name>` with a `package.json` that has a `build` and (if used in prod builds) `build:prod` script.
2. If other workspaces depend on it, declare the dep in their `package.json` — nx auto-detects.
3. Run `npm install` to wire up the workspace symlinks.

That's it. nx infers `build`, `build:prod`, `lint`, `test`, `typecheck` from the scripts and applies the defaults from `nx.json`.

You only need a `project.json` if:

- The project has an **implicit dependency** that isn't in `package.json` (file artifacts, generated code, etc.) — declare via `implicitDependencies`.
- Some target produces or consumes paths **outside** the project — declare via `outputs` / `inputs`.
- A target needs overrides not expressible in `nx.json` defaults.

## Cache behavior

nx caches by content hash. A task's hash is derived from:

- Source files matching the target's declared `inputs` (own + transitively from `^production`)
- Project graph (deps)
- Target config (script, env, etc.)

A cache hit means nx restores the declared `outputs` from the local cache (`.nx/cache`) and skips running the script. Outputs declared as paths outside `projectRoot` work — they're restored to wherever you declared them.

**Bust the cache** when you suspect a stale hit:

```bash
npx nx reset                       # nuke .nx/cache + project graph cache
npm run build:prod                 # rebuild from scratch
```

**Diagnose what ran vs cached** by inspecting the summary nx prints (`Nx read the output from the cache instead of running the command for X out of N tasks`). Run with `--verbose` for per-task hash breakdowns.

## CI

`.github/workflows/test.yml` does:

1. `npm ci`
2. `actions/cache@v4` restore for `.nx/cache` (key by SHA, prefix-restore)
3. `npm run build:prod` (cache hits replace skipped builds, so artifacts always exist for downstream steps)
4. `npx nx run @taico/openapi-sdkgen:test`
5. E2E tests via `npm -w apps/backend run test:e2e` (bypasses nx — see "Known limits")

For sharing cache across runners (bigger payoff than per-run restore), run `npx nx connect` once to enable Nx Cloud (free tier).

## Docker

The Dockerfile uses a BuildKit cache mount for `.nx/cache`:

```dockerfile
RUN --mount=type=cache,target=/workdir/.nx/cache npm run build:prod
```

This persists nx cache across image builds when running with BuildKit (`DOCKER_BUILDKIT=1`, default in Docker 23+ and GitHub Actions buildx).

## Troubleshooting

**"Why did my build re-run when I didn't change anything?"** — Something in the project's `inputs` glob changed. Common culprits: a `dist/` from a prior build (should be excluded), an editor temp file, a generated file not in `.gitignore`. Add it to the `production` named input as an exclusion in `nx.json`.

**"Why did the cache restore wrong files?"** — Two tasks declared overlapping `outputs`. Restoration order is non-deterministic. Refactor so each path is owned by exactly one task (the `assemble-public` pattern).

**"Local hash differs from CI hash."** — Some file is hashed locally but not in CI (or vice versa). Check `.gitignore` — if a file is gitignored on one side and present on the other, the hashes diverge. Either commit it or exclude from `inputs`.

**"`nx graph` shows wrong deps."** — Missing `implicitDependencies` in `project.json`. nx only sees what's declared in `package.json` deps + explicit overrides.

**"Nx Console install prompt keeps appearing."** — One-time interactive prompt. Answer Y or N once; the marker persists. Set `CI=1` to suppress without committing to either answer.

**"`nx-daemon` process lingering."** — `npx nx daemon --stop`. nx auto-disables the daemon in CI.

## Known limits

- **E2E tests bypass nx by design.** They have SQLite side effects and aren't safe to cache. They always run in CI.
- **`openapi-sdkgen:test` mutates the workspace** (`clean && generate && lint && run`). Cache hit means "passed before, skip" — fine for CI, but if you later run `node test/run.mjs` standalone after a hit, the generated files won't exist on disk.
- **Generated client sources are committed** (`packages/client/src/v1/client/`, `src/v2/`, `contracts/`). Builds regenerate them, so a fresh checkout looks "modified" after building. Doesn't break caching (they're stable across machines because committed) but is noisy.
- **No remote cache yet.** Each CI run benefits only from its own restored `.nx/cache`. Sign up for Nx Cloud (`npx nx connect`) to share cache across runners.
