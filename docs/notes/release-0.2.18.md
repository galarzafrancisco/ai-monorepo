# Release 0.2.18 Readiness

## Scope

- Add the tasks project selector and project-scoped task board behavior from PR #945.
- Interrupt workers after stale execution pruning through the existing execution interrupt event path from PR #946.
- Drive OpenCode runner execution heartbeats from harness messages instead of the inherited periodic heartbeat from PR #947.

## Preparation Completed

- Bumped Taico workspace package versions and internal dependency ranges from `0.2.17` to `0.2.18`.
- Updated helper install references for the backend image and worker package to `0.2.18`.
- Rebuilt production artifacts with `npm run build:dev`, including OpenAPI/client generation and public UI assembly.
- Verified local dev startup with `npm run dev:3`; startup reached `http://localhost:2010` with the expected prompt context block initialization error.

## Remaining Release Steps

- Review and merge the release preparation PR.
- Run the publishing flow with `npm run release:taico` after merge and npm authentication.
- Confirm package/image publication for `0.2.18` and update deployment references as needed.
