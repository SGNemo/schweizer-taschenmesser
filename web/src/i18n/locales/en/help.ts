import type { Strings } from '@/strings';

export const help: Strings['help'] = {
  label: 'Hilfe',
  sync: 'Der Sync-Server ist dein eigener kleiner Server, der die Daten mehrerer Geräte abgleicht. Auf Wunsch werden die Daten Ende-zu-Ende verschlüsselt: Der Server sieht dann nur unlesbare Werte, und die Passphrase kennen nur deine Geräte.',
  aiLocal:
    'Ein kleines Sprachmodell läuft nur auf diesem Gerät und versteht Sätze, die die festen Regeln nicht kennen – ohne Token, ohne Internet. Es wird erst nach deiner Zustimmung heruntergeladen (Größe, Quelle und Prüfsumme siehst du vorher) und prüft den Download selbst.',
  aiWrite:
    'Erkannte Einträge zeigt Nemo immer erst als Vorschau; gespeichert wird erst nach deiner Bestätigung. Hier legst du fest, ob und wo der Assistent Einträge vorschlagen darf.',
  aiCloudWrite:
    'Zuerst versucht Nemo es mit festen Regeln, dann (falls eingerichtet) mit dem lokalen Modell – beides kostet nichts und verlässt das Gerät nicht. Nur wenn beides nicht reicht und du das hier erlaubst, geht der Satz mit dem Datum und den Feldnamen der Module (nie deine Einträge) an einen KI-Anbieter.',
  aiAskMissing:
    'An: fehlt z. B. das Fälligkeitsdatum, fragt die Vorschau danach. Aus: solche Sätze werden nicht als Eintrag vorgeschlagen.',
  aiRouter:
    'Mehrere KI-Anbieter stehen in einer Reihenfolge. Die App fragt den ersten verfügbaren; ist er überlastet, nicht erreichbar oder sein Limit ist erreicht, springt sie zum nächsten. Es werden nur deine Frage und ein kurzes Schema gesendet, nie deine Daten.',
  updateChannel:
    '„Stabil“ bietet nur fertige Versionen an. „Beta“ zeigt auch Vorabversionen, die neue Funktionen früher, aber weniger erprobt enthalten. Vor jedem Update legt die App eine Sicherungskopie an.',
  vault:
    'Der Tresor ist mit deinem Master-Passwort verschlüsselt, das nirgends gespeichert wird. Vergisst du es, kann niemand die Einträge wiederherstellen – auch nicht wir. Lege es deshalb an einem sicheren Ort ab.',
  startData:
    'Der Assistent liest Text oder Dateien ein und zeigt zuerst eine Vorschau. Erst nach deiner Bestätigung wird gespeichert, und jeder Import lässt sich als Ganzes wieder rückgängig machen.',
  localApi:
    'Die Schnittstelle hört nur auf diesem Computer (127.0.0.1) und ist ohne Zugangsschlüssel nutzlos. Jeder Zugang bekommt nur die Rechte, die du ankreuzt. Importe landen zuerst als Vorschau in der App. Den Tresor (Accounts), Einstellungen und Schlüssel kann sie nie erreichen.',
  connectors:
    'Verbindungen lesen nur, sie ändern nichts bei dem Dienst. Zugangsdaten liegen im Schlüsselspeicher dieses Geräts und werden nie synchronisiert oder gesichert. E-Mails werden ausschließlich auf deinem Gerät ausgewertet und nie an eine KI geschickt.',
};
