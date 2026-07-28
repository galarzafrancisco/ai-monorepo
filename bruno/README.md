# Taico Backend Bruno Collection

This collection covers the main Taico backend REST workflows: health checks, auth, metadata, tasks, threads, agents, context blocks, MCP registry, secrets, execution queues, task blueprints, scheduled tasks, search, and walkthrough status.

## Environments

- `Local Dev`: `http://localhost:3000`
- `Production`: `https://taico.app`

Set environment variables before running mutating requests:

- `email` / `password` for `Auth/Login`.
- `accessToken` after login, or paste a bearer token manually.
- Resource IDs such as `taskId`, `threadId`, `actorId`, `contextBlockId`, `serverId`, and `secretId` after creating or listing resources.

The login request includes a post-response script that stores `accessToken` when the response body contains `accessToken` or `token`.
