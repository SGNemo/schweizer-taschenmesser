import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Importar desde otra app',
  intro:
    'Elige el archivo o los archivos de tu exportación, también ZIP. Nemo reconoce de qué app vienen y muestra una vista previa antes de añadir nada. Nada sale de este dispositivo.',
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
  sources: {
    enex: 'Evernote (.enex)',
    notion: 'Notion (exportación Markdown y CSV)',
    obsidian: 'Obsidian o carpeta de Markdown',
    'outlook-tasks': 'Microsoft To Do (CSV de Outlook)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Calendar (.ics)',
    bank: 'Movimientos bancarios (CSV, OFX, CAMT)',
    'vault-csv': 'Gestor de contraseñas (Bitwarden, KeePass, 1Password)',
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
