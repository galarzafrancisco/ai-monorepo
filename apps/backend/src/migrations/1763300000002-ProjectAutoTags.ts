import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectAutoTags1763300000002 implements MigrationInterface {
  name = 'ProjectAutoTags1763300000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
       CREATE TABLE IF NOT EXISTS project_auto_tags (
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, tag_id)
      )
    `);
    await queryRunner.query(`
       CREATE TABLE IF NOT EXISTS task_auto_tags (
        task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        applied boolean NOT NULL DEFAULT false,
        PRIMARY KEY (task_id, project_id, tag_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE task_auto_tags');
    await queryRunner.query('DROP TABLE project_auto_tags');
  }
}
