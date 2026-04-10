# @taico/worker

Runtime for the Taico worker.

This worker talks to a Taico server. You can get a Taico server from the `ai-monorepo` container packages:

https://github.com/galarzafrancisco/ai-monorepo/pkgs/container/ai-monorepo

## Start

```bash
npx @taico/worker --serverurl {your_taico_server_url}
```

## Options

- `--credentials-path` overrides the credentials file location. Default: `~/.taico/worker-credentials.json`
- `--working-directory` overrides the workspace root used by the worker. Default: `~/.taico/workspaces`

## Security Warning

This worker spins up agents with dangerously skip permissions on whatever host you run it from. Only run it on a machine you trust for that level of access.

## Supported agent runtimes

The worker supports:

- GitHub Copilot
- OpenCode
- Google ADK
- Claude

For OpenCode, GitHub Copilot, and Claude, you need to start those apps first and configure your login there. The Taico worker inherits whatever local app configuration and authentication you already have.

## Google ADK

For Google ADK, the worker connects using your `gcloud` default application credentials.

Before starting the worker, export:

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_CLOUD_LOCATION="your-location"
export GOOGLE_GENAI_USE_VERTEXAI="True"
```
