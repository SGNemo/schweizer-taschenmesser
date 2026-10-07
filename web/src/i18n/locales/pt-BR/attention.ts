import type { Strings } from '@/strings';

export const attention: Strings['attention'] = {
  title: 'Jetzt wichtig',
  hint: 'Überfälliges, heute Fälliges und Ablaufendes ganz oben.',
  invoicesOverdue: (n: number) =>
    n === 1 ? '1 Rechnung überfällig' : `${n} Rechnungen überfällig`,
  invoicesToday: (n: number) =>
    n === 1 ? '1 Rechnung heute fällig' : `${n} Rechnungen heute fällig`,
  todosOverdue: (n: number) => (n === 1 ? '1 ToDo überfällig' : `${n} ToDos überfällig`),
  todosToday: (n: number) => (n === 1 ? '1 ToDo heute fällig' : `${n} ToDos heute fällig`),
  eventNext: (title: string) => title,
  eventAt: (time: string) => `heute um ${time}`,
  budgetOver: (name: string) => `Budget „${name}“ überschritten`,
  pantryExpired: (n: number) => (n === 1 ? '1 Vorrat abgelaufen' : `${n} Vorräte abgelaufen`),
  pantrySoon: (n: number) => (n === 1 ? '1 Vorrat läuft bald ab' : `${n} Vorräte laufen bald ab`),
  docsExpired: (n: number) => (n === 1 ? '1 Dokument abgelaufen' : `${n} Dokumente abgelaufen`),
  docsSoon: (n: number) => (n === 1 ? '1 Dokument läuft bald ab' : `${n} Dokumente laufen bald ab`),
  contractsAct: (n: number) =>
    n === 1 ? '1 Kündigungsfrist läuft bald ab' : `${n} Kündigungsfristen laufen bald ab`,
  driveFull: (name: string) => `Laufwerk ${name} fast voll`,
  updateAvailable: 'Update verfügbar',
  waiting: (n: number) => `Wartet noch · ${n}`,
  nothingNow: 'Nichts davon muss jetzt sein.',
  todosWaiting: (n: number) => (n === 1 ? '1 ToDo wartet' : `${n} ToDos warten`),
  todosWaitingDetail: 'Neu planen möglich',
};
