import type { Kysely } from 'kysely';
import { KyselyAdapter } from '../src/kysely.adapter';
import type { JacpolDatabase } from '../src/kysely.schema';

/** Minimal Kysely mock that returns empty results and no-ops for writes. */
function createMinimalMock(): Kysely<JacpolDatabase> {
  return ({
    selectFrom: () =>
      ({
        select: () => ({ limit: () => ({ execute: async () => [] }) }),
        leftJoin: () =>
          ({
            where: () =>
              ({
                selectAll: () =>
                  ({
                    select: () =>
                      ({
                        execute: async () => [],
                        orderBy: () => ({ orderBy: () => ({ execute: async () => [] }) }),
                      }),
                  }),
              }),
            selectAll: () =>
              ({
                select: () =>
                  ({
                    orderBy: () => ({ orderBy: () => ({ execute: async () => [] }) }),
                  }),
              }),
            limit: () => ({ execute: async () => [] }),
          }),
        where: () =>
          ({
            selectAll: () =>
              ({
                executeTakeFirst: async () => null,
                select: () => ({ executeTakeFirst: async () => null }),
              }),
            select: () => ({ where: () => ({ executeTakeFirst: async () => null }) }),
            execute: async () => {},
          }),
        insertInto: () =>
          ({
            values: () =>
              ({
                execute: async () => {},
                onConflict: () => ({ doUpdateSet: () => ({ execute: async () => {} }), execute: async () => {} }),
              }),
          }),
        deleteFrom: () =>
          ({
            where: () => ({ execute: async () => {} }),
          }),
        transaction: () =>
          ({
            execute: async (fn: (trx: any) => Promise<void>) => {
              const trx = {
                insertInto: () => ({ values: () => ({ execute: async () => {} }) }),
                deleteFrom: () => ({ where: () => ({ execute: async () => {} }) }),
              };
              await fn(trx);
            },
          }),
        destroy: async () => {},
      } as any)
  }) as unknown as Kysely<JacpolDatabase>;
}

describe('KyselyAdapter', () => {
  it('instantiates with Kysely db', () => {
    const db = createMinimalMock();
    const adapter = new KyselyAdapter({ db });
    expect(adapter).toBeDefined();
  });

  it('getPolicySet returns null when empty', async () => {
    const db = createMinimalMock();
    const adapter = new KyselyAdapter({ db });
    expect(await adapter.getPolicySet('any-id')).toBeNull();
  });

  it('getAllPolicySets returns empty array when empty', async () => {
    const db = createMinimalMock();
    const adapter = new KyselyAdapter({ db });
    expect(await adapter.getAllPolicySets()).toEqual([]);
  });

  it('getPolicy returns null when not found', async () => {
    const db = createMinimalMock();
    const adapter = new KyselyAdapter({ db });
    expect(await adapter.getPolicy('any-id')).toBeNull();
  });

  it('getPoliciesByIds returns empty array for empty input', async () => {
    const db = createMinimalMock();
    const adapter = new KyselyAdapter({ db });
    expect(await adapter.getPoliciesByIds([])).toEqual([]);
  });

  it('healthCheck returns true when select succeeds', async () => {
    const db = createMinimalMock();
    const adapter = new KyselyAdapter({ db });
    expect(await adapter.healthCheck()).toBe(true);
  });
});
