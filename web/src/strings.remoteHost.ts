import { defineBundle } from '@/core/i18n/bundle';

/**
 * Remote control, PC side (Settings → Verbindungen → Fernsteuerung, top-bar chip). Wording:
 * docs/design/remote-control/CONCEPT.md §4, §7. Next to the feature instead of in `strings.ts`
 * (a hotspot).
 */
export const tRemoteHost = defineBundle(
  {
    title: 'Fernsteuerung',
    help: 'Ein gekoppeltes Handy darf Medien und Lautstärke dieses PCs steuern, auf Wunsch auch Maus und Tastatur – nur im Heimnetz und nur, wenn du es hier erlaubst.',
    keywords: ['Fernbedienung', 'Handy steuert PC', 'Lautstärke', 'Medien', 'Fernsteuern'],
    allow: 'Fernsteuerung erlauben',
    allowHint:
      'Aus: Kein Gerät kann diesen PC steuern. Der Abgleich im Heimnetz läuft unverändert weiter.',
    allowHintOn: 'An: Nur die Geräte, denen du unten etwas erlaubst, und nur im Heimnetz.',
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
    unlock: 'Vor Maus und Tastatur am Handy entsperren',
    unlockHint:
      'Das Handy fragt dann einmal in acht Stunden nach Fingerabdruck, Gesicht oder PIN. Eine Bremse, falls es entsperrt herumliegt.',
    notice: 'Melden, wenn ein Gerät Maus und Tastatur steuert',
    noticeHint:
      'Eine ruhige Benachrichtigung von Windows ohne Ton, höchstens einmal in 30 Minuten je Gerät. Das Symbol im Tray zeigt die Fernsteuerung immer an.',
    lastSeen: (when: string) => `Letzter Kontakt: ${when}`,
    neverSeen: 'Noch nie verbunden',
    paused: 'Pausiert',
    pausedLine: 'Pausiert, bis du es hier wieder einschaltest.',
    resume: 'Wieder einschalten',
    unnamed: (id: string) => `Gerät ohne Namen (${id})`,
    controlling: (name: string, level: 'off' | 'media' | 'full') =>
      level === 'full'
        ? `${name} steuert gerade Maus, Tastatur und Medien`
        : `${name} steuert gerade Medien und Lautstärke`,
    end: 'Fernsteuerung beenden',
    endHint: (name: string) => `Beenden pausiert ${name}, bis du es hier wieder einschaltest.`,
    ended: (name: string) => `Beendet. ${name} ist pausiert.`,
    chip: (name: string) => `Fernsteuerung: ${name}`,
    chipLabel: (name: string) => `Dieser PC wird ferngesteuert von ${name}. Zu den Einstellungen`,
    errors: {
      busy: 'Ein Fenster von Nemo wartet noch auf deine Antwort. Beantworte es zuerst.',
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
      help: 'A paired phone may control media and volume of this PC, and mouse and keyboard if you want – only on your home network and only if you allow it here.',
      keywords: ['Remote', 'Phone controls PC', 'Volume', 'Media', 'Remote control'],
      allow: 'Allow remote control',
      allowHint: 'Off: no device can control this PC. Home-network sync keeps running unchanged.',
      allowHintOn: 'On: only the devices you allow below, and only on your home network.',
      askNote: 'When you allow something, Windows asks once more in a window of its own.',
      needHub: 'Remote control runs over home-network sync.',
      needHubLine: 'Pair your phone with this PC there first.',
      toHub: 'To home-network sync',
      notWindows: 'Remote control works only on Windows for now.',
      devices: 'Paired devices',
      devicesNone: 'No device paired yet.',
      switchFirst: 'Switch on “Allow remote control” above to give a device access.',
      levelLabel: (name: string) => `What may ${name} do?`,
      levels: {
        off: 'Nothing',
        media: 'Media and volume',
        full: 'Media, mouse and keyboard',
      },
      unlock: 'Unlock at the phone before mouse and keyboard',
      unlockHint:
        'The phone then asks for fingerprint, face or PIN once in eight hours. A brake in case it lies around unlocked.',
      notice: 'Tell me when a device controls mouse and keyboard',
      noticeHint:
        'A quiet Windows notification without a sound, at most once in 30 minutes per device. The tray icon always shows remote control.',
      lastSeen: (when: string) => `Last contact: ${when}`,
      neverSeen: 'Never connected yet',
      paused: 'Paused',
      pausedLine: 'Paused until you switch it on here again.',
      resume: 'Switch on again',
      unnamed: (id: string) => `Device without a name (${id})`,
      controlling: (name: string, level: 'off' | 'media' | 'full') =>
        level === 'full'
          ? `${name} is controlling mouse, keyboard and media`
          : `${name} is controlling media and volume`,
      end: 'End remote control',
      endHint: (name: string) => `Ending pauses ${name} until you switch it on here again.`,
      ended: (name: string) => `Ended. ${name} is paused.`,
      chip: (name: string) => `Remote control: ${name}`,
      chipLabel: (name: string) => `This PC is remote controlled by ${name}. Go to settings`,
      errors: {
        busy: 'A Nemo window is still waiting for your answer. Answer it first.',
        'busy-controlled':
          'That is not possible while a device controls mouse and keyboard. End remote control and try again.',
        changed: 'The permission changed in the meantime. Choose again.',
        'not-found': 'This device is no longer paired.',
        failed: 'That could not be saved. Try again.',
      },
    },
  },
);
