import type { Strings } from '@/strings';

export const downloads: Strings['downloads'] = {
  meta: {
    name: 'Downloads',
    description:
      'Baixa arquivos: progresso, pausa, retomada, limite de velocidade e checksum. Nada é aberto automaticamente.',
    widget: 'Downloads em andamento',
    widgetEmpty: 'Nenhum download.',
    widgetAction: 'Adicionar um download',
    widgetSummary: (running: number, waiting: number) =>
      waiting > 0
        ? `${running} em andamento · ${waiting} aguardando ou pausados`
        : running === 1
          ? '1 em andamento'
          : `${running} em andamento`,
  },
  settings: {
    limitKb: 'Limite de velocidade para todos os downloads (KB/s, 0 = sem limite)',
    folder: 'Pasta de downloads (vazio = a pasta Downloads do sistema)',
  },
  unsupported: {
    title: 'O gerenciador de downloads só existe no app para computador',
    body: 'Neste dispositivo, o navegador do seu dispositivo baixa os arquivos.',
  },
  hint: 'Os arquivos vão só para a pasta escolhida. O Nemo nunca os abre nem os executa.',
  add: {
    button: 'Adicionar um download',
    title: 'Adicionar um download',
    url: 'Endereço (http:// ou https://)',
    folder: 'Pasta',
    pick: 'Escolher pasta',
    hash: 'Checksum (opcional, SHA-256 ou SHA-512)',
    hashHelp: 'O arquivo concluído é comparado com ele.',
    submit: 'Baixar',
    cancel: 'Cancelar',
    http: 'Este endereço não é criptografado (HTTP).',
  },
  errors: {
    scheme: 'Só funcionam endereços com http:// ou https://.',
    url: 'Isso não é um endereço válido.',
    dir: 'A pasta não existe.',
    hash: 'O checksum precisa de 64 (SHA-256) ou 128 (SHA-512) caracteres de 0–9 e a–f.',
    other: 'Não funcionou.',
  },
  state: {
    queued: 'Aguardando',
    running: 'Baixando',
    paused: 'Pausado',
    done: 'Concluído',
    failed: 'Falhou',
  },
  failed: {
    http: 'O servidor não entregou o arquivo.',
    io: 'Não foi possível gravar o arquivo.',
    checksum: 'O checksum não confere. O arquivo foi excluído.',
    size: 'O arquivo chegou incompleto.',
  },
  row: {
    progress: (done: string, total: string) => `${done} de ${total}`,
    unknownTotal: (done: string) => `${done} baixados`,
    speed: (perSecond: string) => `${perSecond}/s`,
    limited: (perSecond: string) => `Limite ${perSecond}/s`,
  },
  actions: {
    pause: 'Pausar',
    resume: 'Retomar',
    retry: 'Tentar de novo',
    reveal: 'Mostrar na pasta',
    remove: 'Remover da lista',
    removeData: 'Excluir com o arquivo',
    more: 'Mais',
  },
  checksum: {
    label: 'SHA-256',
    verify: 'Comparar o checksum',
    verifyTitle: 'Comparar o checksum',
    field: 'Checksum (SHA-256 ou SHA-512)',
    match: 'Confere',
    mismatch: 'Não confere',
    submit: 'Comparar',
  },
  deleteData: {
    title: 'Excluir o arquivo?',
    body: (name: string) => `“${name}” é excluído do disco, mesmo se estiver incompleto.`,
    confirm: 'Excluir',
  },
  empty: {
    title: 'Ainda não há downloads',
    body: 'Cole um endereço ou baixe algo no navegador. Nada é aberto automaticamente.',
  },
};
