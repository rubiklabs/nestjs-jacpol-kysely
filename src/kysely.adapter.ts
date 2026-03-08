/**
 * Kysely-backed policy adapter. Implements IPolicyAdapter.
 * PolicySet + Policy loaded via JOIN; rules stored as JSON in policy.rules.
 */

import type { Kysely } from 'kysely';
import type { IPolicyAdapter } from '@rubiklabs/nestjs-jacpol';
import type { Policy, PolicySet } from '@rubiklabs/nestjs-jacpol';
import type { JacpolDatabase } from './kysely.schema';

function parseJson<T>(raw: string | null): T | null {
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function now(): string {
  return new Date().toISOString();
}

export interface KyselyAdapterOptions {
  /** Kysely instance (with dialect already set). */
  db: Kysely<JacpolDatabase>;
  /** Use dialect-specific upsert. Default true. */
  useUpsert?: boolean;
}

/**
 * Adapter that stores PolicySet and Policy in Kysely (PostgreSQL, MySQL, SQLite).
 * Rules are embedded in policy.rules as JSON.
 */
export class KyselyAdapter implements IPolicyAdapter {
  constructor(private readonly options: KyselyAdapterOptions) {}

  private get db(): Kysely<JacpolDatabase> {
    return this.options.db;
  }

  /** @inheritdoc */
  async getPolicySet(id: string): Promise<PolicySet | null> {
    const rows = await this.db
      .selectFrom('policy_set as ps')
      .leftJoin('policy as p', 'p.policy_set_id', 'ps.id')
      .where('ps.id', '=', id)
      .selectAll('ps')
      .select(['p.id as p_id', 'p.target as p_target', 'p.rules as p_rules', 'p.algorithm as p_algorithm', 'p.priority as p_priority', 'p.obligation as p_obligation'])
      .execute();

    if (rows.length === 0) return null;
    return this.rowsToPolicySet(rows);
  }

  /** @inheritdoc */
  async getPolicy(id: string): Promise<Policy | null> {
    const row = await this.db
      .selectFrom('policy')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst();
    if (!row) return null;
    return this.rowToPolicy(row);
  }

  /** @inheritdoc */
  async getAllPolicySets(): Promise<PolicySet[]> {
    const rows = await this.db
      .selectFrom('policy_set as ps')
      .leftJoin('policy as p', 'p.policy_set_id', 'ps.id')
      .selectAll('ps')
      .select(['p.id as p_id', 'p.target as p_target', 'p.rules as p_rules', 'p.algorithm as p_algorithm', 'p.priority as p_priority', 'p.obligation as p_obligation'])
      .orderBy('ps.id')
      .orderBy('p.id')
      .execute();

    const byPsId = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byPsId.get(r.id) ?? [];
      list.push(r);
      byPsId.set(r.id, list);
    }
    return Array.from(byPsId.values()).map((group) => this.rowsToPolicySet(group));
  }

  /** @inheritdoc */
  async getPoliciesByIds(ids: string[]): Promise<Policy[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .selectFrom('policy')
      .where('id', 'in', ids)
      .selectAll()
      .execute();
    return rows.map((r) => this.rowToPolicy(r));
  }

  /** @inheritdoc */
  async savePolicySet(policySet: PolicySet): Promise<void> {
    const ts = now();
    await this.db
      .insertInto('policy_set')
      .values({
        id: policySet.id,
        target: policySet.target != null ? JSON.stringify(policySet.target) : null,
        algorithm: policySet.algorithm ?? null,
        priority: policySet.priority ?? null,
        obligation: policySet.obligation != null ? JSON.stringify(policySet.obligation) : null,
        created_at: ts,
        updated_at: ts,
      })
      .execute();
    for (const p of policySet.policies ?? []) {
      await this.savePolicyRow(p, policySet.id, ts);
    }
  }

  /** @inheritdoc */
  async savePolicy(policy: Policy): Promise<void> {
    const ts = now();
    const setId = await this.db
      .selectFrom('policy')
      .where('id', '=', policy.id)
      .select('policy_set_id')
      .executeTakeFirst();
    if (!setId) throw new Error(`Policy ${policy.id} not found`);
    await this.savePolicyRow(policy, setId.policy_set_id, ts);
  }

  /** @inheritdoc */
  async upsertPolicySet(policySet: PolicySet): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const ts = now();
      const row = {
        id: policySet.id,
        target: policySet.target != null ? JSON.stringify(policySet.target) : null,
        algorithm: policySet.algorithm ?? null,
        priority: policySet.priority ?? null,
        obligation: policySet.obligation != null ? JSON.stringify(policySet.obligation) : null,
        created_at: ts,
        updated_at: ts,
      };
      await trx
        .insertInto('policy_set')
        .values(row)
        .onConflict((oc) => oc.column('id').doUpdateSet({
          target: row.target,
          algorithm: row.algorithm,
          priority: row.priority,
          obligation: row.obligation,
          updated_at: ts,
        }))
        .execute();

      await trx.deleteFrom('policy').where('policy_set_id', '=', policySet.id).execute();

      for (const p of policySet.policies ?? []) {
        await this.insertPolicyRow(trx, p, policySet.id, ts);
      }
    });
  }

  /** @inheritdoc */
  async upsertPolicy(policy: Policy): Promise<void> {
    const setId = await this.db.selectFrom('policy').where('id', '=', policy.id).select('policy_set_id').executeTakeFirst();
    if (!setId) return;
    const ts = now();
    await this.savePolicyRow(policy, setId.policy_set_id, ts);
  }

  /** @inheritdoc */
  async deletePolicySet(id: string): Promise<void> {
    await this.db.deleteFrom('policy').where('policy_set_id', '=', id).execute();
    await this.db.deleteFrom('policy_set').where('id', '=', id).execute();
  }

  /** @inheritdoc */
  async deletePolicy(id: string): Promise<void> {
    await this.db.deleteFrom('policy').where('id', '=', id).execute();
  }

  /** @inheritdoc */
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.selectFrom('policy_set').select('id').limit(1).execute();
      return true;
    } catch {
      return false;
    }
  }

  private rowToPolicy(r: { id: string; target: string | null; rules: string; algorithm: string | null; priority: number | null; obligation: string | null }): Policy {
    return {
      id: r.id,
      target: parseJson(r.target) ?? undefined,
      rules: parseJson(r.rules) ?? [],
      algorithm: (r.algorithm as Policy['algorithm']) ?? undefined,
      priority: r.priority ?? undefined,
      obligation: parseJson(r.obligation) ?? undefined,
    };
  }

  private rowsToPolicySet(rows: Array<{ id: string; target: string | null; algorithm: string | null; priority: number | null; obligation: string | null; p_id: string | null; p_target: string | null; p_rules: string | null; p_algorithm: string | null; p_priority: number | null; p_obligation: string | null }>): PolicySet {
    const first = rows[0];
    const policies: Policy[] = [];
    for (const r of rows) {
      if (r.p_id != null && r.p_rules != null) {
        policies.push(this.rowToPolicy({
          id: r.p_id,
          target: r.p_target,
          rules: r.p_rules,
          algorithm: r.p_algorithm,
          priority: r.p_priority,
          obligation: r.p_obligation,
        }));
      }
    }
    return {
      id: first.id,
      target: parseJson(first.target) ?? undefined,
      algorithm: (first.algorithm as PolicySet['algorithm']) ?? undefined,
      priority: first.priority ?? undefined,
      obligation: parseJson(first.obligation) ?? undefined,
      policies,
    };
  }

  private async savePolicyRow(policy: Policy, policySetId: string, ts: string): Promise<void> {
    await this.db
      .insertInto('policy')
      .values({
        id: policy.id,
        policy_set_id: policySetId,
        target: policy.target != null ? JSON.stringify(policy.target) : null,
        rules: JSON.stringify(policy.rules ?? []),
        algorithm: policy.algorithm ?? null,
        priority: policy.priority ?? null,
        obligation: policy.obligation != null ? JSON.stringify(policy.obligation) : null,
        created_at: ts,
        updated_at: ts,
      })
      .onConflict((oc) => oc.column('id').doUpdateSet({
        target: policy.target != null ? JSON.stringify(policy.target) : null,
        rules: JSON.stringify(policy.rules ?? []),
        algorithm: policy.algorithm ?? null,
        priority: policy.priority ?? null,
        obligation: policy.obligation != null ? JSON.stringify(policy.obligation) : null,
        updated_at: ts,
      }))
      .execute();
  }

  private async insertPolicyRow(
    trx: Kysely<JacpolDatabase>,
    policy: Policy,
    policySetId: string,
    ts: string,
  ): Promise<void> {
    await trx
      .insertInto('policy')
      .values({
        id: policy.id,
        policy_set_id: policySetId,
        target: policy.target != null ? JSON.stringify(policy.target) : null,
        rules: JSON.stringify(policy.rules ?? []),
        algorithm: policy.algorithm ?? null,
        priority: policy.priority ?? null,
        obligation: policy.obligation != null ? JSON.stringify(policy.obligation) : null,
        created_at: ts,
        updated_at: ts,
      })
      .execute();
  }
}
