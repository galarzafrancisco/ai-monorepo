# Taico Backend Bruno Collection

This collection covers the main Taico backend REST workflows: health checks, auth, metadata, tasks, threads, agents, context blocks, MCP registry, secrets, execution queues, task blueprints, scheduled tasks, search, and walkthrough status.

## Environments

- `Local Dev`: `http://localhost:2003` for `npm run dev:1`
- `Production`: `https://taico.app`

Set environment variables before running mutating requests:

- `email` / `password` for `Auth/Login`.
- Resource IDs such as `taskId`, `threadId`, `actorId`, `contextBlockId`, `serverId`, and `secretId` after creating or listing resources.

Run `Auth/Login` first for cookie-authenticated requests. The backend sets httpOnly auth cookies, so Bruno should send the stored cookies on subsequent requests when its cookie jar is enabled.
