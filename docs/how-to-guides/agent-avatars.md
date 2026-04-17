# Agent avatars

Agent avatars are managed in two places:

1. Add the bundled image asset under `apps/ui/public/avatar/`
2. Register the avatar in `apps/backend/src/agents/agent-avatar.library.ts`

The backend registration is the source of truth for what the UI can show in avatar pickers. Each entry needs:

- `id` - stable identifier used in code
- `label` - human-readable name shown in the UI
- `url` - relative path to the public asset
- `description` - short helper text for the picker

If you want a new avatar to become a default suggestion for a model or harness, update `getDefaultAgentAvatarUrl()` in the same backend file.

Template-specific defaults still live in `apps/backend/src/agents/agent-template.catalog.ts`.
