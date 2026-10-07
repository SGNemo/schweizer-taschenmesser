import type { Strings } from '@/strings';

export const pendingImport: Strings['pendingImport'] = {
  title: 'Wartender Import',
  banner: (source: string, n: number, module: string) =>
    `${source || 'Eine KI'} möchte ${n === 1 ? '1 Eintrag' : `${n} Einträge`} in „${module}“ übernehmen.`,
  review: 'Ansehen',
  dialogTitle: (module: string) => `Import prüfen: ${module}`,
  intro: (source: string) =>
    `Gesendet über den Zugang „${source}“. Nur angehakte Einträge werden gespeichert; Änderungen an vorhandenen Einträgen musst du einzeln anhaken.`,
  accept: (n: number) => (n === 1 ? '1 Eintrag übernehmen' : `${n} Einträge übernehmen`),
  reject: 'Ablehnen',
  accepted: (n: number, conflicts: number) =>
    `${n === 1 ? '1 Eintrag' : `${n} Einträge`} übernommen.` +
    (conflicts > 0
      ? ` ${conflicts} Änderung(en) übersprungen, weil der Eintrag inzwischen bearbeitet wurde.`
      : ''),
  rejected: 'Import abgelehnt.',
  failed: 'Das hat nicht geklappt. Bitte erneut versuchen.',
};
