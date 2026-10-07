import type { Strings } from '@/strings';

export const pendingImport: Strings['pendingImport'] = {
  title: 'Importação pendente',
  banner: (source: string, n: number, module: string) =>
    `${source || 'Uma IA'} quer adicionar ${n === 0 || n === 1 ? `${n} entrada` : `${n} entradas`} em “${module}”.`,
  review: 'Ver',
  dialogTitle: (module: string) => `Revisar importação: ${module}`,
  intro: (source: string) =>
    `Enviado pelo acesso “${source}”. Só as entradas marcadas são salvas; alterações em entradas existentes precisam ser marcadas uma a uma.`,
  accept: (n: number) =>
    n === 0 || n === 1 ? `Adicionar ${n} entrada` : `Adicionar ${n} entradas`,
  reject: 'Recusar',
  accepted: (n: number, conflicts: number) =>
    `${n === 0 || n === 1 ? `${n} entrada adicionada` : `${n} entradas adicionadas`}.` +
    (conflicts > 0
      ? ` ${conflicts} ${conflicts === 1 ? 'alteração ignorada' : 'alterações ignoradas'} porque a entrada foi editada nesse meio-tempo.`
      : ''),
  rejected: 'Importação recusada.',
  failed: 'Não deu certo. Tente de novo.',
};
