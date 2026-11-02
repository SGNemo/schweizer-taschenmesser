import type { Strings } from '@/strings';

export const mail: Strings['mail'] = {
  meta: {
    name: 'E-mail',
    description:
      'Caixa de entrada, busca e leitura – somente leitura, sem IA na nuvem. Usa sua conta do Google de Conexões.',
    quickAdd: 'E-mail: abrir a caixa de entrada',
    images: 'Imagens nos e-mails',
    imagesHelp:
      'Imagens externas avisam ao remetente que você abriu o e-mail. Padrão: carregar só depois de um clique.',
    imagesAsk: 'Carregar após um clique',
    imagesAlways: 'Sempre carregar',
    cacheBodies: 'Guardar os e-mails abertos no cache',
    cacheBodiesHelp:
      'Criptografado neste dispositivo, sem sincronizar e fora dos backups. Sem isso, cada e-mail é baixado de novo ao abrir.',
  },
  page: {
    refresh: 'Atualizar',
    loading: 'Carregando e-mails …',
    more: 'Carregar mais',
    searchLabel: 'Buscar',
    searchPlaceholder: 'Buscar, p. ex. from:nome has:attachment',
    searchHint:
      'Vale a sintaxe de busca do Gmail: from:, to:, subject:, has:attachment, newer_than:7d, label:…',
    searchEnd: 'Encerrar a busca',
    account: 'Conta',
    accountN: (n: number) => `Conta ${n}`,
    label: 'Pasta',
    empty: 'Nenhum e-mail nesta visualização.',
    emptySearch: 'Nada encontrado.',
    settings: 'Configurações do e-mail',
    unread: (n: number) => (n === 1 ? '1 não lido' : `${n} não lidos`),
    messages: (n: number) => (n === 1 ? '1 mensagem' : `${n} mensagens`),
    demo: 'E-mails de exemplo (dados de teste). Conecte o Gmail para ver os seus.',
    cached: 'Sem conexão: mostrando o último estado salvo.',
    groups: { today: 'Hoje', yesterday: 'Ontem', week: 'Esta semana', older: 'Mais antigos' },
    noSubject: '(sem assunto)',
    labels: {
      INBOX: 'Caixa de entrada',
      STARRED: 'Com estrela',
      IMPORTANT: 'Importantes',
      SENT: 'Enviados',
      DRAFT: 'Rascunhos',
      TRASH: 'Lixeira',
      SPAM: 'Spam',
    },
  },
  connect: {
    title: 'Nenhuma conta de e-mail conectada ainda',
    body: 'Conecte sua conta do Google nas Configurações e ative «E-mail». O Nemo só lê: nada é enviado, apagado ou movido.',
    action: 'Ir para Conexões',
  },
  errors: {
    expired: 'O login do Google expirou.',
    denied: 'Falta a permissão para isso. Ative «E-mail» em Conexões e entre de novo.',
    'rate-limited': 'O Google está limitando as requisições. Tente de novo em alguns minutos.',
    network: 'Sem conexão com o serviço de e-mail.',
    generic: 'Não foi possível carregar os e-mails.',
    action: 'Ir para Conexões',
  },
  view: {
    back: 'Voltar à lista',
    from: 'De',
    to: 'Para',
    cc: 'Cc',
    attachments: 'Anexos',
    download: (name: string) => `Baixar ${name}`,
    saved: 'Anexo salvo.',
    downloadLabel: 'Baixar',
    downloadFailed: 'Não foi possível carregar o anexo.',
    blockedImages: (n: number) =>
      n === 1 ? '1 imagem externa bloqueada' : `${n} imagens externas bloqueadas`,
    loadImages: 'Carregar imagens',
    loadingImages: 'Carregando imagens …',
    trackers: (n: number) =>
      n === 1 ? '1 pixel de rastreamento removido' : `${n} pixels de rastreamento removidos`,
    noBody: '(sem texto)',
    frameTitle: (subject: string) => `Conteúdo do e-mail: ${subject}`,
    readOnly: 'O Nemo só lê: isso não altera o status de lido.',
    openInGmail: 'Abrir no Gmail',
    expand: (who: string) => `Expandir a mensagem de ${who}`,
    loadFailed: 'Não foi possível carregar o e-mail.',
  },
  panel: {
    title: 'Configurações do e-mail',
    accounts: 'Contas',
    noAccounts: 'Nenhuma conta conectada.',
    accountsHint: 'As contas são conectadas e removidas em Conexões.',
    manage: 'Abrir Conexões',
    scopes: 'Permissão',
    scopesBody:
      'A leitura usa a permissão do Google «Ler o Gmail» (gmail.readonly). Ainda não há permissões de escrita, como arquivar ou responder; elas seriam ativadas uma a uma, com explicação.',
    cache: 'Cache',
    cacheBody: (threads: number, bodies: number) =>
      `${threads} cabeçalhos e ${bodies} e-mails abertos, criptografados neste dispositivo. Sem sincronizar e fora dos backups.`,
    clear: 'Limpar o cache',
    cleared: 'Cache limpo.',
    clearTitle: 'Limpar o cache?',
    clearBody:
      'Os e-mails continuam no Google. Eles são baixados de novo na próxima vez que você abrir.',
    notifications: 'Notificações',
    notificationsBody: 'Ainda não disponível: o app não avisa sozinho sobre novos e-mails.',
    close: 'Fechar',
  },
  widget: {
    unread: 'Não lidos',
    unreadContext: (n: number) =>
      n === 0
        ? 'A caixa de entrada está vazia'
        : n === 1
          ? 'Conversa não lida na caixa de entrada'
          : 'Conversas não lidas na caixa de entrada',
    important: 'E-mails principais',
    importantSummary: (n: number) => (n === 1 ? '1 não lido' : `${n} não lidos`),
    invoices: 'E-mails de faturas',
    invoicesContext: (days: number) => `nos últimos ${days} dias`,
    empty: 'Ainda não há e-mails.',
    emptyAction: 'Abrir o e-mail',
    link: 'Abrir o e-mail',
  },
};
