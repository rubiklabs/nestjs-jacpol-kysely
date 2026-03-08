/**
 * Initial migration: policy_set and policy tables.
 * Run with your own migrator; export jacpolMigrations for convenience.
 */

import type { Kysely } from 'kysely';

export const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .createTable('policy_set')
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('target', 'text')
    .addColumn('algorithm', 'varchar(64)')
    .addColumn('priority', 'integer')
    .addColumn('obligation', 'text')
    .addColumn('created_at', 'varchar(32)', (col) => col.notNull())
    .addColumn('updated_at', 'varchar(32)', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('policy')
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('policy_set_id', 'varchar(255)', (col) =>
      col.references('policy_set.id').onDelete('cascade').notNull(),
    )
    .addColumn('target', 'text')
    .addColumn('rules', 'text', (col) => col.notNull())
    .addColumn('algorithm', 'varchar(64)')
    .addColumn('priority', 'integer')
    .addColumn('obligation', 'text')
    .addColumn('created_at', 'varchar(32)', (col) => col.notNull())
    .addColumn('updated_at', 'varchar(32)', (col) => col.notNull())
    .execute();
};

export const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.dropTable('policy').execute();
  await db.schema.dropTable('policy_set').execute();
};
