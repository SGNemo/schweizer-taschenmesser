import type { Strings } from '@/strings';

export const sync: Strings['sync'] = {
  defaultDeviceName: 'Dispositivo',
  title: 'Sincronización',
  intro:
    'Opcional: sincroniza tus datos a través de tu propio servidor de sincronización (en la red local o con Tailscale). Sin servidor, todo se queda en este dispositivo.',
  serverUrl: 'Dirección del servidor',
  serverUrlHint: 'p. ej. https://mi-pc.tailnet.ts.net',
  token: 'Token de acceso',
  deviceName: 'Nombre del dispositivo',
  deviceNameHint: 'Así aparece este dispositivo en la lista de dispositivos.',
  deviceNames: { desktop: 'App de Windows', android: 'Móvil Android', web: 'Navegador' } as Record<
    string,
    string
  >,
  encrypt: 'Cifrado de extremo a extremo',
  encryptHint:
    'Los valores se cifran en el dispositivo; el servidor solo ve texto cifrado. Solo es posible en un servidor vacío.',
  plainWarning:
    'Sin cifrado de extremo a extremo, tus datos quedan en el servidor sin cifrar. Úsalo si el servidor no es solo tuyo o no guarda los datos cifrados.',
  passphrase: 'Frase de contraseña',
  passphraseHint:
    'Mínimo 8 caracteres. Sin la frase de contraseña, los datos no se pueden recuperar.',
  passphraseJoinHint: 'Solo hace falta si el servidor está cifrado.',
  connect: 'Conectar',
  connecting: 'Conectando …',
  connected: (host: string) => `Conectado con ${host}`,
  encryptedBadge: 'Cifrado',
  plainBadge: 'Sin cifrar',
  lastSync: 'Última sincronización',
  never: 'todavía no',
  pending: (n: number) =>
    n === 0 ? 'Todo enviado' : n === 1 ? '1 cambio pendiente' : `${n} cambios pendientes`,
  syncNow: 'Sincronizar ahora',
  disconnect: 'Desconectar',
  signOut: 'Cerrar sesión en este dispositivo',
  signOutHint:
    'Bloquea el token de este dispositivo en el servidor y lo desconecta. Tus datos locales se conservan.',
  disconnectHint: 'Tus datos locales se conservan; el servidor no cambia.',
  state: { off: 'Desactivada', idle: 'Sincronizado', syncing: 'Sincronizando …', error: 'Error' },
  badge: (state: string) => `Sincronización: ${state}`,
  detailsTitle: 'Estado',
  lastResult: (pulled: number, pushed: number) =>
    `Última vez: ${pulled} recibidos, ${pushed} enviados`,
  rejected: (n: number) =>
    n === 1
      ? '1 cambio recibido no se pudo descifrar y se omitió.'
      : `${n} cambios recibidos no se pudieron descifrar y se omitieron.`,
  failuresInRow: (n: number) => (n === 1 ? '1 intento fallido' : `${n} intentos fallidos seguidos`),
  serverSize: 'Datos en el servidor',
  serverSizeValue: (records: number, kb: number) =>
    `${records} ${records === 1 ? 'entrada' : 'entradas'}, ${kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`}`,
  devicesTitle: 'Dispositivos',
  devicesIntro:
    'Todos los dispositivos que se sincronizan con este servidor. Un dispositivo bloqueado ya no puede sincronizar; los datos que ya envió se conservan.',
  devicesUnsupported:
    'Este servidor no gestiona dispositivos (versión antigua). Actualiza el servidor para poder bloquear dispositivos.',
  deviceThis: 'este dispositivo',
  deviceLastSeen: (when: string) => `Última actividad: ${when}`,
  deviceNever: 'nunca',
  deviceRevoked: (when: string) => `Bloqueado el ${when}`,
  deviceStale: (days: number) =>
    `Sin actividad desde hace ${days} ${days === 1 ? 'día' : 'días'}. Bloquéalo si ya no lo usas: los dispositivos muy antiguos pueden recuperar entradas eliminadas.`,
  deviceLock: 'Bloquear',
  deviceLockTitle: (name: string) => `¿Bloquear «${name}»?`,
  deviceLockText:
    'Después, el dispositivo ya no podrá sincronizar. Los datos ya enviados se quedan en el servidor. Para volver a conectarse, el dispositivo necesita el token del servidor.',
  deviceLocked: 'Dispositivo bloqueado.',
  deviceLockFailed: 'No se pudo bloquear el dispositivo.',
  deviceId: (id: string) => `ID del dispositivo: ${id}`,
  rotateToken: 'Renovar el token de este dispositivo',
  rotated: 'Token renovado.',
  conflictsTitle: 'Conflictos',
  conflictsIntro:
    'Si dos dispositivos cambian el mismo campo a la vez, gana el cambio más reciente. El valor sobrescrito aparece aquí y se puede restaurar.',
  conflictsNone: 'No hay conflictos pendientes.',
  conflictKept: {
    remote: 'El cambio de otro dispositivo sobrescribió el tuyo.',
    local: 'Tu cambio sobrescribió el de otro dispositivo.',
  } as Record<string, string>,
  conflictLost: 'Sobrescrito',
  conflictNow: 'Valor actual',
  conflictEmpty: '(vacío)',
  conflictDeleted: '(eliminado)',
  conflictTooLarge: 'Valor demasiado grande para guardarlo',
  conflictRestore: 'Restaurar',
  conflictDismiss: 'Descartar',
  conflictDismissAll: 'Descartar todos',
  conflictRestored: 'Valor restaurado.',
  conflictOutcome: {
    'already-current': 'Ese valor ya está vigente.',
    'record-gone': 'La entrada ya no existe.',
    'not-restorable': 'Este valor no se puede restaurar.',
  } as Record<string, string>,
  errors: {
    network: 'No se puede acceder al servidor.',
    revoked:
      'Este dispositivo está bloqueado. Desconéctalo y vuelve a conectarlo si quieres permitirlo de nuevo.',
    'rate-limited':
      'Demasiadas solicitudes o intentos fallidos; se volverá a intentar automáticamente.',
    unauthorized: 'El servidor rechazó el token.',
    server: 'El servidor informó de un error.',
    decrypt: 'No se pudo descifrar. ¿Es correcta la frase de contraseña?',
    'no-key':
      'Los datos del servidor están cifrados. Desconecta y vuelve a conectar con la frase de contraseña.',
    unsupported: 'No compatible.',
    unknown: 'Error desconocido.',
  } as Record<string, string>,
  failures: {
    'invalid-url': 'Introduce una dirección válida con http:// o https://.',
    unreachable:
      'No se puede acceder al servidor. Si abres la app por HTTPS, el servidor también debe ser accesible por HTTPS (p. ej. con «tailscale serve»).',
    unauthorized: 'El token fue rechazado.',
    'passphrase-required': 'Este servidor está cifrado. Introduce la frase de contraseña.',
    'passphrase-too-short': 'La frase de contraseña necesita al menos 8 caracteres.',
    'wrong-passphrase': 'Frase de contraseña incorrecta.',
    'server-has-plain-data':
      'El servidor ya tiene datos sin cifrar. El cifrado solo es posible en un servidor vacío.',
    revoked: 'Este dispositivo está bloqueado en el servidor.',
    'rate-limited': 'Demasiados intentos fallidos. Vuelve a intentarlo en un minuto.',
    'vault-outdated':
      'El servidor aún usa el formato de cifrado antiguo. Restablece el servidor para crearlo de nuevo.',
    'server-error': 'El servidor informó de un error.',
  } as Record<string, string>,
  resetServer: 'Restablecer el servidor y crearlo de nuevo cifrado',
  resetTitle: '¿Restablecer el servidor?',
  resetText:
    'Se eliminarán todos los datos del servidor. Tus datos locales se conservan y se vuelven a subir; los demás dispositivos también subirán sus datos en la próxima sincronización.',
  resetConfirm: 'Restablecer',
};
