/**
 * NestJS module to register the Kysely adapter with JacpolModule.
 * Overrides the default adapter when imported after JacpolModule.
 */

import { DynamicModule, Module } from '@nestjs/common';
import { JACPOL_ADAPTER } from '@rubiklabs/nestjs-jacpol';
import { KyselyAdapter } from './kysely.adapter';
import type { Kysely } from 'kysely';
import type { JacpolDatabase } from './kysely.schema';

export interface JacpolKyselyModuleOptions {
  /** Kysely instance (e.g. new Kysely({ dialect: new PostgresDialect(...) })). */
  db: Kysely<JacpolDatabase>;
}

/**
 * Import after JacpolModule.forRoot() to use the Kysely adapter as the policy store.
 * Redis (if configured) continues to act as PRP cache; DB is the primary storage.
 */
@Module({})
export class JacpolKyselyModule {
  static forRoot(options: JacpolKyselyModuleOptions): DynamicModule {
    const adapter = new KyselyAdapter({ db: options.db });
    return {
      module: JacpolKyselyModule,
      global: true,
      providers: [{ provide: JACPOL_ADAPTER, useValue: adapter }],
      exports: [JACPOL_ADAPTER],
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => JacpolKyselyModuleOptions | Promise<JacpolKyselyModuleOptions>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: JacpolKyselyModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: JACPOL_ADAPTER,
          useFactory: async (...args: any[]) => {
            const opts = await options.useFactory(...args);
            return new KyselyAdapter({ db: opts.db });
          },
          inject: options.inject ?? [],
        },
      ],
      exports: [JACPOL_ADAPTER],
    };
  }
}
