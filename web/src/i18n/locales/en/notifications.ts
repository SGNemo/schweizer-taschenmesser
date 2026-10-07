import type { Strings } from '@/strings';

export const notifications: Strings['notifications'] = {
  summary: (count: number, titles: string[]) => ({
    title: `Weitere Erinnerungen · ${count}`,
    body: titles.slice(0, 3).join(' · ') + (titles.length > 3 ? ' …' : ''),
  }),
  title: 'Benachrichtigungen',
  intro:
    'Erinnerungen erscheinen als Benachrichtigung, solange die App geöffnet ist oder im Hintergrund läuft. Bei geschlossener App kommen sie nur mit Push (siehe unten).',
  enable: 'Benachrichtigungen aktivieren',
  granted: 'Aktiviert',
  denied: 'Blockiert – bitte in den Browser-Einstellungen für diese Seite erlauben.',
  default: 'Noch nicht aktiviert',
  unsupported: 'Wird von diesem Browser nicht unterstützt.',
  test: 'Testbenachrichtigung senden',
  testBody: 'Es funktioniert.',
  push: {
    title: 'Push bei geschlossener App',
    intro:
      'Optional: Dein Sync-Server schickt Erinnerungen per Web Push, auch wenn die App geschlossen ist. Dafür lädt die App die anstehenden Benachrichtigungen der nächsten zwei Wochen (Titel und Text) zu deinem Server hoch – mit Ende-zu-Ende-Verschlüsselung nur verschlüsselt.',
    state: {
      unsupported: 'Dieser Browser unterstützt kein Web Push.',
      'needs-sync':
        'Push braucht die Verbindung zu deinem Sync-Server (Einstellungen → Synchronisation).',
      denied: 'Benachrichtigungen sind blockiert – bitte in den Browser-Einstellungen erlauben.',
      off: 'Aus',
      on: 'Aktiv auf diesem Gerät',
    } as Record<string, string>,
    enable: 'Push aktivieren',
    disable: 'Push deaktivieren',
    test: 'Test über den Server senden',
    testSent: 'Gesendet – die Benachrichtigung sollte gleich erscheinen.',
    testFailed: 'Der Server konnte nicht senden (Push-Dienst nicht erreichbar?).',
    errors: {
      unauthorized: 'Das Token des Sync-Servers wurde abgelehnt.',
      network: 'Der Sync-Server ist nicht erreichbar.',
      server: 'Der Sync-Server hat einen Fehler gemeldet (ist er auf dem neuesten Stand?).',
      'subscribe-failed':
        'Das Abonnement konnte nicht angelegt werden. Push braucht HTTPS und einen Browser mit Push-Dienst.',
      denied: 'Benachrichtigungen wurden nicht erlaubt.',
      unsupported: 'Dieser Browser unterstützt kein Web Push.',
      'needs-sync': 'Bitte zuerst mit dem Sync-Server verbinden.',
    } as Record<string, string>,
  },
};
