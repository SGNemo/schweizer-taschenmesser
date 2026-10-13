import type { Strings } from '@/strings';

export const connectors: Strings['connectors'] = {
  title: 'Conexões',
  errors: {
    expired: 'A conexão expirou. Entre de novo.',
    'rate-limited':
      'O serviço informou solicitações demais. Uma nova tentativa será feita mais tarde.',
    'not-configured': 'Ainda faltam dados de acesso.',
    'no-proxy':
      'No navegador, esta busca precisa do servidor de sincronização (Configurações → Sincronização).',
    network: 'O serviço está inacessível no momento.',
    denied: 'O login foi cancelado ou recusado.',
    'bad-response': 'O serviço enviou uma resposta inesperada.',
    unsupported: 'Isso não funciona neste dispositivo.',
  } as Record<string, string>,
  icsName: 'Assinatura de calendário (ICS)',
  icsDescription:
    'Importar eventos de um endereço de calendário (somente leitura). Funciona com Google Agenda, Outlook, Nextcloud e muitos outros.',
  intro: 'Traga eventos e sugestões de serviços que você já usa. Tudo é somente leitura.',
  statusLabel: 'Status',
  status: {
    disconnected: 'Não conectado',
    connected: 'Conectado',
    expired: 'Expirado',
    'rate-limited': 'Pausado',
    error: 'Erro',
  } as Record<string, string>,
  lastSync: (when: string) => `Última atualização: ${when}`,
  events: (n: number) => (n <= 1 ? `${n} evento importado` : `${n} eventos importados`),
  connect: 'Conectar',
  reconnect: 'Entrar de novo',
  cancelLogin: 'Cancelar login',
  connecting: 'Aguardando o login no navegador…',
  disconnect: 'Desconectar',
  syncNow: 'Atualizar agora',
  syncing: 'Atualizando…',
  syncDone: (added: number, updated: number, removed: number) =>
    `Pronto: ${added} ${added <= 1 ? 'novo' : 'novos'}, ${updated} ${updated <= 1 ? 'alterado' : 'alterados'}, ${removed} ${removed <= 1 ? 'removido' : 'removidos'}.`,
  desktopOnly:
    'O login só funciona no app para Windows. No celular e no navegador, os eventos chegam pela sincronização ou por uma assinatura de calendário (ICS).',
  features: 'O que deve ser lido?',
  calendars: 'Calendários',
  calendarsHint: 'Só os calendários marcados são importados.',
  disconnectTitle: (name: string) => `Desconectar ${name}?`,
  disconnectBody:
    'O acesso é revogado no serviço e os dados de login salvos são apagados deste dispositivo.',
  keepData: 'Manter eventos importados',
  deleteData: 'Excluir eventos importados',
  client: {
    title: 'Aplicativo Google próprio',
    intro:
      'Para o login, você precisa de um “ID do cliente OAuth” próprio (tipo app para computador) do Google Cloud Console. As instruções estão em docs/MANUAL-TESTS.md, em “Anleitungen für Sven”.',
    id: 'ID do cliente',
    secret: 'Chave secreta do cliente',
    secretHint:
      'O Google exige isso também em apps para computador; lá ela não é considerada confidencial.',
    save: 'Salvar',
    saved: 'Dados de acesso salvos.',
    missing: 'Primeiro informe o ID do cliente.',
  },
  scan: {
    title: 'Vasculhar e-mails',
    intro:
      'Dos e-mails recentes, o app lê só remetente, assunto, data e a linha de prévia e procura neles, localmente, faturas, assinaturas, eventos e contratos. Só é salvo o que você confirmar na prévia; o texto do e-mail nunca é salvo nem enviado a uma IA.',
    period: 'Período',
    months: (n: number) => (n <= 1 ? 'Último mês' : `Últimos ${n} meses`),
    start: 'Ler e-mails',
    reading: (done: number, total: number) => `Lendo e-mails… ${done} de ${total}`,
    summary: (n: number, months: number) =>
      `${n} ${n <= 1 ? 'e-mail lido' : 'e-mails lidos'} ${months <= 1 ? 'do último mês' : `dos últimos ${months} meses`} (remetente, assunto, data, linha de prévia).`,
    notConnected: 'Primeiro conecte o Google em Configurações → Conexões e ative “E-mails”.',
    none: 'Nada relevante foi encontrado nesses e-mails.',
  },
  ics: {
    listLabel: 'Assinaturas de calendário',
    name: 'Nome (opcional)',
    defaultName: (n: number) => `Calendário ${n}`,
    url: 'Endereço do calendário',
    urlHint:
      'ex.: no Google Agenda: Configurações → Calendário → Integrar agenda → “Endereço secreto no formato iCal”. Não compartilhe.',
    add: 'Adicionar calendário',
    checking: 'Verificando…',
    remove: (name: string) => `Remover calendário “${name}”`,
    badUrl: 'Este não é um endereço válido (https://… ou webcal://…).',
    notACalendar: 'Não há calendário neste endereço.',
    unreachable: 'O endereço está inacessível.',
    noProxy:
      'No navegador, isso precisa do servidor de sincronização (Configurações → Sincronização), porque os serviços de calendário bloqueiam a busca pelo navegador.',
  },
  google: {
    name: 'Google',
    description:
      'Ler calendários e vasculhar e-mails em busca de faturas, assinaturas, eventos e contratos. Somente leitura.',
    calendarFeature: 'Calendário',
    calendarFeatureHint: 'Mostrar eventos dos seus calendários do Google.',
    mailFeature: 'E-mails',
    mailFeatureHint: 'Procurar faturas, assinaturas, eventos e contratos com um clique.',
  },
};
