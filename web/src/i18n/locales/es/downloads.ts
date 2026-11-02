import type { Strings } from '@/strings';

export const downloads: Strings['downloads'] = {
  meta: {
    name: 'Descargas',
    description:
      'Descarga archivos: progreso, pausa, reanudar, límite de velocidad y suma de verificación. Nada se abre automáticamente.',
    widget: 'Descargas en curso',
    widgetEmpty: 'No hay descargas.',
    widgetAction: 'Añadir una descarga',
    widgetSummary: (running: number, waiting: number) =>
      waiting > 0
        ? `${running} en curso · ${waiting} en espera o en pausa`
        : running === 1
          ? '1 en curso'
          : `${running} en curso`,
  },
  settings: {
    limitKb: 'Límite de velocidad para todas las descargas (KB/s, 0 = sin límite)',
    folder: 'Carpeta de descargas (vacío = la carpeta Descargas del sistema)',
  },
  unsupported: {
    title: 'El gestor de descargas solo está en la app de escritorio',
    body: 'En este dispositivo, el navegador de tu dispositivo descarga los archivos.',
  },
  hint: 'Los archivos solo van a la carpeta elegida. Nemo nunca los abre ni los ejecuta.',
  add: {
    button: 'Añadir una descarga',
    title: 'Añadir una descarga',
    url: 'Dirección (http:// o https://)',
    folder: 'Carpeta',
    pick: 'Elegir carpeta',
    hash: 'Suma de verificación (opcional, SHA-256 o SHA-512)',
    hashHelp: 'El archivo terminado se compara con ella.',
    submit: 'Descargar',
    cancel: 'Cancelar',
    http: 'Esta dirección no está cifrada (HTTP).',
  },
  errors: {
    scheme: 'Solo funcionan direcciones con http:// o https://.',
    url: 'Eso no es una dirección válida.',
    dir: 'La carpeta no existe.',
    hash: 'La suma de verificación necesita 64 (SHA-256) o 128 (SHA-512) caracteres de 0–9 y a–f.',
    other: 'No ha funcionado.',
  },
  state: {
    queued: 'En espera',
    running: 'Descargando',
    paused: 'En pausa',
    done: 'Listo',
    failed: 'Fallido',
  },
  failed: {
    http: 'El servidor no entregó el archivo.',
    io: 'No se pudo escribir el archivo.',
    checksum: 'La suma de verificación no coincide. Se eliminó el archivo.',
    size: 'El archivo llegó incompleto.',
  },
  row: {
    progress: (done: string, total: string) => `${done} de ${total}`,
    unknownTotal: (done: string) => `${done} descargados`,
    speed: (perSecond: string) => `${perSecond}/s`,
    limited: (perSecond: string) => `Límite ${perSecond}/s`,
  },
  actions: {
    pause: 'Pausar',
    resume: 'Reanudar',
    retry: 'Reintentar',
    reveal: 'Mostrar en la carpeta',
    remove: 'Quitar de la lista',
    removeData: 'Eliminar con el archivo',
    more: 'Más',
  },
  checksum: {
    label: 'SHA-256',
    verify: 'Comparar la suma de verificación',
    verifyTitle: 'Comparar la suma de verificación',
    field: 'Suma de verificación (SHA-256 o SHA-512)',
    match: 'Coincide',
    mismatch: 'No coincide',
    submit: 'Comparar',
  },
  deleteData: {
    title: '¿Eliminar el archivo?',
    body: (name: string) => `«${name}» se elimina del disco, también si está sin terminar.`,
    confirm: 'Eliminar',
  },
  empty: {
    title: 'Aún no hay descargas',
    body: 'Pega una dirección o descarga algo en el navegador. Nada se abre automáticamente.',
  },
};
