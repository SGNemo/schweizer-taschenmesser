import type { Strings } from '@/strings';

export const connectors: Strings['connectors'] = {
  title: 'Conexiones',
  errors: {
    expired: 'La conexión ha caducado. Vuelve a iniciar sesión.',
    'rate-limited': 'El servicio indicó demasiadas solicitudes. Se volverá a intentar más tarde.',
    'not-configured': 'Aún faltan datos de acceso.',
    'no-proxy':
      'En el navegador, esta consulta necesita el servidor de sincronización (Ajustes → Sincronización).',
    network: 'El servicio no está disponible ahora mismo.',
    denied: 'El inicio de sesión se canceló o fue rechazado.',
    'bad-response': 'El servicio envió una respuesta inesperada.',
    unsupported: 'Esto no es posible en este dispositivo.',
  } as Record<string, string>,
  icsName: 'Suscripción de calendario (ICS)',
  icsDescription:
    'Importa eventos desde la dirección de un calendario (solo lectura). Funciona con Google Calendar, Outlook, Nextcloud y muchos otros.',
  intro: 'Trae eventos y sugerencias de servicios que ya usas. Todo es de solo lectura.',
  statusLabel: 'Estado',
  status: {
    disconnected: 'No conectado',
    connected: 'Conectado',
    expired: 'Caducado',
    'rate-limited': 'En pausa',
    error: 'Error',
  } as Record<string, string>,
  lastSync: (when: string) => `Última sincronización: ${when}`,
  events: (n: number) => (n === 1 ? '1 evento importado' : `${n} eventos importados`),
  connect: 'Conectar',
  reconnect: 'Volver a iniciar sesión',
  cancelLogin: 'Cancelar inicio de sesión',
  connecting: 'Esperando el inicio de sesión en el navegador …',
  disconnect: 'Desconectar',
  syncNow: 'Sincronizar ahora',
  syncing: 'Sincronizando …',
  syncDone: (added: number, updated: number, removed: number) =>
    `Listo: ${added} ${added === 1 ? 'nuevo' : 'nuevos'}, ${updated} ${updated === 1 ? 'cambiado' : 'cambiados'}, ${removed} ${removed === 1 ? 'eliminado' : 'eliminados'}.`,
  desktopOnly:
    'El inicio de sesión solo funciona en la app de Windows. En el móvil y en el navegador, los eventos llegan por sincronización o por una suscripción de calendario (ICS).',
  features: '¿Qué se debe leer?',
  calendars: 'Calendarios',
  calendarsHint: 'Solo se importan los calendarios marcados.',
  disconnectTitle: (name: string) => `¿Desconectar ${name}?`,
  disconnectBody:
    'Se revoca el acceso en el servicio y se eliminan de este dispositivo los datos de inicio de sesión guardados.',
  keepData: 'Conservar los eventos importados',
  deleteData: 'Eliminar los eventos importados',
  client: {
    title: 'Aplicación propia de Google',
    intro:
      'Para iniciar sesión necesitas tu propio «ID de cliente OAuth» (tipo app de escritorio) de Google Cloud Console. Las instrucciones están en docs/MANUAL-TESTS.md, en «Anleitungen für Sven».',
    id: 'ID de cliente',
    secret: 'Secreto de cliente',
    secretHint: 'Google lo exige también en apps de escritorio; ahí no se considera confidencial.',
    save: 'Guardar',
    saved: 'Datos de acceso guardados.',
    missing: 'Primero introduce el ID de cliente.',
  },
  scan: {
    title: 'Buscar en correos',
    intro:
      'De los últimos correos, la app solo lee remitente, asunto, fecha y la línea de vista previa, y busca en ellos de forma local facturas, suscripciones, eventos y contratos. Solo se guarda lo que confirmas en la vista previa; el texto del correo nunca se guarda ni se envía a una IA.',
    period: 'Periodo',
    months: (n: number) => (n === 1 ? 'Último mes' : `Últimos ${n} meses`),
    start: 'Leer correos',
    reading: (done: number, total: number) => `Leyendo correos … ${done} de ${total}`,
    summary: (n: number, months: number) =>
      `${n} ${n === 1 ? 'correo leído' : 'correos leídos'} ${months === 1 ? 'del último mes' : `de los últimos ${months} meses`} (remitente, asunto, fecha, línea de vista previa).`,
    notConnected: 'Primero conecta Google en Ajustes → Conexiones y activa «Correos».',
    none: 'No se encontró nada relevante en estos correos.',
  },
  ics: {
    listLabel: 'Suscripciones de calendario',
    name: 'Nombre (opcional)',
    defaultName: (n: number) => `Calendario ${n}`,
    url: 'Dirección del calendario',
    urlHint:
      'p. ej. en Google Calendar: Configuración → Calendario → Integrar → «Dirección secreta en formato iCal». No la compartas.',
    add: 'Añadir calendario',
    checking: 'Comprobando …',
    remove: (name: string) => `Quitar el calendario «${name}»`,
    badUrl: 'No es una dirección válida (https://… o webcal://…).',
    notACalendar: 'En esta dirección no hay ningún calendario.',
    unreachable: 'No se puede acceder a la dirección.',
    noProxy:
      'En el navegador hace falta el servidor de sincronización (Ajustes → Sincronización), porque los servicios de calendario bloquean la consulta desde el navegador.',
  },
  google: {
    name: 'Google',
    description:
      'Lee calendarios y busca en los correos facturas, suscripciones, eventos y contratos. Solo lectura.',
    calendarFeature: 'Calendario',
    calendarFeatureHint: 'Muestra eventos de tus calendarios de Google.',
    mailFeature: 'Correos',
    mailFeatureHint: 'Busca facturas, suscripciones, eventos y contratos con un clic.',
  },
};
