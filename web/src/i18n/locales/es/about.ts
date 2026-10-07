import type { Strings } from '@/strings';

export const about: Strings['about'] = {
  title: 'Acerca de Nemo',
  tagline: 'App modular y local para el día a día',
  version: 'Versión',
  build: 'Compilación',
  commit: 'Commit',
  channel: 'Canal',
  channelStable: 'Estable',
  channelDev: 'Dev preview',
  platform: 'Plataforma',
  platforms: { web: 'Navegador', desktop: 'App de Windows', android: 'App de Android' },
  install: 'Tipo de instalación',
  installKinds: {
    portable: 'Portátil (carpeta con datos)',
    installed: 'Instalada',
    apk: 'App de Android (APK)',
    pwa: 'App web instalada (PWA)',
    browser: 'Pestaña del navegador',
  },
  dataDir: 'Carpeta de datos',
  openDataDir: 'Abrir carpeta',
  openDataDirFailed: 'No se pudo abrir la carpeta.',
  license: 'Licencia',
  licenseValue: 'Licencia MIT',
  updates: {
    title: 'Actualizaciones y cambios',
    lastCheck: 'Última comprobación',
    never: 'Nunca',
    browser: 'En el navegador, la app se actualiza sola.',
    current: 'Cambios de esta versión',
    available: (version: string) => `Cambios en la versión ${version}`,
    none: 'No hay información sobre esta versión.',
  },
  packages: 'Bibliotecas utilizadas',
  links: {
    title: 'Enlaces',
    open: 'Abrir',
    repo: 'Código fuente en GitHub',
    releases: 'Versiones y descargas',
    docs: 'Documentación',
    bugs: 'Informar de un error',
  },
  diagnostics: {
    title: 'Diagnóstico',
    label: 'Exportar diagnóstico',
    description:
      'Guarda un archivo con la versión, la plataforma, los módulos activos y los últimos mensajes de error (acortados). Sin entradas, ajustes ni claves.',
    saved: 'Diagnóstico guardado.',
  },
  reset: {
    title: 'Restablecer dispositivo',
    label: 'Eliminar todos los datos de este dispositivo',
    description:
      'Elimina entradas, ajustes y claves de este dispositivo. Los datos del servidor de sincronización y los archivos de copia de seguridad se conservan.',
    dialogTitle: '¿Eliminar todos los datos de este dispositivo?',
    warning:
      'Esto no se puede deshacer. Si aún necesitas los datos, crea antes una copia de seguridad (Sincronización y copia de seguridad).',
    confirm: 'Eliminar definitivamente',
  },
  licenses: 'Avisos de licencia',
  licenseList: [
    'Fuente «Inter»: SIL Open Font License 1.1, © The Inter Project Authors.',
    'Logotipo «Nemo» en «Nunito»: SIL Open Font License 1.1, © The Nunito Project Authors.',
    'Iconos «Lucide»: licencia ISC, © Lucide Contributors.',
    'El logo de Nemo (pez payaso) es un dibujo propio de este proyecto.',
  ],
};
