import { MigrationInterface, QueryRunner } from 'typeorm';
import { currentFollowUpFor } from '../app-init/seeded-follow-ups';

type StoredAgent = {
  id: string;
  follow_up_prompt: string;
};

/**
 * Moves agents off the seeded follow-ups that asked for a task comment about
 * every step that didn't apply. Only follow-ups nobody edited are replaced.
 */
export class SilentAgentFollowUpPrompts1763300000003
  implements MigrationInterface
{
  name = 'SilentAgentFollowUpPrompts1763300000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const agents: StoredAgent[] = await queryRunner.query(
      `SELECT "id", "follow_up_prompt"
       FROM "agents"
       WHERE "follow_up_prompt" IS NOT NULL`,
    );

    for (const agent of agents) {
      const followUpPrompt = currentFollowUpFor(agent.follow_up_prompt);
      if (!followUpPrompt) continue;
      await queryRunner.query(
        `UPDATE "agents" SET "follow_up_prompt" = $1 WHERE "id" = $2`,
        [followUpPrompt, agent.id],
      );
    }
  }

  // Nothing to undo: the old text isn't kept per agent, and the new one is safe.
  public async down(): Promise<void> {}
}
