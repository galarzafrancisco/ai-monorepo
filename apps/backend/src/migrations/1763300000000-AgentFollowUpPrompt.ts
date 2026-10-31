import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional prompt sent to an agent after it finishes its turn. Existing agents
 * start with none; the next migration fills in the seeded ones.
 */
export class AgentFollowUpPrompt1763300000000 implements MigrationInterface {
  name = 'AgentFollowUpPrompt1763300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "follow_up_prompt" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "follow_up_prompt"`,
    );
  }
}
