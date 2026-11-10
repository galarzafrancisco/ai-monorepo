import { EntityManager } from 'typeorm';

/**
 * Serializes everything that takes one of an agent's concurrency slots
 * (queueing its tasks and claiming them) for the rest of the transaction,
 * so a count followed by an insert can't be raced past the limit.
 */
export async function lockAgentSlots(manager: EntityManager, agentActorId: string): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `agent-concurrency:${agentActorId}`,
  ]);
}
