import { MigrationInterface, QueryRunner } from 'typeorm';
import { seededFollowUpFor } from '../app-init/seeded-follow-ups';

type StoredAgent = {
  id: string;
  slug: string;
  system_prompt: string | null;
};

/**
 * Gives agents that predate follow-up prompts the one of the built-in or
 * template they came from. This has to run exactly once: afterwards, null means
 * someone cleared the prompt, so filling it in again would undo that.
 */
export class BackfillAgentFollowUpPrompts1763300000001
  implements MigrationInterface
{
  name = 'BackfillAgentFollowUpPrompts1763300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const agents: StoredAgent[] = await queryRunner.query(
      `SELECT "agents"."id", "actors"."slug", "agents"."system_prompt"
       FROM "agents"
       JOIN "actors" ON "actors"."id" = "agents"."actor_id"
       WHERE "agents"."follow_up_prompt" IS NULL`,
    );

    for (const agent of agents) {
      const followUpPrompt = seededFollowUpFor({
        slug: agent.slug,
        systemPrompt: agent.system_prompt,
      });
      if (!followUpPrompt) continue;
      await queryRunner.query(
        `UPDATE "agents" SET "follow_up_prompt" = $1 WHERE "id" = $2`,
        [followUpPrompt, agent.id],
      );
    }
  }

  // Nothing to undo: the previous migration's down drops the column.
  public async down(): Promise<void> {}
}
