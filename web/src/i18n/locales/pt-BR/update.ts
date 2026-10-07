import type { Strings } from '@/strings';

export const update: Strings['update'] = {
  title: 'Atualizações do app',
  available: (version: string) => `Atualização disponível (v${version})`,
  beta: 'Beta',
  whatsNew: 'O que há de novo?',
  updateNow: 'Atualizar agora',
  later: 'Depois',
  backingUp: 'Fazendo uma cópia de segurança dos seus dados …',
  downloading: 'Baixando a atualização …',
  downloadingPercent: (pct: number) => `Baixando a atualização … ${pct} %`,
  handover: 'Quase pronto – o app reinicia em instantes ou o Android abre a instalação.',
  needsPermission:
    'O Android ainda precisa da sua permissão para instalar apps desta fonte. Ative a opção nas configurações e depois toque de novo em “Atualizar agora”.',
  retry: 'Tentar de novo',
  errors: {
    'check-failed': 'A busca por atualizações falhou. Você está on-line?',
    'backup-failed':
      'Não foi possível fazer a cópia de segurança – por isso a atualização não foi iniciada.',
    'install-failed': 'Não foi possível instalar a atualização.',
    'folder-not-writable':
      'O arquivo do programa está em uma pasta onde o app não pode gravar (somente leitura ou sem permissão). Mova o arquivo do programa para uma pasta normal, por exemplo a sua pasta de usuário, e tente de novo.',
    'signature-invalid': 'A assinatura da atualização é inválida – por isso ela não foi instalada.',
  } as Record<string, string>,
  settings: {
    intro:
      'O app instalado verifica no GitHub se há uma versão nova. Antes de cada atualização ele faz automaticamente uma cópia de segurança dos seus dados.',
    version: 'Versão instalada',
    channel: 'Canal de atualização',
    channelStable: 'Estável',
    channelBeta: 'Beta (inclui versões prévias)',
    auto: 'Buscar atualizações automaticamente',
    autoHint: 'No máximo uma vez por dia, ao abrir o app.',
    checkNow: 'Verificar agora',
    checking: 'Buscando atualizações …',
    upToDate: 'Você tem a versão mais recente.',
    browserHint:
      'No navegador o app se atualiza sozinho (aviso no topo depois de carregar uma versão nova).',
    channelDev: 'Dev preview (cada estado do develop)',
    devHelp:
      'Dev previews são versões intermediárias não testadas. Este app é separado do app Nemo estável e tem dados próprios: transfira dados por sincronização ou backup. Antes de cada atualização é feita automaticamente uma cópia de segurança. Voltar à versão estável só é possível instalando o app estável.',
    devVersion: (version: string, sha: string) => `Dev preview ${version}${sha ? ` (${sha})` : ''}`,
  },
};
