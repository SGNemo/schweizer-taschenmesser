import { formatNumber } from '@/core/i18n/format';
import type { Strings } from '@/strings';

export const system: Strings['system'] = {
  title: 'Systeminfo',
  lead: 'Was steckt in diesem Computer und wie ausgelastet ist er? Die Werte werden nur angezeigt: nichts wird gespeichert oder gesendet.',
  loading: 'Werte werden gelesen …',
  failed: 'Die Werte konnten nicht gelesen werden.',
  refresh: 'Alle 3 Sekunden aktualisiert.',
  refreshNow: 'Jetzt aktualisieren',
  system: 'System',
  os: 'Betriebssystem',
  uptime: 'Läuft seit',
  uptimeValue: (d: number, h: number, m: number) =>
    d > 0
      ? `${d} ${d === 1 ? 'Tag' : 'Tage'}, ${h} Std.`
      : h > 0
        ? `${h} Std., ${m} Min.`
        : `${m} Min.`,
  cpu: 'Prozessor',
  cores: (physical: number | null, threads: number) =>
    physical ? `${physical} Kerne, ${threads} Threads` : `${threads} Threads`,
  load: (p: number) => `Auslastung ${p} %`,
  memory: 'Arbeitsspeicher',
  memoryUsed: (used: string, total: string, p: number) => `${used} von ${total} belegt (${p} %)`,
  battery: 'Akku',
  batteryValue: (p: number | null, charging: boolean, plugged: boolean) =>
    `${p === null ? 'Ladestand unbekannt' : `${p} %`}${charging ? ', wird geladen' : plugged ? ', am Netz' : ', im Akkubetrieb'}`,
  gpu: 'Grafik',
  noGpu: 'Keine Grafikkarte gefunden.',
  network: 'Netzwerk (lokale Adressen)',
  noNetwork: 'Keine Netzwerkverbindung gefunden.',
  processes: 'Programme mit dem größten Speicherverbrauch',
  processesHint: 'Nur zur Ansicht. Beenden kannst du Programme im Task-Manager von Windows.',
  program: 'Programm',
  instances: (n: number) => (n === 1 ? '1 Prozess' : `${n} Prozesse`),
  live: 'Live',
  clock: (mhz: number) =>
    `${formatNumber(mhz / 1000, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} GHz`,
  download: 'Empfangen',
  upload: 'Senden',
  tileNetwork: 'Netzwerk',
  gpuOwn: (size: string) => `${size} Grafikspeicher`,
  gpuShared: (size: string) => `bis zu ${size} geteilter Speicher`,
  gpuActive: 'aktiv',
  gpuDriver: (v: string) => `Treiber ${v}`,
  gpuNote:
    'Auslastung und Temperatur der Grafikkarte zeigt Windows ohne Zusatzprogramm nicht zuverlässig an.',
  thisPc: 'Dieser Computer',
  board: 'Mainboard',
  bios: 'BIOS',
  ram: 'Arbeitsspeicher-Riegel',
  windowsBuild: 'Windows-Version',
  lastBoot: 'Letzter Neustart',
  displays: 'Bildschirme',
  display: (w: number, h: number, hz: number, primary: boolean) =>
    `${w} × ${h}, ${hz} Hz${primary ? ' (Hauptbildschirm)' : ''}`,
  audio: 'Audio',
  audioOut: (n: string) => `Ausgabe: ${n}`,
  audioIn: (n: string) => `Eingabe: ${n}`,
  cpuTemp: 'CPU-Temperatur',
  cpuTempGap:
    'nicht verfügbar – Windows gibt sie nur mit Administratorrechten oder Zusatztreibern heraus',
  adapters: 'Netzwerk',
  adapterKind: {
    ethernet: 'Kabel',
    wifi: 'WLAN',
    virtual: 'virtuell',
    other: 'Sonstiges',
  } as Record<string, string>,
  connected: 'verbunden',
  disconnected: 'nicht verbunden',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  showAll: 'Alle Adressen anzeigen',
  hideAll: 'Weniger anzeigen',
  ssid: 'Netz',
  signal: (word: string, p: number) => `Signal ${word} (${p} %)`,
  signalWords: { strong: 'stark', ok: 'mittel', weak: 'schwach' } as Record<string, string>,
  virtualNote: 'Virtuelle Adapter (z. B. für WSL, Hyper-V oder VPN) sind gedämpft dargestellt.',
  publicIp: 'Öffentliche IP-Adresse',
  publicIpButton: 'Öffentliche IP abfragen',
  publicIpNote:
    'Fragt den Dienst api.ipify.org. Nur auf Knopfdruck; das Ergebnis wird nur angezeigt, nicht gespeichert.',
  publicIpFailed: 'Die Abfrage hat nicht geklappt.',
  cpuColumn: 'CPU',
  openTaskManager: 'Im Task-Manager öffnen',
  sparkCpu: 'Prozessorauslastung der letzten 5 Minuten',
  sparkRam: 'Speicherbelegung der letzten 5 Minuten',
  sparkNet: 'Empfangsrate der letzten 5 Minuten',
  batteryTile: 'Akku',
};
