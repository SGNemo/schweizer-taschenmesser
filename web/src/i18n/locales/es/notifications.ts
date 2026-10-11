import type { Strings } from '@/strings';

export const notifications: Strings['notifications'] = {
  summary: (count: number, titles: string[]) => ({
    title: `Más recordatorios · ${count}`,
    body: titles.slice(0, 3).join(' · ') + (titles.length > 3 ? ' …' : ''),
  }),
  title: 'Notificaciones',
  intro:
    'Los recordatorios aparecen como notificación mientras la app está abierta o en segundo plano. Con la app cerrada solo llegan con push (ver abajo).',
  enable: 'Activar notificaciones',
  granted: 'Activadas',
  denied: 'Bloqueadas: permítelas en los ajustes del navegador para este sitio.',
  default: 'Aún sin activar',
  unsupported: 'Este navegador no lo admite.',
  test: 'Enviar notificación de prueba',
  testBody: 'Funciona.',
  push: {
    title: 'Push con la app cerrada',
    intro:
      'Opcional: tu servidor de sincronización envía los recordatorios por Web Push, aunque la app esté cerrada. Para ello, la app sube a tu servidor las notificaciones de las próximas dos semanas (título y texto), solo cifradas si usas cifrado de extremo a extremo.',
    state: {
      unsupported: 'Este navegador no admite Web Push.',
      'needs-sync':
        'Push necesita la conexión con tu servidor de sincronización (Ajustes → Sincronización).',
      denied: 'Las notificaciones están bloqueadas: permítelas en los ajustes del navegador.',
      off: 'Desactivado',
      on: 'Activo en este dispositivo',
    } as Record<string, string>,
    enable: 'Activar push',
    disable: 'Desactivar push',
    test: 'Enviar prueba desde el servidor',
    testSent: 'Enviado: la notificación debería aparecer enseguida.',
    testFailed: 'El servidor no pudo enviar (¿servicio push no disponible?).',
    errors: {
      unauthorized: 'El servidor de sincronización rechazó el token.',
      network: 'No se puede conectar con el servidor de sincronización.',
      server: 'El servidor de sincronización informó de un error (¿está actualizado?).',
      'subscribe-failed':
        'No se pudo crear la suscripción. Push necesita HTTPS y un navegador con servicio push.',
      denied: 'No se permitieron las notificaciones.',
      unsupported: 'Este navegador no admite Web Push.',
      'needs-sync': 'Primero conéctate con el servidor de sincronización.',
    } as Record<string, string>,
  },
};
