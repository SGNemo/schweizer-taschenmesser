/**
 * Reads a bank file for the importer: recognises the format from the content, a known bank layout
 * from the header, or a column assignment the user made before. A layout nobody knows comes back as
 * `needs-mapping` with what the column dialog shows.
 */
import {
  BankFormatError,
  inspectBankCsv,
  layoutFromMapping,
  parseBankFile,
  sniffBankFormat,
  type BankCsvInspection,
  type BankFormat,
  type BankParseResult,
} from '@/core/io/bank';
import { detectBankPreset } from './bankPresets';
import { loadBankMapping, saveBankMapping, type StoredMapping } from './bankMemory';

export type BankRead =
  | {
      kind: 'read';
      parsed: BankParseResult;
      /** Bank name of a preset, or the format; `remembered` for a stored column assignment. */
      source: { preset: string } | { format: BankFormat } | { remembered: true };
    }
  | { kind: 'needs-mapping'; inspection: BankCsvInspection }
  | { kind: 'unknown-format' };

/** The answer of the column dialog as it travels in `ImportInput.extras`. */
export const MAPPING_EXTRA = 'mapping';

function parseExtra(raw: string | undefined): StoredMapping | undefined {
  if (!raw) return undefined;
  try {
    const m = JSON.parse(raw) as StoredMapping;
    return typeof m.date === 'string' && typeof m.amount === 'string' ? m : undefined;
  } catch {
    return undefined;
  }
}

export async function readBank(text: string, extras?: Record<string, string>): Promise<BankRead> {
  try {
    const format = sniffBankFormat(text);
    if (format !== 'csv') return { kind: 'read', parsed: parseBankFile(text), source: { format } };

    const chosen = parseExtra(extras?.[MAPPING_EXTRA]);
    if (chosen) {
      const parsed = parseBankFile(text, { layout: layoutFromMapping(chosen, chosen.delimiter) });
      // Remember the assignment only when it read something: a wrong guess is not kept.
      const inspection = inspectBankCsv(text);
      if (parsed.transactions.length > 0 && inspection)
        await saveBankMapping(inspection.signature, chosen);
      return { kind: 'read', parsed, source: { remembered: true } };
    }

    const preset = detectBankPreset(text);
    if (preset)
      return {
        kind: 'read',
        parsed: parseBankFile(text, { layout: preset.layout }),
        source: { preset: preset.name },
      };
    try {
      return { kind: 'read', parsed: parseBankFile(text), source: { format: 'csv' } };
    } catch (e) {
      if (!(e instanceof BankFormatError && e.code === 'no-columns')) throw e;
    }
    // Neither a bank we know nor usual column names: a stored assignment, or ask once.
    const inspection = inspectBankCsv(text);
    if (!inspection) return { kind: 'unknown-format' };
    const stored = await loadBankMapping(inspection.signature);
    if (stored) {
      const parsed = parseBankFile(text, { layout: layoutFromMapping(stored, stored.delimiter) });
      if (parsed.transactions.length > 0)
        return { kind: 'read', parsed, source: { remembered: true } };
    }
    return { kind: 'needs-mapping', inspection };
  } catch (e) {
    if (e instanceof BankFormatError) return { kind: 'unknown-format' };
    throw e;
  }
}
