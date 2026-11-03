/**
 * Calm notes under a security-relevant setting once it is moved to the weaker side. A table keyed
 * by field anchor (`<section>--<field>`), so module settings need no extra contract. The note
 * informs, it never blocks: the choice stays the person's.
 */
export type FieldWarning = 'autoLockLong' | 'backgroundDelay';

const RULES: Readonly<Record<string, (value: unknown) => FieldWarning | undefined>> = {
  'module-accounts--autoLockMinutes': (v) => (v === '30' ? 'autoLockLong' : undefined),
  'module-accounts--backgroundLock': (v) => (v === '30s' ? 'backgroundDelay' : undefined),
};

export function warningFor(fieldId: string, value: unknown): FieldWarning | undefined {
  return RULES[fieldId]?.(value);
}
