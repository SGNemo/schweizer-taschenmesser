import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Mudança de outro app',
  intro:
    'Traga seus dados do Google, Todoist, Notion, um app de banco e mais. O Nemo reconhece os arquivos e mostra uma prévia antes de adicionar qualquer coisa; cada mudança pode ser desfeita por inteiro. Nada sai deste dispositivo.',
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
  start: 'Começar a mudança',
  back: 'Voltar',
  privacy: 'Os arquivos são lidos apenas neste dispositivo. Nada é enviado.',
  whereTitle: 'De onde você vem?',
  whereLead:
    'De onde você vem? Escolha o app de onde vêm seus dados. O Nemo reconhece o resto pelos arquivos.',
  stepOf: (i: number, n: number) => `Passo ${i} de ${n}`,
  steps: {
    label: 'Passos',
    where: 'Origem',
    files: 'Arquivos',
    check: 'Conferir',
  },
  origins: {
    google: {
      title: 'Google',
      how: 'Em takeout.google.com escolha Agenda, Contatos, Keep e Tasks e baixe o arquivo ZIP. Você pode escolher o ZIP como está.',
    },
    apple: {
      title: 'Apple (iPhone, Mac)',
      how: 'Calendário: «Exportar» no app Calendário (.ics). Contatos: exportar como vCard no app Contatos.',
    },
    microsoft: {
      title: 'Microsoft (Outlook, To Do)',
      how: 'O Microsoft To Do não tem exportação própria: no Outlook use «Exportar» → CSV → Tarefas. Agenda como .ics, contatos como vCard.',
    },
    todoist: {
      title: 'Todoist',
      how: 'No Todoist baixe o backup como ZIP (Configurações → Backups) ou exporte um projeto como modelo CSV.',
    },
    ticktick: {
      title: 'TickTick',
      how: 'No TickTick vá em Configurações → Conta, «Gerar backup» e salve o arquivo CSV.',
    },
    notion: {
      title: 'Notion',
      how: 'No Notion escolha «Exportar» → «Markdown e CSV» e salve o arquivo ZIP.',
    },
    evernote: { title: 'Evernote', how: 'No Evernote exporte os cadernos como arquivo .enex.' },
    obsidian: {
      title: 'Obsidian, Markdown',
      how: 'Escolha os arquivos Markdown ou sua pasta do Obsidian como ZIP.',
    },
    bank: {
      title: 'Banco, extrato',
      how: 'No internet banking baixe as movimentações como CSV, CAMT, OFX ou QIF.',
    },
    passwords: {
      title: 'Gerenciador de senhas',
      how: 'Exporte o Bitwarden, 1Password ou KeePass como CSV. A importação acontece depois no cofre, com sua senha mestra.',
    },
    browser: {
      title: 'Marcadores do navegador',
      how: 'Exporte os marcadores como arquivo HTML no navegador (Chrome, Firefox, Edge, Safari, Brave).',
    },
    other: {
      title: 'Não sei',
      how: 'É só escolher os arquivos. O Nemo reconhece de onde eles vêm.',
    },
  },
  foundTitle: 'Reconhecido',
  nothingTitle: 'Nada reconhecido',
  pickSource: 'Escolha você mesmo a origem:',
  certainty: {
    sure: 'reconhecido com certeza',
    likely: 'provável',
    maybe: 'talvez',
  },
  why: {
    'vault-csv':
      'As colunas combinam com um gerenciador de senhas. Só as linhas são contadas; a importação acontece no cofre.',
    ticktick: 'Cabeçalho de um backup do TickTick (List Name, Title, Kind).',
    todoist: 'Colunas TYPE e CONTENT como numa exportação do Todoist, um arquivo por projeto.',
    'google-tasks': 'Arquivo de tarefas do Google Takeout («tasks#…»).',
    'outlook-tasks': 'Colunas como Assunto e Vencimento de uma exportação de tarefas do Outlook.',
    'google-keep': 'Notas do Keep do Google Takeout (JSON).',
    'google-calendar': 'Arquivo de agenda no formato iCalendar.',
    enex: 'Exportação do Evernote (.enex).',
    notion: 'Nomes de arquivo com o identificador do Notion (título e 32 caracteres).',
    opml: 'Lista OPML com endereços de feeds.',
    contacts: 'Cartões de contato no formato vCard. São trazidos os contatos com aniversário.',
    bookmarks: 'Arquivo de marcadores como qualquer navegador exporta.',
    obsidian: 'Arquivos Markdown; com uma pasta .obsidian, com certeza do Obsidian.',
    bank: 'Colunas de data e valor, ou um formato bancário (CAMT, OFX, QIF).',
  },
  units: {
    projects: (n: number) => n1(n, '1 projeto', `${n} projetos`),
    lists: (n: number) => n1(n, '1 lista', `${n} listas`),
    tasks: (n: number) => n1(n, '1 tarefa', `${n} tarefas`),
    notes: (n: number) => n1(n, '1 nota', `${n} notas`),
    events: (n: number) => n1(n, '1 evento', `${n} eventos`),
    contacts: (n: number) => n1(n, '1 contato', `${n} contatos`),
    bookmarks: (n: number) => n1(n, '1 marcador', `${n} marcadores`),
    transactions: (n: number) => n1(n, '1 movimentação', `${n} movimentações`),
    feeds: (n: number) => n1(n, '1 feed', `${n} feeds`),
    entries: (n: number) => n1(n, '1 entrada', `${n} entradas`),
  },
  goesTo: (module: string) => `Destino: ${module}.`,
  openPreview: 'Abrir prévia',
  runDone: (n: number) => n1(n, '1 entrada foi adicionada.', `${n} entradas foram adicionadas.`),
  runParts: 'Adicionado por área',
  runPart: (module: string, n: number) => `${module}: ${n}`,
  runUndoHint:
    '«Desfazer a mudança inteira» desfaz todas as partes. O que você alterou desde então fica.',
  undoRun: 'Desfazer a mudança inteira',
  undoRunShort: 'Desfazer',
  recentTitle: 'Últimas mudanças',
  recentRun: (source: string, date: string) => `${source}, ${date}`,
  emptyTitle: 'Nenhuma mudança ainda',
  emptyText: 'Cada mudança aparece aqui. Depois você pode desfazê-la por inteiro.',
  checklist: 'Lista de verificação',
  checklistHint: 'O que ainda falta para a mudança, passo a passo.',
  sources: {
    enex: 'Evernote (.enex)',
    notion: 'Notion (exportação Markdown e CSV)',
    opml: 'OPML (apps de feeds e podcasts)',
    obsidian: 'Obsidian ou pasta de Markdown',
    'outlook-tasks': 'Microsoft To Do (CSV do Outlook)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Agenda (.ics)',
    bank: 'Lançamentos bancários (CSV, OFX, CAMT)',
    'vault-csv': 'Gerenciador de senhas (Bitwarden, KeePass, 1Password)',
    ticktick: 'TickTick (backup CSV)',
    contacts: 'Contatos (vCard: Google, Apple, Outlook)',
    bookmarks: 'Marcadores do navegador (HTML)',
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
