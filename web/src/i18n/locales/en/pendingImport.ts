import type { Strings } from '@/strings';

export const pendingImport: Strings['pendingImport'] = {
  title: 'Pending import',
  banner: (source: string, n: number, module: string) =>
    `${source || 'An AI'} wants to add ${n === 1 ? '1 entry' : `${n} entries`} to “${module}”.`,
  review: 'Review',
  dialogTitle: (module: string) => `Check import: ${module}`,
  intro: (source: string) =>
    `Sent via the access “${source}”. Only ticked entries are saved; changes to existing entries must be ticked one by one.`,
  accept: (n: number) => (n === 1 ? 'Add 1 entry' : `Add ${n} entries`),
  reject: 'Reject',
  accepted: (n: number, conflicts: number) =>
    `${n === 1 ? '1 entry' : `${n} entries`} added.` +
    (conflicts > 0
      ? ` ${conflicts} ${conflicts === 1 ? 'change' : 'changes'} skipped because the entry was edited in the meantime.`
      : ''),
  rejected: 'Import rejected.',
  failed: 'That didn’t work. Please try again.',
};
