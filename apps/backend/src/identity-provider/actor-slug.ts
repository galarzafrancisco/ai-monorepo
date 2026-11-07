import { EntityManager } from 'typeorm';
import { ActorType } from './enums';

/**
 * Someone who wants to write an actor's slug. A person's slug is unique
 * across the installation, because a person can join any workspace. An
 * agent's slug is unique in its workspace, so each workspace can have its own
 * `@claude-dev`, but it may never be a person's slug.
 */
export type ActorSlugClaim =
  | { type: ActorType.HUMAN; slug: string; selfActorId?: string }
  | {
      type: ActorType.AGENT;
      slug: string;
      workspaceId: string;
      selfActorId?: string;
    };

/**
 * Every write of an actor's slug (create or rename, person or agent) goes
 * through here, inside the transaction that saves the actor. It takes a
 * transaction-scoped advisory lock on the slug, so writers of the same slug
 * are serialized until the transaction ends, then says whether the slug is
 * free for this actor:
 * - a person's slug conflicts with any other actor's;
 * - an agent's slug conflicts with a person's, or with any other actor that
 *   is a member of its workspace (which also catches actors without an agent
 *   row).
 *
 * `manager` must be inside a transaction: outside one, the lock is released
 * as soon as the query returns.
 */
export async function claimActorSlug(
  manager: EntityManager,
  claim: ActorSlugClaim,
): Promise<boolean> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `actor-slug:${claim.slug}`,
  ]);
  const agentWorkspaceId =
    claim.type === ActorType.AGENT ? claim.workspaceId : null;
  const [conflict] = await manager.query(
    `SELECT 1 FROM actors a
      WHERE a.slug = $1
        AND ($2::uuid IS NULL OR a.id <> $2::uuid)
        AND ($3::uuid IS NULL
             OR a.type <> '${ActorType.AGENT}'
             OR EXISTS (SELECT 1 FROM workspace_members m
                         WHERE m.actor_id = a.id AND m.workspace_id = $3::uuid))
      LIMIT 1`,
    [claim.slug, claim.selfActorId ?? null, agentWorkspaceId],
  );
  return !conflict;
}
