import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Importar de outro app',
  intro:
    'Escolha o arquivo ou os arquivos da sua exportação, inclusive ZIP. O Nemo reconhece de qual app vêm e mostra uma prévia antes de adicionar qualquer coisa. Nada sai deste dispositivo.',
  choose: 'Escolher arquivos',
  reading: (done: number, total: number) => `Lendo arquivos … ${done} de ${total}`,
  cancel: 'Cancelar',
  parsing: 'Lendo dados …',
  detected: (apps: string) => `Reconhecido: ${apps}`,
  unknown: 'Não reconheço de qual app são estes arquivos. Escolha a origem:',
  manual: 'Escolher outra origem',
  step: (i: number, n: number) => `Parte ${i} de ${n}`,
  nothing: 'Nada legível foi encontrado nos arquivos.',
  vaultHint:
    'As senhas são importadas no cofre, depois de digitar a senha mestra. A importação de CSV abre lá.',
  openVault: 'Ir ao cofre',
  paletteCommand: 'Importar de outro app …',
  sources: {
    enex: 'Evernote (.enex)',
    notion: 'Notion (exportação Markdown e CSV)',
    obsidian: 'Obsidian ou pasta de Markdown',
    'outlook-tasks': 'Microsoft To Do (CSV do Outlook)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Agenda (.ics)',
    bank: 'Lançamentos bancários (CSV, OFX, CAMT)',
    'vault-csv': 'Gerenciador de senhas (Bitwarden, KeePass, 1Password)',
  },
  reasons: {
    trashed: (n: number) =>
      n1(
        n,
        '1 item da lixeira ou do arquivo foi deixado de fora.',
        `${n} itens da lixeira ou do arquivo foram deixados de fora.`,
      ),
    empty: (n: number) => n1(n, '1 item vazio foi ignorado.', `${n} itens vazios foram ignorados.`),
    unreadable: (n: number) =>
      n1(
        n,
        '1 arquivo ilegível ou de outro app foi ignorado.',
        `${n} arquivos ilegíveis ou de outro app foram ignorados.`,
      ),
    attachment: (n: number) =>
      n1(
        n,
        '1 anexo (imagem ou arquivo) não foi importado: as notas guardam só texto.',
        `${n} anexos (imagens ou arquivos) não foram importados: as notas guardam só texto.`,
      ),
    unsupported: (n: number) =>
      n1(n, '1 item não é compatível.', `${n} itens não são compatíveis.`),
    tooMany: (n: number) => `A prévia mostra no máximo ${n} itens; o restante foi deixado de fora.`,
    done: (n: number) =>
      n1(
        n,
        '1 item concluído foi deixado de fora.',
        `${n} itens concluídos foram deixados de fora.`,
      ),
  },
  report: {
    title: 'Relatório',
    imported: (n: number) => n1(n, '1 item importado.', `${n} itens importados.`),
    duplicates: (n: number) => n1(n, '1 já existia.', `${n} já existiam.`),
    invalid: (n: number) =>
      n1(
        n,
        '1 não cabia no formato e não foi salvo.',
        `${n} não cabiam no formato e não foram salvos.`,
      ),
    deselected: (n: number) => n1(n, 'Você desmarcou 1.', `Você desmarcou ${n}.`),
  },
  newNotebook: 'Novo caderno',
};
