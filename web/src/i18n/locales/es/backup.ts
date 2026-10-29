import type { Strings } from '@/strings';

const entries = (n: number) => (n === 1 ? '1 entrada' : `${n} entradas`);

export const backup: Strings['backup'] = {
  deletedCount: (n: number) => ` (+${n} ${n === 1 ? 'eliminada' : 'eliminadas'})`,
  title: 'Copia de seguridad',
  intro:
    'Guarda todos los datos en un archivo o restaura una copia de seguridad. Los datos de acceso (token de sincronización, claves) nunca se incluyen.',
  export: 'Descargar copia de seguridad',
  exported: 'Copia de seguridad descargada.',
  file: 'Archivo de copia de seguridad',
  mode: 'Restauración',
  merge: 'Combinar',
  mergeHint: 'No se pierde nada; en caso de conflicto gana el cambio más reciente.',
  replace: 'Reemplazar',
  replaceHint:
    'La copia pasa a ser el estado actual: se eliminan las entradas que no estén en ella.',
  doImport: 'Importar',
  contains: (records: number, tables: number) =>
    `${entries(records)} en ${tables} ${tables === 1 ? 'tabla' : 'tablas'}`,
  confirmTitle: '¿Reemplazar con la copia?',
  confirmText:
    'Se eliminarán todas las entradas que no estén en la copia, también en otros dispositivos en cuanto se sincronicen.',
  done: (records: number, removed: number) =>
    removed > 0
      ? `${entries(records)} ${records === 1 ? 'restaurada' : 'restauradas'}, ${removed} ${removed === 1 ? 'eliminada' : 'eliminadas'}.`
      : `${entries(records)} ${records === 1 ? 'restaurada' : 'restauradas'}.`,
  encryptedExport: 'Exportar cifrada',
  encryptedExported: 'Copia de seguridad cifrada descargada.',
  exportHint:
    'Recomendado: guardar con contraseña. Así el archivo queda cifrado y se nota cualquier cambio. Sin contraseña, todas las entradas se pueden leer en el archivo.',
  exportPassphrase: 'Contraseña de la copia',
  exportPassphraseHint:
    'Mínimo 8 caracteres. Sin esta contraseña no se puede abrir la copia y no hay forma de restablecerla.',
  passphraseTooShort: 'La contraseña necesita al menos 8 caracteres.',
  openPassphrase: 'Contraseña de la copia',
  unlock: 'Abrir',
  verify: 'Comprobar copia',
  verifyHint:
    'Comprueba el archivo y lo restaura de prueba en una base de datos temporal. Tus datos no se tocan.',
  verifying: 'Comprobando …',
  verifyOk: 'La copia está bien y se puede restaurar.',
  verifyFailed: 'La copia no está bien.',
  verifyExported: (when: string) => `Creada el ${when}`,
  verifyTotals: (records: number, tombstones: number) =>
    `${entries(records)}, ${tombstones} ${tombstones === 1 ? 'marca de eliminación' : 'marcas de eliminación'}`,
  skippedOnRestore: (n: number) =>
    n === 1
      ? 'Esta versión de la app ya no reconoce 1 tabla del archivo (p. ej. módulos antiguos como Compra, Listas de equipaje o Hábitos) y no se restaurará.'
      : `Esta versión de la app ya no reconoce ${n} tablas del archivo (p. ej. módulos antiguos como Compra, Listas de equipaje o Hábitos) y no se restaurarán.`,
  verifySkipped: (n: number) =>
    n === 1
      ? '1 tabla procede de otra versión de la app y se omite.'
      : `${n} tablas proceden de otra versión de la app y se omiten.`,
  steps: {
    format: 'Formato del archivo',
    checksum: 'Suma de comprobación (SHA-256)',
    decrypt: 'Descifrado',
    structure: 'Contenido válido',
    restore: 'Restauración de prueba',
    counts: 'Recuento por módulo correcto',
  } as Record<string, string>,
  stepStatus: { ok: 'bien', failed: 'error', skipped: '–' } as Record<string, string>,
  core: 'Ajustes',
  previewTitle: 'Esto pasará al restaurar',
  previewRow: (module: string, added: number, replaced: number, removed: number) =>
    `${module}: ${added} ${added === 1 ? 'nueva' : 'nuevas'}, ${replaced} ${replaced === 1 ? 'reemplazada' : 'reemplazadas'}${removed > 0 ? `, ${removed} ${removed === 1 ? 'eliminada' : 'eliminadas'}` : ''}`,
  previewTotals: (added: number, replaced: number, removed: number) =>
    `Total: ${added} se añaden, ${replaced} se reemplazan, ${removed} se eliminan.`,
  previewNothing: 'No cambia nada.',
  safetyNote:
    'Antes, la app guarda una copia de seguridad de tus datos actuales. En el navegador llega como descarga a tu carpeta de Descargas (cifrada con la contraseña si pusiste una); en la app va a la carpeta de datos. Si algo falla, todo queda como estaba.',
  plainHint:
    'Sin contraseña: archivo legible. La suma de comprobación detecta daños y cambios accidentales, pero no los deliberados.',
  filesNote:
    'No incluido en la copia: archivos de documentos (archivos de Documentos). Se quedan solo en este dispositivo.',
  noChecksum:
    'Este archivo no tiene suma de comprobación (versión anterior). No se puede saber si fue modificado.',
  restoring: 'Restaurando …',
  autoTitle: 'Copias automáticas',
  autoIntro:
    'La app guarda copias cifradas con regularidad en su carpeta de datos y conserva las más recientes. La contraseña se guarda en el almacén de claves del dispositivo.',
  autoUnsupported: 'Las copias automáticas solo existen en la app instalada (Windows, Android).',
  autoEnable: 'Copia automática',
  autoInterval: 'Frecuencia',
  autoDaily: 'Diaria',
  autoWeekly: 'Semanal',
  autoKeep: 'Número de copias',
  autoPassphrase: 'Contraseña para copias automáticas',
  autoPassphraseSet: 'Contraseña guardada. Introduce una nueva para reemplazarla.',
  autoPassphraseHint:
    'Mínimo 8 caracteres. Apúntala: sin la contraseña no se pueden abrir las copias.',
  autoSavePassphrase: 'Guardar contraseña',
  autoRunNow: 'Hacer copia ahora',
  autoLast: 'Última copia',
  autoNever: 'ninguna todavía',
  autoLastFailed: 'La última copia falló.',
  autoNeedPassphrase: 'Primero define una contraseña.',
  autoCreated: 'Copia creada.',
  autoFiles: 'Copias existentes',
  autoNoFiles: 'Todavía no hay copias.',
  autoUse: 'Abrir',
  autoSaveAs: 'Guardar como …',
  errors: {
    'not-json': 'El archivo no es un JSON válido.',
    'wrong-format': 'Esto no es un archivo de copia de seguridad de Nemo.',
    'newer-version': 'La copia procede de una versión más reciente de la app.',
    invalid: 'El archivo de copia de seguridad está dañado.',
    'passphrase-required': 'Esta copia está cifrada. Introduce la contraseña.',
    'wrong-passphrase': 'Contraseña incorrecta, o el archivo se ha modificado.',
    'checksum-mismatch':
      'La suma de comprobación no coincide: el archivo está dañado, incompleto o fue modificado.',
    'restore-failed': 'La restauración de prueba falló.',
    'count-mismatch': 'Faltan entradas tras la restauración de prueba.',
    'safety-failed': 'No se pudo crear la copia de seguridad previa. No se ha cambiado nada.',
    'safety-cancelled': 'Sin copia de seguridad previa no se restaura. No se ha cambiado nada.',
    'restore-error': 'La restauración falló. No se ha cambiado nada.',
  } as Record<string, string>,
};
