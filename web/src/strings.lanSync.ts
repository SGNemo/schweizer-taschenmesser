import { defineBundle } from '@/core/i18n/bundle';

/**
 * Home-network sync with the PC as hub (Settings → Sync). Wording: docs/design/sync-lan/CONCEPT.md §8.
 * Next to the feature instead of in `strings.ts` (a hotspot).
 */
export const tLanSync = defineBundle(
  {
    title: 'Im Heimnetz',
    hint: 'Handy und PC gleichen sich ab, sobald beide im selben WLAN sind. Kein eigener Server nötig.',
    introPc: 'Gleiche dein Handy im Heimnetz mit diesem PC ab.',
    introPcLine:
      'Koppeln geht per QR-Code, ohne etwas einzutippen. Die Daten bleiben verschlüsselt.',
    serverFirst:
      'Dieses Gerät gleicht über einen eigenen Server ab. Trenne es dort zuerst, um den PC als Abgleich-Punkt zu nutzen.',
    pairDevice: 'Gerät koppeln',
    syncNow: 'Jetzt abgleichen',
    hubOn: (n: number) =>
      n === 0
        ? 'Dieser PC gleicht ab · noch kein Gerät gekoppelt'
        : n === 1
          ? 'Dieser PC gleicht ab · 1 Gerät gekoppelt'
          : `Dieser PC gleicht ab · ${n} Geräte gekoppelt`,
    hubOnLine: 'Handys im selben WLAN gleichen mit diesem PC ab, solange Nemo hier läuft.',
    onlyHome: 'Gleicht nur im Heimnetz ab',
    onlyHomeLine: 'Gerade ist der PC in einem anderen Netz als beim Koppeln.',
    newRouter: 'Neuer Router? Dieses Netz als Heimnetz verwenden',
    newRouterAsk: 'Ist das dein Heimnetz zu Hause? Nur dann bestätigen.',
    use: 'Verwenden',
    blocked: 'Windows blockiert den Abgleich.',
    blockedLine:
      'Windows hält dieses Netz für öffentlich. In den Windows-Einstellungen das Netz als „Privat“ einstellen.',
    noNetwork: 'Kein Heimnetz gefunden',
    noNetworkLine: 'Der PC ist gerade in keinem WLAN oder Kabelnetz zu Hause.',
    notListening: 'Wartet auf das erste Gerät',
    notListeningLine: 'Der PC hört im Heimnetz erst zu, wenn du ein Gerät koppelst.',
    failed: 'Der Abgleich im Heimnetz konnte nicht starten.',
    keystore:
      'Der Schlüsselspeicher von Windows antwortet nicht. Starte Nemo neu und versuche es noch einmal.',
    startFailed: 'Der Abgleich im Heimnetz konnte nicht starten. Versuche es gleich noch einmal.',
    lastSynced: 'Zuletzt abgeglichen',
    justNow: 'gerade eben',
    never: 'noch nie',
    notYetSynced: 'Noch nicht abgeglichen',
    changes: (n: number) => (n === 1 ? '1 Änderung' : `${n} Änderungen`),
    devices: 'Gekoppelte Geräte',
    devicesNone: 'Noch kein Gerät gekoppelt.',
    lastSeen: (date: string) => `Zuletzt gesehen ${date}`,
    neverSeen: 'Noch nicht gesehen',
    longUnseen: 'Länger nicht gesehen. Lösen, wenn du es nicht mehr nutzt.',
    unpair: 'Kopplung lösen',
    unpairAsk: (name: string) =>
      `${name} lösen? Es gleicht erst wieder ab, wenn du es neu koppelst.`,
    unpairConfirm: 'Lösen',
    unpaired: (name: string) => `${name} kann nicht mehr abgleichen.`,
    more: 'Weitere Einstellungen',
    renewKey: 'Schlüssel erneuern',
    renewKeyAsk:
      'Neuen Schlüssel erzeugen? Alle gekoppelten Geräte müssen danach neu gekoppelt werden und laden ihre Daten neu hoch.',
    renewKeyConfirm: 'Erneuern',
    renewed: 'Neuer Schlüssel ist aktiv.',
    renewFailed: 'Der Schlüssel konnte nicht erneuert werden. Es bleibt der alte.',
    turnOff: 'Abgleich im Heimnetz ausschalten',
    turnOffHint: 'Der PC hört dann nicht mehr zu. Deine Daten und gekoppelten Geräte bleiben.',
    // pairing dialog
    pairTitle: 'Gerät koppeln',
    pairSteps:
      'Öffne Nemo auf dem Handy: Einstellungen → Synchronisation → „Mit PC koppeln“, dann den Code scannen.',
    qrAlt: 'QR-Code zum Koppeln',
    preparing: 'Wird vorbereitet …',
    firewall:
      'Windows fragt beim ersten Mal, ob Nemo im Heimnetz erreichbar sein darf – wähle „Zulassen“.',
    pairAsk: (name: string, code: string) => `${name} koppeln? Code ${code}`,
    pairCheck: (name: string) => `Steht derselbe Code auf ${name}? Wenn nicht: Abbrechen.`,
    pairConfirm: 'Koppeln',
    paired: (name: string) => `${name} ist gekoppelt.`,
    wrongCode: 'Der Code passt nicht. Brich ab und koppel noch einmal.',
    pairExpired: 'Die Anfrage ist abgelaufen. Zeig den Code noch einmal.',
    pairLost: 'Das Gerät ist nicht mehr verbunden. Zeig den Code noch einmal.',
    keepRunning: 'Damit dein Handy abgleichen kann, wenn du heimkommst:',
    autostart: 'Mit Windows starten',
    tray: 'Im Tray weiterlaufen',
    close: 'Schließen',
    done: 'Fertig',
    // folded server form
    ownServer: 'Eigener Server (erweitert)',
    ownServerOff: 'Aus',
    serverBlocked:
      'Dieser PC gleicht gerade im Heimnetz ab. Schalte das unter „Weitere Einstellungen“ aus, um stattdessen einen eigenen Server zu verbinden.',
  },
  {
    en: {
      title: 'On your home network',
      hint: 'Phone and PC sync as soon as both are on the same Wi-Fi. No own server needed.',
      introPc: 'Sync your phone with this PC on your home network.',
      introPcLine: 'Pairing works with a QR code, nothing to type. Your data stays encrypted.',
      serverFirst:
        'This device syncs through an own server. Disconnect it there first to use this PC as the sync point.',
      pairDevice: 'Pair a device',
      syncNow: 'Sync now',
      hubOn: (n: number) =>
        n === 0
          ? 'This PC syncs · no device paired yet'
          : n === 1
            ? 'This PC syncs · 1 device paired'
            : `This PC syncs · ${n} devices paired`,
      hubOnLine: 'Phones on the same Wi-Fi sync with this PC while Nemo runs here.',
      onlyHome: 'Syncs only on your home network',
      onlyHomeLine: 'The PC is on a different network than when you paired.',
      newRouter: 'New router? Use this network as home network',
      newRouterAsk: 'Is this your network at home? Only confirm if it is.',
      use: 'Use',
      blocked: 'Windows is blocking sync.',
      blockedLine:
        'Windows treats this network as public. Set the network to “Private” in the Windows settings.',
      noNetwork: 'No home network found',
      noNetworkLine: 'The PC is not on a Wi-Fi or cable network at home right now.',
      notListening: 'Waiting for the first device',
      notListeningLine: 'The PC listens on your home network only once you pair a device.',
      failed: 'Home-network sync could not start.',
      keystore: 'The Windows key store does not answer. Restart Nemo and try again.',
      startFailed: 'Home-network sync could not start. Try again in a moment.',
      lastSynced: 'Last synced',
      justNow: 'just now',
      never: 'never',
      notYetSynced: 'Not yet synced',
      changes: (n: number) => (n === 1 ? '1 change' : `${n} changes`),
      devices: 'Paired devices',
      devicesNone: 'No device paired yet.',
      lastSeen: (date: string) => `Last seen ${date}`,
      neverSeen: 'Not seen yet',
      longUnseen: 'Not seen for a while. Unpair it if you no longer use it.',
      unpair: 'Unpair',
      unpairAsk: (name: string) =>
        `Unpair ${name}? It will only sync again after you pair it again.`,
      unpairConfirm: 'Unpair',
      unpaired: (name: string) => `${name} can no longer sync.`,
      more: 'More settings',
      renewKey: 'Renew key',
      renewKeyAsk:
        'Create a new key? Every paired device has to be paired again afterwards and uploads its data again.',
      renewKeyConfirm: 'Renew',
      renewed: 'The new key is active.',
      renewFailed: 'The key could not be renewed. The old one stays.',
      turnOff: 'Turn off home-network sync',
      turnOffHint: 'The PC stops listening. Your data and paired devices stay.',
      pairTitle: 'Pair a device',
      pairSteps: 'Open Nemo on your phone: Settings → Sync → “Pair with PC”, then scan the code.',
      qrAlt: 'QR code for pairing',
      preparing: 'Getting ready …',
      firewall:
        'The first time, Windows asks whether Nemo may be reachable on your home network – choose “Allow”.',
      pairAsk: (name: string, code: string) => `Pair ${name}? Code ${code}`,
      pairCheck: (name: string) => `Does ${name} show the same code? If not: cancel.`,
      pairConfirm: 'Pair',
      paired: (name: string) => `${name} is paired.`,
      wrongCode: 'The code does not match. Cancel and pair again.',
      pairExpired: 'The request has expired. Show the code again.',
      pairLost: 'The device is no longer connected. Show the code again.',
      keepRunning: 'So your phone can sync when you get home:',
      autostart: 'Start with Windows',
      tray: 'Keep running in the tray',
      close: 'Close',
      done: 'Done',
      ownServer: 'Own server (advanced)',
      ownServerOff: 'Off',
      serverBlocked:
        'This PC syncs on your home network right now. Turn that off under “More settings” to connect an own server instead.',
    },
  },
);
