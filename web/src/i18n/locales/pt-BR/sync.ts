import type { Strings } from '@/strings';

export const sync: Strings['sync'] = {
  defaultDeviceName: 'Dispositivo',
  title: 'Sincronização',
  intro:
    'Opcional: sincronize seus dados pelo seu próprio servidor de sincronização (na rede local ou via Tailscale). Sem servidor, tudo fica só neste dispositivo.',
  serverUrl: 'Endereço do servidor',
  serverUrlHint: 'ex.: https://meu-pc.tailnet.ts.net',
  token: 'Token de acesso',
  deviceName: 'Nome do dispositivo',
  deviceNameHint: 'É assim que este dispositivo aparece na lista de dispositivos.',
  deviceNames: {
    desktop: 'App para Windows',
    android: 'Celular Android',
    web: 'Navegador',
  } as Record<string, string>,
  encrypt: 'Criptografia de ponta a ponta',
  encryptHint:
    'Os valores são criptografados no dispositivo; o servidor só vê texto cifrado. Só é possível em um servidor vazio.',
  plainWarning:
    'Sem criptografia de ponta a ponta, seus dados ficam no servidor em texto puro. Use-a se o servidor não for só seu ou não guardar os dados criptografados.',
  passphrase: 'Frase secreta',
  passphraseHint:
    'Pelo menos 12 caracteres, de preferência várias palavras. Sem a frase secreta, não dá para recuperar os dados.',
  passphraseJoinHint: 'Só é necessária se o servidor for criptografado.',
  connect: 'Conectar',
  connecting: 'Conectando…',
  connected: (host: string) => `Conectado a ${host}`,
  encryptedBadge: 'Criptografado',
  plainBadge: 'Sem criptografia',
  lastSync: 'Última sincronização',
  never: 'ainda não',
  pending: (n: number) =>
    n === 0 ? 'Tudo enviado' : n === 1 ? '1 alteração aguardando' : `${n} alterações aguardando`,
  syncNow: 'Sincronizar agora',
  disconnect: 'Desconectar',
  signOut: 'Sair neste dispositivo',
  signOutHint:
    'Bloqueia o token deste dispositivo no servidor e o desconecta. Seus dados locais são mantidos.',
  disconnectHint: 'Seus dados locais são mantidos; o servidor não é alterado.',
  state: { off: 'Desligada', idle: 'Sincronizado', syncing: 'Sincronizando…', error: 'Erro' },
  badge: (state: string) => `Sincronização: ${state}`,
  detailsTitle: 'Status',
  lastResult: (pulled: number, pushed: number) => `Última: ${pulled} recebidas, ${pushed} enviadas`,
  rejected: (n: number) =>
    n <= 1
      ? `${n} alteração recebida não pôde ser descriptografada e foi ignorada.`
      : `${n} alterações recebidas não puderam ser descriptografadas e foram ignoradas.`,
  failuresInRow: (n: number) =>
    n <= 1 ? `${n} tentativa falhou` : `${n} tentativas seguidas falharam`,
  serverSize: 'Dados no servidor',
  serverSizeValue: (records: number, kb: number) =>
    `${records} ${records <= 1 ? 'registro' : 'registros'}, ${kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`}`,
  devicesTitle: 'Dispositivos',
  devicesIntro:
    'Todos os dispositivos que sincronizam com este servidor. Um dispositivo bloqueado não sincroniza mais; os dados que ele já enviou são mantidos.',
  devicesUnsupported:
    'Este servidor não tem gerenciamento de dispositivos (versão antiga). Atualize o servidor para bloquear dispositivos.',
  deviceThis: 'este dispositivo',
  deviceLastSeen: (when: string) => `Ativo pela última vez: ${when}`,
  deviceNever: 'nunca',
  deviceRevoked: (when: string) => `Bloqueado em ${when}`,
  deviceStale: (days: number) =>
    `Inativo há ${days} ${days <= 1 ? 'dia' : 'dias'}. Bloqueie-o se não usa mais: dispositivos muito antigos podem trazer de volta registros excluídos.`,
  deviceLock: 'Bloquear',
  deviceLockTitle: (name: string) => `Bloquear “${name}”?`,
  deviceLockText:
    'Depois disso, o dispositivo não sincroniza mais. Os dados já enviados ficam no servidor. Para se conectar de novo, o dispositivo precisa do token do servidor.',
  deviceLocked: 'Dispositivo bloqueado.',
  deviceLockFailed: 'Não foi possível bloquear o dispositivo.',
  deviceId: (id: string) => `ID do dispositivo: ${id}`,
  rotateToken: 'Renovar o token deste dispositivo',
  rotated: 'Token renovado.',
  conflictsTitle: 'Conflitos',
  conflictsIntro:
    'Quando dois dispositivos alteram o mesmo campo ao mesmo tempo, vale a alteração mais recente. O valor sobrescrito fica aqui e pode ser restaurado.',
  conflictsNone: 'Nenhum conflito aberto.',
  conflictKept: {
    remote: 'A alteração de outro dispositivo sobrescreveu a sua.',
    local: 'Sua alteração sobrescreveu a de outro dispositivo.',
  } as Record<string, string>,
  conflictLost: 'Sobrescrito',
  conflictNow: 'Vale agora',
  conflictEmpty: '(vazio)',
  conflictDeleted: '(excluído)',
  conflictTooLarge: 'Valor grande demais para guardar',
  conflictRestore: 'Restaurar',
  conflictDismiss: 'Descartar',
  conflictDismissAll: 'Descartar todos',
  conflictRestored: 'Valor restaurado.',
  conflictOutcome: {
    'already-current': 'Esse valor já está valendo.',
    'record-gone': 'O registro não existe mais.',
    'not-restorable': 'Não é possível restaurar este valor.',
  } as Record<string, string>,
  errors: {
    network: 'Servidor inacessível.',
    revoked:
      'Este dispositivo foi bloqueado. Desconecte e conecte de novo se quiser liberá-lo outra vez.',
    'rate-limited':
      'Muitas solicitações ou tentativas falhas – uma nova tentativa será feita automaticamente.',
    unauthorized: 'O servidor recusou o token.',
    server: 'O servidor informou um erro.',
    clock: 'O relógio deste dispositivo está adiantado mais de uma hora. Confira a data e a hora.',
    decrypt: 'Falha ao descriptografar – a frase secreta está certa?',
    'no-key':
      'Os dados no servidor são criptografados. Desconecte e conecte de novo com a frase secreta.',
    unsupported: 'Não suportado.',
    unknown: 'Erro desconhecido.',
  } as Record<string, string>,
  failures: {
    'invalid-url': 'Digite um endereço válido com http:// ou https://.',
    unreachable:
      'Servidor inacessível. Se o app for aberto via HTTPS, o servidor também precisa estar acessível via HTTPS (ex.: com “tailscale serve”).',
    unauthorized: 'O token foi recusado.',
    'passphrase-required': 'Este servidor é criptografado. Digite a frase secreta.',
    'passphrase-too-short': 'A frase secreta precisa de pelo menos 12 caracteres.',
    'wrong-passphrase': 'Frase secreta incorreta.',
    'server-has-plain-data':
      'Já existem dados sem criptografia no servidor. A criptografia só é possível em um servidor vazio.',
    revoked: 'Este dispositivo está bloqueado no servidor.',
    'rate-limited': 'Muitas tentativas falhas. Tente de novo em um minuto.',
    'vault-outdated':
      'O servidor ainda usa o formato de criptografia antigo. Redefina o servidor para recriá-lo.',
    'server-error': 'O servidor informou um erro.',
  } as Record<string, string>,
  resetServer: 'Redefinir o servidor e recriá-lo com criptografia',
  resetTitle: 'Redefinir o servidor?',
  resetText:
    'Todos os dados no servidor serão excluídos. Seus dados locais são mantidos e enviados de novo; os outros dispositivos também reenviam os dados deles na próxima sincronização.',
  resetConfirm: 'Redefinir',
};
