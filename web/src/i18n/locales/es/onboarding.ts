import type { Strings } from '@/strings';

export const onboarding: Strings['onboarding'] = {
  button: 'Configurar datos iniciales',
  title: (module: string) => `Datos iniciales: ${module}`,
  chooseIntro:
    '¿De dónde salen las primeras entradas? No se guarda nada hasta que confirmes la vista previa.',
  skip: 'Omitir',
  skipHint: 'Más adelante vuelves al asistente desde los ajustes del módulo.',
  back: 'Atrás',
  preview: 'Ver vista previa',
  parsing: 'Leyendo …',
  chooseFile: 'Elegir archivo …',
  fileChosen: (name: string) => `Archivo: ${name}`,
  textLabel: 'Una línea = una entrada',
  pickTemplates: 'Elegir sugerencias',
  noInput: 'Escribe algo, por favor.',
  nothingFound: 'No se reconoció ninguna entrada.',
  fileTooLarge: 'El archivo es demasiado grande (máximo 10 MB).',
  readError: 'No se pudo leer el archivo.',
  previewTitle: 'Vista previa',
  previewIntro: 'Aquí ves lo que se guardaría. Quita la marca de las entradas que no quieras.',
  found: (n: number) => (n === 1 ? '1 entrada reconocida' : `${n} entradas reconocidas`),
  selectAll: 'Seleccionar todo',
  selectNone: 'No seleccionar nada',
  duplicate: 'Ya existe',
  change: 'Cambio',
  unchanged: 'Sin cambios',
  invalid: 'No importable',
  importN: (n: number) => (n === 1 ? 'Importar 1 entrada' : `Importar ${n} entradas`),
  importing: 'Guardando …',
  imported: (n: number) => (n === 1 ? 'Se importó 1 entrada.' : `Se importaron ${n} entradas.`),
  undo: 'Deshacer importación',
  undone: (removed: number, kept: number) =>
    kept > 0
      ? `${removed} entradas eliminadas. ${kept} se editaron mientras tanto y se conservan.`
      : `${removed} entradas eliminadas.`,
  close: 'Cerrar',
  recent: 'Importado recientemente',
  recentEntry: (source: string, n: number, date: string) =>
    `${source} · ${n} ${n === 1 ? 'entrada' : 'entradas'} · ${date}`,
  recentUndone: 'deshecho',
  errors: {
    'unknown-collection': 'La importación no corresponde a este módulo.',
    'nothing-selected': 'No hay nada seleccionado.',
    fallback: 'No ha funcionado.',
  } as Record<string, string>,
  add: 'Añadir',
  required: 'Rellena este campo.',

  mail: {
    hint: 'Solo con una cuenta de Google conectada (Ajustes → Conexiones). Las sugerencias salen del remitente, el asunto, la fecha y la línea de vista previa; tú confirmas cada una.',
    invoices: 'Detectar facturas en correos',
    subscriptions: 'Detectar suscripciones en correos',
    contracts: 'Detectar contratos en correos',
    calendar: 'Detectar eventos y entradas en correos',
    source: (url: string) => `Detectado en un correo: ${url}`,
    dueUnclear: 'Vencimiento no detectado: revísalo',
    startUnclear: 'Fecha de cargo estimada: revísala',
    noAmount: (n: number) =>
      n === 1
        ? 'Se omitió 1 factura sin importe reconocible.'
        : `Se omitieron ${n} facturas sin importe reconocible.`,
    noEnd: 'Fin del contrato no detectado',
    notice: (days: number) => `Plazo de cancelación: ${days} ${days === 1 ? 'día' : 'días'}`,
  },
  ics: {
    exdate: (n: number) =>
      `${n} eventos recurrentes tenían días de excepción (días sueltos omitidos); esas excepciones no se importan.`,
    rruleUnsupported: (n: number) =>
      `${n} eventos tienen una repetición que esta app no conoce; se importan como evento único.`,
    override: (n: number) => `Se omitieron ${n} eventos modificados de una serie.`,
    cancelled: (n: number) => `Se omitieron ${n} eventos cancelados.`,
    invalid: (n: number) => `Se omitieron ${n} eventos sin fecha válida.`,
  },
  lines: (skipped: number) =>
    skipped === 1 ? 'No se reconoció 1 línea.' : `No se reconocieron ${skipped} líneas.`,
  calendar: {
    ics: 'Archivo de calendario (.ics)',
    icsHint:
      'Exporta tu calendario (p. ej. Google Calendar, Outlook, Thunderbird) como archivo .ics y elígelo aquí.',
  },
  todos: {
    text: 'Pegar tareas',
    textHint: 'Pega una lista de una app de notas o de un mensaje: una línea por tarea.',
    placeholder: 'Ordenar papeles de impuestos\nLlamar al dentista\nArreglar la bici',
    list: 'En esta lista',
  },
  reminders: {
    textDetail: 'hoy, 09:00',
    templates: 'Plantillas de recordatorios habituales',
    templatesHint: 'Elige qué quieres que te recuerde la app. Luego puedes cambiar horas y días.',
    text: 'Pegar recordatorios',
    textHint: 'Una línea por recordatorio; empieza hoy a las 09:00 y luego puedes ajustarlo.',
    placeholder: 'Cambiar los neumáticos\nComprar un regalo para mamá',
    rent: ['Pagar el alquiler', 'cada mes el día 1'],
    trash: ['Sacar la basura', 'cada semana, domingo 19:00 (ajusta luego el día)'],
    insurance: [
      'Comparar el seguro del coche',
      'cada año el 1 de noviembre (plazo de cambio, normalmente 30/11)',
    ],
    energy: ['Revisar contratos de luz y gas', 'cada año el 1 de septiembre'],
    tax: ['Reunir papeles de impuestos', 'cada año el 1 de junio'],
    dentist: ['Pedir revisión en el dentista', 'cada 6 meses'],
    smoke: ['Probar el detector de humo', 'cada año el 1 de enero'],
    statements: ['Revisar extractos bancarios', 'cada mes el día 1'],
  },
  finance: {
    account: 'Crear cuenta con saldo inicial',
    accountHint: 'Para una cuenta más. La cuenta existente se cambia en Finanzas → Cuentas.',
    name: 'Nombre de la cuenta',
    balance: 'Saldo de hoy',
    balanceHint: (sample: string) => `p. ej. ${sample}; si es negativo, con «-».`,
    badBalance: (sample: string) => `Introduce un importe como ${sample}.`,
    bank: 'Importar extracto bancario (CSV o CAMT)',
    bankHint:
      'En la banca online, exporta los movimientos (p. ej. «CSV-CAMT» o «CAMT») y elige el archivo aquí. El archivo solo se lee en este dispositivo.',
    bankAccount: 'Registrar en la cuenta',
    noAccounts: 'Primero crea una cuenta.',
    bankFormat:
      'No se reconoció el formato del archivo. Se espera un CSV con fecha de movimiento e importe o un archivo CAMT (XML).',
    bankSkipped: (n: number) =>
      n === 1
        ? 'Se omitió 1 línea sin fecha o importe válido.'
        : `Se omitieron ${n} líneas sin fecha o importe válido.`,
    bankTruncated: (n: number) => `Solo se muestran los primeros ${n} movimientos.`,
  },
  invoices: {
    form: 'Registrar factura pendiente',
    payee: 'Emisor',
    amount: 'Importe',
    due: 'Vence el',
    reference: 'Referencia (opcional)',
    badAmount: (sample: string) => `Introduce un importe como ${sample}.`,
    badDate: 'Introduce una fecha como 15.03.2026.',
  },
  subscriptions: {
    form: 'Registrar suscripción',
    name: 'Nombre',
    amount: 'Precio por cargo',
    rhythm: 'Frecuencia',
    monthly: 'mensual',
    quarterly: 'trimestral',
    yearly: 'anual',
    next: 'Próximo cargo el',
    notice: 'Plazo de cancelación en días (opcional)',
    badAmount: (sample: string) => `Introduce un importe como ${sample}.`,
    badDate: 'Introduce una fecha como 15.03.2026.',
    badNotice: 'Introduce un número entero.',
    bank: 'Detectar suscripciones en el extracto',
    bankHint:
      'Elige un extracto bancario (CSV o CAMT, mejor de un año). La app busca cargos regulares del mismo importe y los sugiere como suscripción. El archivo solo se lee en este dispositivo.',
    bankFormat:
      'No se reconoció el formato del archivo. Se espera un CSV con fecha de movimiento e importe o un archivo CAMT (XML).',
    bankNone:
      'No se encontraron cargos regulares. Para detectarlos hacen falta al menos tres cargos iguales con un intervalo parecido.',
    seen: (n: number, last: string) => `${n} ${n === 1 ? 'cargo' : 'cargos'}, el último el ${last}`,
  },
  bookmarks: {
    html: 'Marcadores del navegador (HTML)',
    htmlHint:
      'Exporta los marcadores de tu navegador como archivo HTML (Chrome/Edge: Administrador de marcadores → ⋮ → Exportar marcadores). Los nombres de carpeta se convierten en etiquetas.',
    text: 'Pegar enlaces',
    textHint: 'Una línea por enlace, opcionalmente con un título delante.',
    placeholder: 'https://example.org/articulo\nRuta bonita https://example.org/senderismo',
  },
  birthdays: {
    text: 'Pegar cumpleaños',
    textHint: 'Una línea por persona: nombre y fecha, con o sin año.',
    placeholder: 'Ana Ejemplo 15.03.1985\nTío Max 02.11.\n24.12. Abuela',
  },
  lists: {
    text: 'Pegar lista de la compra',
    textHint: 'Una línea por artículo; se reconocen cantidades como «2 leche».',
    placeholder: '2 leche\npan\n500 g harina',
    templates: 'Plantillas de listas de equipaje',
    templatesHint: 'Listas hechas para viajes típicos; luego puedes cambiarlas.',
    packingKind: 'Lista de equipaje',
    weekend: {
      name: 'Escapada de fin de semana',
      note: 'Dos noches, tren y equipaje de mano',
      items: [
        'Cepillo de dientes',
        'Cargador',
        'Chubasquero',
        'Ropa de recambio',
        'Billete de tren',
        'Auriculares',
        'Gafas de sol',
        'Libro',
      ],
    },
    camping: {
      name: 'Camping',
      note: 'Tres días junto al lago',
      items: [
        'Tienda de campaña',
        'Saco de dormir',
        'Esterilla',
        'Hornillo',
        'Linterna frontal',
        'Antimosquitos',
        'Bidón de agua',
        'Navaja',
        'Bolsas de basura',
        'Protector solar',
      ],
    },
    beach: {
      name: 'Vacaciones de playa',
      note: '',
      items: [
        'Bañador',
        'Toalla de playa',
        'Chanclas',
        'Sombrero',
        'Pasaporte',
        'Botiquín de viaje',
      ],
    },
    ski: {
      name: 'Fin de semana de esquí',
      note: '',
      items: [
        'Chaqueta de esquí',
        'Guantes',
        'Gafas de esquí',
        'Ropa térmica',
        'Forfait',
        'Bálsamo labial',
      ],
    },
  },
};
