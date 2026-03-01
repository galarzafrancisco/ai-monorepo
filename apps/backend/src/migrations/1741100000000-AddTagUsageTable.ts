import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddTagUsageTable1741100000000 implements MigrationInterface {
  name = 'AddTagUsageTable1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tag_usage table
    await queryRunner.createTable(
      new Table({
        name: 'tag_usage',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'tag_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'usage_count',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'last_used_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: "datetime('now')",
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: "datetime('now')",
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['tag_id'],
            referencedTableName: 'tags',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create unique index on tag_id to ensure one usage record per tag
    await queryRunner.createIndex(
      'tag_usage',
      new TableIndex({
        name: 'IDX_tag_usage_tag_id',
        columnNames: ['tag_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tag_usage', true);
  }
}
