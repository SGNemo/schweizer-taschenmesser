import type { Strings } from '@/strings';

export const pendingImport: Strings['pendingImport'] = {
  title: 'Import en attente',
  banner: (source: string, n: number, module: string) =>
    `${source || 'Une IA'} souhaite ajouter ${n <= 1 ? `${n} entrée` : `${n} entrées`} dans « ${module} ».`,
  review: 'Voir',
  dialogTitle: (module: string) => `Vérifier l’import : ${module}`,
  intro: (source: string) =>
    `Envoyé via l’accès « ${source} ». Seules les entrées cochées sont enregistrées ; les modifications d’entrées existantes doivent être cochées une par une.`,
  accept: (n: number) => (n <= 1 ? `Ajouter ${n} entrée` : `Ajouter ${n} entrées`),
  reject: 'Refuser',
  accepted: (n: number, conflicts: number) =>
    `${n <= 1 ? `${n} entrée ajoutée` : `${n} entrées ajoutées`}.` +
    (conflicts > 0
      ? ` ${conflicts} modification(s) ignorée(s), car l’entrée a été modifiée entre-temps.`
      : ''),
  rejected: 'Import refusé.',
  failed: 'Cela n’a pas fonctionné. Veuillez réessayer.',
};
