import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePlannerPlanTagTrigger1742800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE agents
      SET tag_triggers = ''
      WHERE actor_id IN (
        SELECT id FROM actors WHERE slug = 'planner'
      )
      AND tag_triggers = 'plan'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE agents
      SET tag_triggers = 'plan'
      WHERE actor_id IN (
        SELECT id FROM actors WHERE slug = 'planner'
      )
      AND tag_triggers = ''
    `);
  }
}
