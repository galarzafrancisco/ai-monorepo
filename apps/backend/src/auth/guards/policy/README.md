Purpose: authorization rules (scopes, resource ownership, etc).

require-scopes.decorator.ts

@RequireScopes('task.read', 'task.write')

scopes.guard.ts

checks the current AuthContext has required scopes

optional: ownership/ if you do task belongs to user checks in auth layer

Why: split “who are you?” from “are you allowed to do this?”