import type { Strings } from '@/strings';

export const mail: Strings['mail'] = {
  meta: {
    name: 'Correo',
    description:
      'Bandeja de entrada, búsqueda y lectura – solo lectura, sin IA en la nube. Usa tu cuenta de Google de Conexiones.',
    quickAdd: 'Correo: abrir la bandeja',
    images: 'Imágenes en los correos',
    imagesHelp:
      'Las imágenes externas le dicen al remitente que abriste el correo. Por defecto: cargar solo tras un clic.',
    imagesAsk: 'Cargar tras un clic',
    imagesAlways: 'Cargar siempre',
    cacheBodies: 'Guardar en caché los correos abiertos',
    cacheBodiesHelp:
      'Cifrado en este dispositivo, sin sincronizar y fuera de las copias. Sin esto, cada correo se vuelve a descargar al abrirlo.',
  },
  page: {
    refresh: 'Actualizar',
    loading: 'Cargando correos …',
    more: 'Cargar más',
    searchLabel: 'Buscar',
    searchPlaceholder: 'Buscar, p. ej. from:nombre has:attachment',
    searchHint:
      'Rige la sintaxis de búsqueda de Gmail: from:, to:, subject:, has:attachment, newer_than:7d, label:…',
    searchEnd: 'Terminar la búsqueda',
    account: 'Cuenta',
    accountN: (n: number) => `Cuenta ${n}`,
    label: 'Carpeta',
    empty: 'No hay correos en esta vista.',
    emptySearch: 'No se encontró nada.',
    settings: 'Ajustes del correo',
    unread: (n: number) => (n === 1 ? '1 sin leer' : `${n} sin leer`),
    messages: (n: number) => (n === 1 ? '1 mensaje' : `${n} mensajes`),
    demo: 'Correos de ejemplo (datos de prueba). Conecta Gmail para ver los tuyos.',
    cached: 'Sin conexión: se muestra el último estado guardado.',
    groups: { today: 'Hoy', yesterday: 'Ayer', week: 'Esta semana', older: 'Anteriores' },
    noSubject: '(sin asunto)',
    labels: {
      INBOX: 'Recibidos',
      STARRED: 'Destacados',
      IMPORTANT: 'Importantes',
      SENT: 'Enviados',
      DRAFT: 'Borradores',
      TRASH: 'Papelera',
      SPAM: 'Spam',
    },
  },
  connect: {
    title: 'Aún no hay ninguna cuenta de correo conectada',
    body: 'Conecta tu cuenta de Google en Ajustes y activa «Correo». Nemo solo lee: no se envía, borra ni mueve nada.',
    action: 'Ir a Conexiones',
  },
  errors: {
    expired: 'El inicio de sesión de Google ha caducado.',
    denied: 'Falta el permiso para esto. Activa «Correo» en Conexiones y vuelve a iniciar sesión.',
    'rate-limited': 'Google está limitando las peticiones. Inténtalo de nuevo en unos minutos.',
    network: 'Sin conexión con el servicio de correo.',
    generic: 'No se pudieron cargar los correos.',
    action: 'Ir a Conexiones',
  },
  view: {
    back: 'Volver a la lista',
    from: 'De',
    to: 'Para',
    cc: 'Cc',
    attachments: 'Adjuntos',
    download: (name: string) => `Descargar ${name}`,
    saved: 'Adjunto guardado.',
    downloadLabel: 'Descargar',
    downloadFailed: 'No se pudo cargar el adjunto.',
    blockedImages: (n: number) =>
      n === 1 ? '1 imagen externa bloqueada' : `${n} imágenes externas bloqueadas`,
    loadImages: 'Cargar imágenes',
    loadingImages: 'Cargando imágenes …',
    trackers: (n: number) =>
      n === 1 ? '1 píxel de seguimiento eliminado' : `${n} píxeles de seguimiento eliminados`,
    noBody: '(sin texto)',
    frameTitle: (subject: string) => `Contenido del correo: ${subject}`,
    readOnly: 'Nemo solo lee: esto no cambia el estado de leído.',
    openInGmail: 'Abrir en Gmail',
    expand: (who: string) => `Desplegar el mensaje de ${who}`,
    loadFailed: 'No se pudo cargar el correo.',
  },
  panel: {
    title: 'Ajustes del correo',
    accounts: 'Cuentas',
    noAccounts: 'No hay ninguna cuenta conectada.',
    accountsHint: 'Las cuentas se inician y se quitan en Conexiones.',
    manage: 'Abrir Conexiones',
    scopes: 'Permiso',
    scopesBody:
      'La lectura usa el permiso de Google «Leer Gmail» (gmail.readonly). Aún no hay permisos de escritura como archivar o responder; se activarían uno a uno y con explicación.',
    cache: 'Caché',
    cacheBody: (threads: number, bodies: number) =>
      `${threads} cabeceras y ${bodies} correos abiertos, cifrados en este dispositivo. Sin sincronizar y fuera de las copias.`,
    clear: 'Vaciar la caché',
    cleared: 'Caché vaciada.',
    clearTitle: '¿Vaciar la caché?',
    clearBody: 'Los correos siguen en Google. Se vuelven a cargar la próxima vez que los abras.',
    notifications: 'Notificaciones',
    notificationsBody: 'Aún no disponible: la app no avisa sola de correos nuevos.',
    close: 'Cerrar',
  },
  widget: {
    unread: 'Sin leer',
    unreadContext: (n: number) =>
      n === 0
        ? 'La bandeja está vacía'
        : n === 1
          ? 'Conversación sin leer en la bandeja'
          : 'Conversaciones sin leer en la bandeja',
    important: 'Correos destacados',
    importantSummary: (n: number) => (n === 1 ? '1 sin leer' : `${n} sin leer`),
    invoices: 'Correos de facturas',
    invoicesContext: (days: number) => `en los últimos ${days} días`,
    empty: 'Aún no hay correos.',
    emptyAction: 'Abrir el correo',
    link: 'Abrir el correo',
  },
};
