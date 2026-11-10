import { defineBundle } from '@/core/i18n/bundle';

/**
 * Remote control, PC side (Settings → Verbindungen → Fernsteuerung, top-bar chip). Wording:
 * docs/design/remote-control/CONCEPT.md §4, §7. Next to the feature instead of in `strings.ts`
 * (a hotspot).
 */
export const tRemoteHost = defineBundle(
  {
    title: 'Fernsteuerung',
    help: 'Ein gekoppeltes Handy darf Medien und Lautstärke dieses PCs steuern – nur im Heimnetz und nur, wenn du es hier erlaubst.',
    keywords: [
      'Fernbedienung',
      'Handy steuert PC',
      'Lautstärke',
      'Medien',
      'Maus',
      'Tastatur',
      'Fernsteuern',
    ],
    allow: 'Fernsteuerung erlauben',
    allowHint:
      'Aus: Kein Gerät kann diesen PC steuern. Der Abgleich im Heimnetz läuft unverändert weiter.',
    askNote: 'Wenn du etwas erlaubst, fragt Windows in einem eigenen Fenster noch einmal nach.',
    needHub: 'Die Fernsteuerung läuft über den Abgleich im Heimnetz.',
    needHubLine: 'Kopple dort zuerst dein Handy mit diesem PC.',
    toHub: 'Zum Abgleich im Heimnetz',
    notWindows: 'Dieser PC lässt sich noch nicht fernsteuern. Das geht zurzeit nur unter Windows.',
    devices: 'Gekoppelte Geräte',
    devicesNone: 'Noch kein Gerät gekoppelt.',
    switchFirst: 'Schalte oben „Fernsteuerung erlauben“ ein, um einem Gerät etwas zu erlauben.',
    levelLabel: (name: string) => `Was darf ${name}?`,
    levels: {
      off: 'Nichts',
      media: 'Medien und Lautstärke',
      full: 'Medien, Maus und Tastatur',
    },
    fullLater:
      'Maus und Tastatur kommen mit einem späteren Update. Die Erlaubnis gilt dann ohne weitere Frage.',
    lastSeen: (when: string) => `Letzter Kontakt: ${when}`,
    neverSeen: 'Noch nie verbunden',
    paused: 'Pausiert',
    pausedLine: 'Du hast die Fernsteuerung für dieses Gerät beendet.',
    resume: 'Wieder einschalten',
    more: 'Erweitert',
    unlock: (name: string) => `${name}: Am Handy entsperren`,
    unlockHint: 'Vor Maus und Tastatur muss sich das Handy entsperren (Fingerabdruck oder PIN).',
    controlling: (name: string, level: 'off' | 'media' | 'full') =>
      level === 'full'
        ? `${name} steuert gerade Maus, Tastatur und Medien`
        : `${name} steuert gerade Medien und Lautstärke`,
    end: 'Fernsteuerung beenden',
    endHint: 'Danach bleibt das Gerät pausiert, bis du es hier wieder einschaltest.',
    ended: (name: string) => `Beendet. ${name} ist pausiert.`,
    chip: 'Wird ferngesteuert',
    chipLabel: (name: string) => `Dieser PC wird ferngesteuert von ${name}. Zu den Einstellungen`,
    errors: {
      busy: 'Am PC ist schon eine Frage offen. Beantworte sie zuerst.',
      'busy-controlled':
        'Das geht nicht, solange ein Gerät Maus und Tastatur steuert. Beende die Fernsteuerung und versuche es noch einmal.',
      changed: 'In der Zwischenzeit hat sich die Freigabe geändert. Wähle noch einmal.',
      'not-found': 'Dieses Gerät ist nicht mehr gekoppelt.',
      failed: 'Das ließ sich nicht speichern. Versuche es noch einmal.',
    },
  },
  {
    en: {
      title: 'Remote control',
      help: 'A paired phone may control media and volume of this PC – only on your home network and only if you allow it here.',
      keywords: [
        'Remote',
        'Phone controls PC',
        'Volume',
        'Media',
        'Mouse',
        'Keyboard',
        'Remote control',
      ],
      allow: 'Allow remote control',
      allowHint: 'Off: no device can control this PC. Home-network sync keeps running unchanged.',
      askNote: 'When you allow something, Windows asks once more in a window of its own.',
      needHub: 'Remote control runs over home-network sync.',
      needHubLine: 'Pair your phone with this PC there first.',
      toHub: 'To home-network sync',
      notWindows: 'This PC cannot be remote controlled yet. That works on Windows only for now.',
      devices: 'Paired devices',
      devicesNone: 'No device paired yet.',
      switchFirst: 'Switch on “Allow remote control” above to allow a device anything.',
      levelLabel: (name: string) => `What may ${name} do?`,
      levels: {
        off: 'Nothing',
        media: 'Media and volume',
        full: 'Media, mouse and keyboard',
      },
      fullLater:
        'Mouse and keyboard come with a later update. The permission then applies without another question.',
      lastSeen: (when: string) => `Last contact: ${when}`,
      neverSeen: 'Never connected yet',
      paused: 'Paused',
      pausedLine: 'You ended remote control for this device.',
      resume: 'Switch on again',
      more: 'Advanced',
      unlock: (name: string) => `${name}: unlock at the phone`,
      unlockHint: 'Before mouse and keyboard the phone has to unlock itself (fingerprint or PIN).',
      controlling: (name: string, level: 'off' | 'media' | 'full') =>
        level === 'full'
          ? `${name} is controlling mouse, keyboard and media`
          : `${name} is controlling media and volume`,
      end: 'End remote control',
      endHint: 'Afterwards the device stays paused until you switch it on here again.',
      ended: (name: string) => `Ended. ${name} is paused.`,
      chip: 'Remote controlled',
      chipLabel: (name: string) => `This PC is remote controlled by ${name}. Go to settings`,
      errors: {
        busy: 'A question is already open at the PC. Answer it first.',
        'busy-controlled':
          'That is not possible while a device controls mouse and keyboard. End remote control and try again.',
        changed: 'The permission changed in the meantime. Choose again.',
        'not-found': 'This device is no longer paired.',
        failed: 'That could not be saved. Try again.',
      },
    },
  },
);
