import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Mudanza desde otra app',
  intro:
    'Trae tus datos de Google, Todoist, Notion, una app de banco y más. Nemo reconoce los archivos y muestra una vista previa antes de añadir nada; cada mudanza se puede deshacer por completo. Nada sale de este dispositivo.',
  choose: 'Elegir archivos',
  reading: (done: number, total: number) => `Leyendo archivos … ${done} de ${total}`,
  cancel: 'Cancelar',
  parsing: 'Leyendo datos …',
  detected: (apps: string) => `Reconocido: ${apps}`,
  unknown: 'No reconozco de qué app son estos archivos. Elige tú el origen:',
  manual: 'Elegir otro origen',
  step: (i: number, n: number) => `Parte ${i} de ${n}`,
  nothing: 'No se encontró nada legible en los archivos.',
  vaultHint:
    'Las contraseñas se importan en la bóveda, tras introducir la contraseña maestra. Allí se abre la importación de CSV.',
  openVault: 'Ir a la bóveda',
  paletteCommand: 'Importar desde otra app …',
  start: 'Empezar la mudanza',
  back: 'Atrás',
  privacy: 'Los archivos solo se leen en este dispositivo. No se sube nada.',
  whereTitle: '¿De dónde vienes?',
  whereLead:
    '¿De dónde vienes? Elige la app de la que vienen tus datos. Nemo reconoce el resto por los archivos.',
  stepOf: (i: number, n: number) => `Paso ${i} de ${n}`,
  steps: {
    label: 'Pasos',
    where: 'Origen',
    files: 'Archivos',
    check: 'Revisar',
  },
  origins: {
    google: {
      title: 'Google',
      how: 'En takeout.google.com elige Calendar, Contactos, Keep y Tasks y descarga el archivo ZIP. Puedes elegir el ZIP tal cual.',
    },
    apple: {
      title: 'Apple (iPhone, Mac)',
      how: 'Calendario: «Exportar» en la app Calendario (.ics). Contactos: exportar como vCard en la app Contactos.',
    },
    microsoft: {
      title: 'Microsoft (Outlook, To Do)',
      how: 'Microsoft To Do no tiene exportación propia: en Outlook usa «Exportar» → CSV → Tareas. Calendario como .ics, contactos como vCard.',
    },
    todoist: {
      title: 'Todoist',
      how: 'En Todoist descarga la copia de seguridad como ZIP (Ajustes → Copias de seguridad) o exporta un proyecto como plantilla CSV.',
    },
    ticktick: {
      title: 'TickTick',
      how: 'En TickTick ve a Ajustes → Cuenta, «Generar copia de seguridad» y guarda el archivo CSV.',
    },
    notion: {
      title: 'Notion',
      how: 'En Notion elige «Exportar» → «Markdown y CSV» y guarda el archivo ZIP.',
    },
    evernote: { title: 'Evernote', how: 'En Evernote exporta las libretas como archivo .enex.' },
    obsidian: {
      title: 'Obsidian, Markdown',
      how: 'Elige los archivos Markdown o tu carpeta de Obsidian como ZIP.',
    },
    bank: {
      title: 'Banco, extracto',
      how: 'En la banca online descarga los movimientos como CSV, CAMT, OFX o QIF.',
    },
    passwords: {
      title: 'Gestor de contraseñas',
      how: 'Exporta Bitwarden, 1Password o KeePass como CSV. La importación se hace luego en la bóveda, con tu contraseña maestra.',
    },
    browser: {
      title: 'Marcadores del navegador',
      how: 'Exporta los marcadores como archivo HTML en el navegador (Chrome, Firefox, Edge, Safari, Brave).',
    },
    other: { title: 'No lo sé', how: 'Elige los archivos sin más. Nemo reconoce de dónde vienen.' },
  },
  foundTitle: 'Reconocido',
  nothingTitle: 'Nada reconocido',
  pickSource: 'Elige tú la fuente:',
  certainty: {
    sure: 'reconocido con seguridad',
    likely: 'probable',
    maybe: 'quizá',
  },
  why: {
    'vault-csv':
      'Las columnas encajan con un gestor de contraseñas. Solo se cuentan las filas; la importación se hace en la bóveda.',
    ticktick: 'Cabecera de una copia de TickTick (List Name, Title, Kind).',
    todoist: 'Columnas TYPE y CONTENT como en una exportación de Todoist, un archivo por proyecto.',
    'google-tasks': 'Archivo de tareas de Google Takeout («tasks#…»).',
    'outlook-tasks': 'Columnas como Asunto y Vencimiento de una exportación de tareas de Outlook.',
    'google-keep': 'Notas de Keep de Google Takeout (JSON).',
    'google-calendar': 'Archivo de calendario en formato iCalendar.',
    enex: 'Exportación de Evernote (.enex).',
    notion: 'Nombres de archivo con el identificador de Notion (título y 32 caracteres).',
    opml: 'Lista OPML con direcciones de feeds.',
    contacts: 'Tarjetas de contacto en formato vCard. Se toman los contactos con cumpleaños.',
    bookmarks: 'Archivo de marcadores tal como lo exporta cualquier navegador.',
    obsidian: 'Archivos Markdown; con una carpeta .obsidian, seguro que de Obsidian.',
    bank: 'Columnas de fecha e importe, o un formato bancario (CAMT, OFX, QIF).',
  },
  units: {
    projects: (n: number) => n1(n, '1 proyecto', `${n} proyectos`),
    lists: (n: number) => n1(n, '1 lista', `${n} listas`),
    tasks: (n: number) => n1(n, '1 tarea', `${n} tareas`),
    notes: (n: number) => n1(n, '1 nota', `${n} notas`),
    events: (n: number) => n1(n, '1 evento', `${n} eventos`),
    contacts: (n: number) => n1(n, '1 contacto', `${n} contactos`),
    bookmarks: (n: number) => n1(n, '1 marcador', `${n} marcadores`),
    transactions: (n: number) => n1(n, '1 movimiento', `${n} movimientos`),
    feeds: (n: number) => n1(n, '1 feed', `${n} feeds`),
    entries: (n: number) => n1(n, '1 entrada', `${n} entradas`),
  },
  goesTo: (module: string) => `Destino: ${module}.`,
  openPreview: 'Abrir vista previa',
  runDone: (n: number) => n1(n, 'Se añadió 1 entrada.', `${n} entradas añadidas.`),
  runParts: 'Añadido por área',
  runPart: (module: string, n: number) => `${module}: ${n}`,
  runUndoHint:
    '«Deshacer toda la mudanza» revierte todas las partes. Lo que hayas cambiado desde entonces se queda.',
  undoRun: 'Deshacer toda la mudanza',
  undoRunShort: 'Deshacer',
  recentTitle: 'Últimas mudanzas',
  recentRun: (source: string, date: string) => `${source}, ${date}`,
  emptyTitle: 'Aún no hay mudanzas',
  emptyText: 'Aquí aparece cada mudanza. Más tarde puedes deshacerla por completo.',
  checklist: 'Lista de control',
  checklistHint: 'Lo que aún falta para la mudanza, paso a paso.',
  sources: {
    enex: 'Evernote (.enex)',
    notion: 'Notion (exportación Markdown y CSV)',
    opml: 'OPML (apps de feeds y podcasts)',
    obsidian: 'Obsidian o carpeta de Markdown',
    'outlook-tasks': 'Microsoft To Do (CSV de Outlook)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Calendar (.ics)',
    bank: 'Movimientos bancarios (CSV, OFX, CAMT)',
    'vault-csv': 'Gestor de contraseñas (Bitwarden, KeePass, 1Password)',
    ticktick: 'TickTick (copia CSV)',
    contacts: 'Contactos (vCard: Google, Apple, Outlook)',
    bookmarks: 'Marcadores del navegador (HTML)',
  },
  reasons: {
    trashed: (n: number) =>
      n1(
        n,
        'Se omitió 1 entrada de la papelera o del archivo.',
        `Se omitieron ${n} entradas de la papelera o del archivo.`,
      ),
    empty: (n: number) => n1(n, 'Se omitió 1 entrada vacía.', `Se omitieron ${n} entradas vacías.`),
    unreadable: (n: number) =>
      n1(
        n,
        'Se omitió 1 archivo ilegible o de otra app.',
        `Se omitieron ${n} archivos ilegibles o de otra app.`,
      ),
    attachment: (n: number) =>
      n1(
        n,
        'No se importó 1 adjunto (imagen o archivo): las notas solo guardan texto.',
        `No se importaron ${n} adjuntos (imágenes o archivos): las notas solo guardan texto.`,
      ),
    unsupported: (n: number) =>
      n1(n, '1 entrada no es compatible.', `${n} entradas no son compatibles.`),
    tooMany: (n: number) =>
      `La vista previa muestra como máximo ${n} entradas; el resto se omitió.`,
    done: (n: number) =>
      n1(n, 'Se omitió 1 entrada completada.', `Se omitieron ${n} entradas completadas.`),
  },
  report: {
    title: 'Informe',
    imported: (n: number) => n1(n, '1 entrada importada.', `${n} entradas importadas.`),
    duplicates: (n: number) => n1(n, '1 ya existía.', `${n} ya existían.`),
    invalid: (n: number) =>
      n1(
        n,
        '1 no encajaba en el formato y no se guardó.',
        `${n} no encajaban en el formato y no se guardaron.`,
      ),
    deselected: (n: number) => n1(n, 'Desmarcaste 1.', `Desmarcaste ${n}.`),
  },
  newNotebook: 'Cuaderno nuevo',
};
