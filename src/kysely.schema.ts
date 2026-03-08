/**
 * Kysely schema for JACPoL policy_set and policy tables.
 * Rules are stored as JSON array inside policy.rules.
 */

import type { Selectable, Insertable, Updateable } from 'kysely';

export interface JacpolPolicySetTable {
  id: string;
  target: string | null;
  algorithm: string | null;
  priority: number | null;
  obligation: string | null;
  created_at: string;
  updated_at: string;
}

export interface JacpolPolicyTable {
  id: string;
  policy_set_id: string;
  target: string | null;
  rules: string;
  algorithm: string | null;
  priority: number | null;
  obligation: string | null;
  created_at: string;
  updated_at: string;
}

export interface JacpolDatabase {
  policy_set: JacpolPolicySetTable;
  policy: JacpolPolicyTable;
}

export type PolicySetRow = Selectable<JacpolPolicySetTable>;
export type PolicyRow = Selectable<JacpolPolicyTable>;
export type PolicySetInsert = Insertable<JacpolPolicySetTable>;
export type PolicyInsert = Insertable<JacpolPolicyTable>;
