# Token On-Behalf-Of Analysis

Date: 2026-02-18

## Question

Can Taico issue tokens where a system agent acts as itself while preserving that it is acting on behalf of a human?

## Finding

Taico currently supports this only partially.

- Supported now: agent-as-subject execution with human issuer traceability.
- Not fully supported now: first-class delegated authorization where both principals are part of policy evaluation.

## Evidence

1. Token claims include a single subject identity plus optional issuer audit data.
   - `sub`, `actor_id`, `actor_slug`, `actor_type`
   - optional `issued_by`
   - Source: `apps/backend/src/auth/core/types/access-token-claims.type.ts`

2. Manual token issuance for agents is implemented and records issuer.
   - Human can issue agent token through `agents/:slug/tokens`.
   - Issued token sets `sub` and `actor_*` to the subject actor, with `issued_by` set to the human issuer.
   - Sources:
     - `apps/backend/src/agents/agent-tokens.controller.ts`
     - `apps/backend/src/authorization-server/issued-access-token.service.ts`

3. Runtime authorization uses the subject actor and scopes, not delegation semantics.
   - `AccessTokenGuard` derives `subject` from `claims.sub` and scopes from `claims.scope`.
   - `CurrentUser` resolves current actor from `claims.actor_*`.
   - `issued_by` is not used in authorization decisions.
   - Sources:
     - `apps/backend/src/auth/guards/guards/access-token.guard.ts`
     - `apps/backend/src/auth/guards/decorators/current-user.decorator.ts`

4. Token exchange endpoint exists but does not model dual principal exchange.
   - Request supports `subject_token` only.
   - No `actor_token` / `actor_token_type` handling.
   - Sources:
     - `apps/backend/src/authorization-server/dto/token-exchange-request.dto.ts`
     - `apps/backend/src/authorization-server/token-exchange.service.ts`

## Practical interpretation

Current behavior is best described as:

- Effective principal: agent subject (`sub` / `actor_*`)
- Provenance metadata: human issuer (`issued_by`)

This is strong for auditability, but not equivalent to full delegated authorization.

## What would be needed for true on-behalf-of support

1. Extend token model with explicit delegation claims.
2. Extend token exchange contract to support actor/delegation inputs.
3. Add policy enforcement that evaluates both delegating actor and subject actor.
4. Add delegation-aware consent and scope constraints.
5. Expose delegation metadata in introspection.
