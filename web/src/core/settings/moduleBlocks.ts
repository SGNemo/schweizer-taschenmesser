/**
 * The fixed layout of a module's settings page: General · Display · Notifications · Data · Advanced.
 * Pure helpers, so the structure and the "changed from default" count are tested without a UI.
 */
import type { SettingField } from '@/core/modules/types';
import { MODULE_FIELD_GROUPS, type ModuleFieldGroup } from './registry/types';

export interface FieldBlock {
  group: ModuleFieldGroup;
  fields: SettingField[];
}

/** Block of one field: `advanced` level or group → Advanced, else its group, default General. */
export function blockOf(f: Pick<SettingField, 'group' | 'level'>): ModuleFieldGroup {
  if (f.level === 'advanced' || f.group === 'advanced') return 'advanced';
  return f.group ?? 'general';
}

/**
 * Fields split into blocks in the fixed order, field order kept inside a block. Empty blocks are
 * left out, except `data` when `withData` (start data and schema live there even without fields).
 */
export function fieldBlocks(fields: readonly SettingField[], withData = false): FieldBlock[] {
  return MODULE_FIELD_GROUPS.flatMap((group) => {
    const own = fields.filter((f) => blockOf(f) === group);
    return own.length > 0 || (withData && group === 'data') ? [{ group, fields: own }] : [];
  });
}

/** Keys of the fields whose stored value differs from the module's default. */
export function changedKeys(
  fields: readonly SettingField[],
  values: Readonly<Record<string, unknown>>,
  defaults: Readonly<Record<string, unknown>>,
): string[] {
  return fields.filter((f) => !sameValue(values[f.key], defaults[f.key])).map((f) => f.key);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
