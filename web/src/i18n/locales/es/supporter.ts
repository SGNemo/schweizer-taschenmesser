import type { Strings } from '@/strings';

export const supporter: Strings['supporter'] = {
  tier: { kaffee: 'Café', kuchen: 'Pastel', developer: 'Desarrollador' },
  section: {
    title: 'Colaborador',
    keywords: ['donación', 'apoyar', 'colaborar', 'café', 'gracias', 'código', 'Ko-fi', 'Spende'],
    intro:
      'Nemo es gratis y lo seguirá siendo: todas las funciones están abiertas a todo el mundo. Si te gusta la app, puedes aportar algo de forma voluntaria; cualquier cantidad ayuda. Como pequeño agradecimiento hay extras puramente estéticos: una insignia de «Gracias» y temas de color adicionales.',
    donate: 'Apoyar de forma voluntaria',
    donateHint:
      'Abre la página de pago en el navegador. Solo se paga allí; Nemo no procesa datos de pago.',
    codeLabel: 'Código de colaborador',
    codeHint:
      'Recibirás el código automáticamente por correo tras la donación. Pégalo aquí; solo se comprueba en este dispositivo.',
    codePlaceholder: 'NEMO1-…',
    paste: 'Pegar',
    pasteFailed: 'No se pudo pegar. Pega el código directamente en el campo.',
    save: 'Aplicar código',
    invalid: 'Este código no es válido. Comprueba que lo copiaste completo.',
    accepted: '¡Gracias! Código aplicado.',
    statusTitle: 'Tu estado',
    tierLabel: 'Nivel',
    nameLabel: 'Nombre',
    issuedLabel: 'Emitido el',
    notSupporter: 'Aún no has introducido ningún código. Está totalmente bien, no te falta nada.',
    remove: 'Quitar código',
    removed: 'Código quitado. Puedes volver a introducirlo cuando quieras.',
    unrecognised:
      'Esta versión de la app no reconoce un código guardado. Actualiza la app o vuelve a introducir el código.',
    sidebarBadge: 'Insignia de agradecimiento en la barra lateral',
    sidebarBadgeHint: 'Muestra el nivel discretamente bajo el logo.',
    noMail: '¿No te ha llegado? Mira también en la carpeta de spam.',
    resend: 'Reenviar código',
    contact: 'Contactar',
    linkOpen: 'Abrir',
  },
  aboutRow: {
    label: 'Apoyar Nemo',
    description: 'Voluntario, con extras estéticos como agradecimiento.',
    open: 'Saber más',
  },
  badge: {
    thanks: 'Gracias',
    thanksName: (name: string) => `Gracias, ${name}`,
  },
  palette: {
    label: 'Tema de color',
    hintSupporter: 'Solo visual; puedes volver al estándar cuando quieras.',
    hintLocked:
      'Los temas de color adicionales son un pequeño agradecimiento para colaboradores. Aun así puedes probarlos: un clic muestra el tema durante 30 segundos.',
    standard: 'Estándar',
    names: {
      korallenriff: 'Arrecife de coral',
      tiefsee: 'Mar profundo',
      sand: 'Arena',
      nordlicht: 'Aurora boreal',
      monochrom: 'Monocromo',
    },
    choose: (name: string) => `Elegir el tema de color ${name}`,
    tryOut: (name: string) => `Ver el tema de color ${name} durante 30 segundos`,
    locked: 'Para colaboradores',
    previewing: (name: string) => `Vista previa: ${name}`,
    previewEnd: 'Terminar vista previa',
    accentFollows: 'El tema de color define el color de acento.',
  },
  logo: {
    label: 'Logo en el color del tema',
    hint: 'El pez adopta el color de acento.',
    hintLocked: 'Para colaboradores.',
  },
};
