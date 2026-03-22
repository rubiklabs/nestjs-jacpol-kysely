# @rubiklabs/nestjs-jacpol-kysely

Kysely adapter for **[@rubiklabs/nestjs-jacpol](https://www.npmjs.com/package/@rubiklabs/nestjs-jacpol)** – store ABAC policies in PostgreSQL, MySQL or SQLite.

## Installation

```bash
npm install @rubiklabs/nestjs-jacpol-kysely
```

### Peer dependencies

| Package | Version |
|---|---|
| `@rubiklabs/nestjs-jacpol` | `^1.0.1` |
| `kysely` | `^0.28.14` |
| `@nestjs/common` | `^11.1.17` |

## Quick start

### 1. Run migrations

The package exports ready-to-use Kysely migrations:

```ts
import { Migrator } from 'kysely';
import { jacpolMigrations } from '@rubiklabs/nestjs-jacpol-kysely';

const migrator = new Migrator({
  db,
  provider: {
    getMigrations: async () =>
      Object.fromEntries(jacpolMigrations.map((m) => [m.name, m])),
  },
});

await migrator.migrateToLatest();
```

### 2. Register the module

```ts
import { Module } from '@nestjs/common';
import { JacpolModule } from '@rubiklabs/nestjs-jacpol';
import { JacpolKyselyModule } from '@rubiklabs/nestjs-jacpol-kysely';

@Module({
  imports: [
    JacpolModule.forRoot({ /* ... */ }),
    JacpolKyselyModule.forRoot({ db }), // your Kysely instance
  ],
})
export class AppModule {}
```

#### Async registration

```ts
JacpolKyselyModule.forRootAsync({
  imports: [DatabaseModule],
  inject: [KyselyService],
  useFactory: (kyselyService: KyselyService) => ({
    db: kyselyService.getDb(),
  }),
});
```

## API

### `JacpolKyselyModule`

| Method | Description |
|---|---|
| `forRoot(options)` | Synchronous registration with a Kysely instance |
| `forRootAsync(options)` | Async registration with factory pattern |

### `KyselyAdapter`

Implements `IPolicyAdapter` from `@rubiklabs/nestjs-jacpol`. Available methods:

- `getPolicySet(id)` / `getAllPolicySets()`
- `getPolicy(id)` / `getPoliciesByIds(ids)`
- `savePolicySet(policySet)` / `savePolicy(policy)`
- `upsertPolicySet(policySet)` / `upsertPolicy(policy)`
- `deletePolicySet(id)` / `deletePolicy(id)`
- `healthCheck()`

### Exports

```ts
// Schema types
export { JacpolDatabase, JacpolPolicySetTable, JacpolPolicyTable };
export { PolicySetRow, PolicyRow, PolicySetInsert, PolicyInsert };

// Adapter
export { KyselyAdapter, KyselyAdapterOptions };

// Module
export { JacpolKyselyModule, JacpolKyselyModuleOptions };

// Migrations
export { jacpolMigrations };
```

## License

MIT
