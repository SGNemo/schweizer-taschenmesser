/**
 * Seed contract (test data). Every module declares `seed: SeedMeta` in its manifest and ships
 * `seed.ts` next to it (a `SeedModule`). The runner (`core/seed/dev.ts`) only exists in Dev-Preview
 * builds; this file holds types only, so importing it costs nothing in stable builds.
 */

export type SeedScale = 'small' | 'medium' | 'large';
export const SEED_SCALES: readonly SeedScale[] = ['small', 'medium', 'large'];

/** Manifest part of the contract (`ModuleManifest.seed`, required). */
export interface SeedMeta {
  /** Bump whenever `seed.ts` changes in a way that changes its output (E2E snapshots follow). */
  version: number;
  /** Modules whose seed data this module needs (they are seeded first and enabled with it). */
  dependsOn: readonly string[];
  /** Set for modules with no stored data (desktop live data); `seed.ts` then returns nothing. */
  none?: 'live-data';
}

/** Deterministic random numbers (mulberry32); one instance per module and run. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  chance(probability: number): boolean;
  shuffle<T>(list: readonly T[]): T[];
}

export interface SeedContext {
  rng: Rng;
  /** Reference date 'YYYY-MM-DD' ("today"); all dates are derived from it. */
  today: string;
  scale: SeedScale;
  /** `today` shifted by `days` ('YYYY-MM-DD'). */
  day(days: number): string;
  /** Epoch ms of local `today + days` at `time` ('HH:mm', default 12:00) – technical timestamps only. */
  at(days: number, time?: string): number;
  /** Picks the value for the current scale. */
  count<T = number>(by: Record<SeedScale, T>): T;
  /**
   * Stable record id. The same arguments always give the same id, also across modules, so a seed
   * can reference records of a module it depends on without importing it.
   */
  id(moduleId: string, collection: string, key: string | number): string;
}

export interface SeedRow {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Rows by collection. Keys are the module's own collection names; rows for a module listed in
 * `dependsOn` use `<moduleId>.<collection>` (e.g. invoices booking `finance.transaction`).
 */
export type SeedRows = Record<string, SeedRow[]>;

/** What `src/modules/<id>/seed.ts` exports. */
export interface SeedModule {
  seed(ctx: SeedContext): SeedRows;
  /**
   * Runs after the rows are written, for data that cannot be plain rows (the vault demo). May only
   * use the module's own API. Returns the ids of the records it created, so removal can find them.
   */
  afterSeed?(ctx: SeedContext): Promise<{ collection: string; ids: string[] }[] | void>;
  /** Undoes `afterSeed` side effects other than rows (called on removal). */
  beforeRemove?(): Promise<void>;
}
