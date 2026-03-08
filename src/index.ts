/**
 * @rubiklabs/nestjs-jacpol-kysely
 */

export * from './kysely.schema';
export * from './kysely.adapter';
export * from './kysely.module';
import * as migration001 from './migrations/001_initial';

/** Migrations to run with your Kysely migrator. */
export const jacpolMigrations = [
  { name: '001_initial', up: migration001.up, down: migration001.down },
];
