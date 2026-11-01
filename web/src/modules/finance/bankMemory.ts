/**
 * What the bank import remembers on this device (`_meta`, not synced): the column assignment the
 * user made for a CSV layout nobody knows, keyed by the header signature, so the next export of the
 * same bank is read without a question.
 */
import { bankHeaderSignature, type BankColumnMapping } from '@/core/io/bank';
import { getMeta, setMeta } from '@/core/db/metaKv';

export const BANK_MAPPINGS_KEY = 'finance.bankMappings';

export type StoredMapping = BankColumnMapping & { delimiter?: ';' | ',' | '\t' };

const MAX_MAPPINGS = 30;

export { bankHeaderSignature };

function valid(m: unknown): m is StoredMapping {
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof (m as StoredMapping).date === 'string' &&
    typeof (m as StoredMapping).amount === 'string'
  );
}

export async function loadBankMapping(signature: string): Promise<StoredMapping | undefined> {
  const all = await getMeta<Record<string, unknown>>(BANK_MAPPINGS_KEY);
  const m = all?.[signature];
  return valid(m) ? m : undefined;
}

export async function saveBankMapping(signature: string, mapping: StoredMapping): Promise<void> {
  const all = (await getMeta<Record<string, StoredMapping>>(BANK_MAPPINGS_KEY)) ?? {};
  // Object keys keep insertion order: re-saving moves the layout to the end, the oldest fall off.
  delete all[signature];
  const next = { ...all, [signature]: mapping };
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_MAPPINGS))) delete next[k];
  await setMeta(BANK_MAPPINGS_KEY, next);
}

export async function forgetBankMappings(): Promise<void> {
  await setMeta(BANK_MAPPINGS_KEY, {});
}
