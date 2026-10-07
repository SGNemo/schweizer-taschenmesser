import type { Strings } from '@/strings';

export const update: Strings['update'] = {
  title: 'Actualizaciones de la app',
  available: (version: string) => `Actualización disponible (v${version})`,
  beta: 'Beta',
  whatsNew: '¿Qué hay de nuevo?',
  updateNow: 'Actualizar ahora',
  later: 'Más tarde',
  backingUp: 'Creando una copia de seguridad de tus datos …',
  downloading: 'Descargando la actualización …',
  downloadingPercent: (pct: number) => `Descargando la actualización … ${pct} %`,
  handover: 'Casi listo: la app se reiniciará enseguida o Android abrirá la instalación.',
  needsPermission:
    'Android necesita tu permiso para instalar apps de esta fuente. Activa el interruptor en los ajustes y vuelve a tocar «Actualizar ahora».',
  retry: 'Reintentar',
  errors: {
    'check-failed': 'No se pudo buscar actualizaciones. ¿Tienes conexión?',
    'backup-failed':
      'No se pudo crear la copia de seguridad, así que la actualización no se ha iniciado.',
    'install-failed': 'No se pudo instalar la actualización.',
    'folder-not-writable':
      'El archivo del programa está en una carpeta en la que la app no puede escribir (protegida o sin permisos). Mueve el archivo a una carpeta normal, p. ej. tu carpeta de usuario, y vuelve a intentarlo.',
    'signature-invalid': 'La firma de la actualización no es válida, así que no se ha instalado.',
  } as Record<string, string>,
  settings: {
    intro:
      'La app instalada comprueba en GitHub si hay una versión nueva. Antes de cada actualización crea automáticamente una copia de seguridad de tus datos.',
    version: 'Versión instalada',
    channel: 'Canal de actualizaciones',
    channelStable: 'Estable',
    channelBeta: 'Beta (también versiones previas)',
    auto: 'Buscar actualizaciones automáticamente',
    autoHint: 'Como máximo una vez al día, al iniciar la app.',
    checkNow: 'Comprobar ahora',
    checking: 'Buscando actualizaciones …',
    upToDate: 'Tienes la versión más reciente.',
    browserHint:
      'En el navegador, la app se actualiza sola (aviso arriba tras cargar una versión nueva).',
    channelDev: 'Dev preview (cada estado de develop)',
    devHelp:
      'Las dev previews son versiones intermedias sin probar. Esta app está separada de la app Nemo estable y tiene sus propios datos: pásalos por sincronización o copia de seguridad. Antes de cada actualización se crea automáticamente una copia de seguridad. Para volver a la versión estable, instala la app estable.',
    devVersion: (version: string, sha: string) => `Dev preview ${version}${sha ? ` (${sha})` : ''}`,
  },
};
