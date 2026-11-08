import { defineBundle } from '@/core/i18n/bundle';
import type { NetWhen } from '@/core/net/catalogue';

/** Texts of the connection log and "Netzwerk sperren" (Einstellungen → Verbindungen). */
export const tNet = defineBundle(
  {
    title: 'Was ging wohin?',
    description:
      'Was die App selbst seit dem Start ins Netz geschickt hat: Zeit, Ziel, Anlass und Größe, nie Inhalte. Die Liste bleibt auf diesem Gerät. Nicht darin: was die Windows- oder Android-App direkt lädt (Seiten im Browser-Modul, Downloads und Torrents, Abgleich im Heimnetz).',
    keywords: [
      'Netzwerk',
      'Verbindungsprotokoll',
      'Sperren',
      'Offline',
      'Datenschutz',
      'Protokoll',
      'Adressen',
    ],
    summary: (n: number, hosts: number) =>
      n === 0
        ? 'Seit dem Start: keine Verbindung.'
        : `Seit dem Start: ${n} ${n === 1 ? 'Verbindung' : 'Verbindungen'} zu ${hosts} ${hosts === 1 ? 'Ziel' : 'Zielen'}.`,
    empty: 'Bisher keine Verbindung.',
    listLabel: 'Verbindungen seit dem Start',
    reasons: {
      update: 'Update-Prüfung',
      sync: 'Synchronisierung',
      push: 'Erinnerungen (Push)',
      calendar: 'Kalender-Abo',
      connector: 'Verbindung (Google, Spotify)',
      ai: 'KI',
      weather: 'Wetter',
      maps: 'Karte und Ortssuche',
      currency: 'Währungsrechner',
      ip: 'Öffentliche IP anzeigen',
      breach: 'Tresor: Abgleich mit Datenlecks',
      download: 'Modell-Download',
      other: 'Sonstiges',
    } as Record<string, string>,
    status: {
      blocked: 'gesperrt',
      error: 'keine Antwort',
      native: 'von der App selbst, Größe unbekannt',
    } as Record<string, string>,
    statusCode: (code: number) => `Antwort ${code}`,
    size: (out: number, inn: number | undefined) =>
      inn === undefined
        ? `gesendet ${bytes(out)}`
        : `gesendet ${bytes(out)}, empfangen ${bytes(inn)}`,
    block: 'Netzwerk sperren',
    blockHint:
      'Die App selbst sendet nichts mehr, bis du es wieder erlaubst. Synchronisierung, Update-Prüfung, Wetter und KI melden dann „gesperrt“. Deine Daten auf dem Gerät und diese Liste funktionieren weiter. Nicht erfasst: Seiten im Browser-Modul, Downloads und Torrents, der Abgleich im Heimnetz und die Push-Anmeldung des Browsers; sie starten nur, wenn du sie öffnest oder einrichtest, und laufen dann auch bei gesperrtem Netz.',
    blockedNote:
      'Das Netzwerk ist für die App gesperrt. Ausnahmen stehen unter „Netzwerk sperren“.',
    keep: 'Liste auf diesem Gerät behalten',
    keepHint:
      'Sonst gilt sie nur bis zum Schließen der App. Die Liste wird nie synchronisiert, gesichert oder in die Diagnose übernommen.',
    clear: 'Liste leeren',
    cleared: 'Liste geleert.',
    catalogue: {
      title: 'Was überhaupt ins Netz gehen kann',
      intro:
        'Die festen Adressen aus dem Code der App (mit ihren Download-Servern), bei jedem Testlauf gegen den Code geprüft. Dazu kommt, was du selbst einträgst oder öffnest, und mit Push der Push-Dienst deines Browsers.',
      when: {
        auto: 'Automatisch, höchstens einmal am Tag; abschaltbar unter Updates',
        setup: 'Nur wenn du es eingerichtet hast',
        click: 'Nur nach deinem Klick',
      } satisfies Record<NetWhen, string>,
      own: 'eine Adresse, die du selbst einträgst',
      other:
        'Was du selbst einträgst oder öffnest: Feeds, E-Mail-Konto und Bilder in Mails (nur wenn du sie erlaubst), Link-Vorschauen, Seiten im Browser-Modul, Downloads und Torrents, Abgleich im Heimnetz',
    },
  },
  {
    en: {
      title: 'What went where?',
      description:
        'What the app itself has sent to the network since it started: time, destination, reason and size, never content. The list stays on this device. Not in it: what the Windows or Android app loads directly (pages in the browser module, downloads and torrents, home-network sync).',
      keywords: ['network', 'connection log', 'block', 'offline', 'privacy', 'log', 'destinations'],
      summary: (n: number, hosts: number) =>
        n === 0
          ? 'Since start: no connection.'
          : `Since start: ${n} ${n === 1 ? 'connection' : 'connections'} to ${hosts} ${hosts === 1 ? 'destination' : 'destinations'}.`,
      empty: 'No connection so far.',
      listLabel: 'Connections since start',
      reasons: {
        update: 'Update check',
        sync: 'Sync',
        push: 'Reminders (push)',
        calendar: 'Calendar subscription',
        connector: 'Connection (Google, Spotify)',
        ai: 'AI',
        weather: 'Weather',
        maps: 'Map and place search',
        currency: 'Currency converter',
        ip: 'Show public IP',
        breach: 'Vault: known-leak check',
        download: 'Model download',
        other: 'Other',
      } as Record<string, string>,
      status: {
        blocked: 'blocked',
        error: 'no answer',
        native: 'made by the app itself, size unknown',
      } as Record<string, string>,
      statusCode: (code: number) => `Answer ${code}`,
      size: (out: number, inn: number | undefined) =>
        inn === undefined ? `sent ${bytes(out)}` : `sent ${bytes(out)}, received ${bytes(inn)}`,
      block: 'Block network',
      blockHint:
        'The app itself sends nothing until you allow it again. Sync, update check, weather and AI then report “blocked”. Your data on this device and this list keep working. Not covered: pages in the browser module, downloads and torrents, home-network sync and the browser’s push sign-up; they only start when you open or set them up, and then keep running while the network is blocked.',
      blockedNote:
        'The network is blocked for the app. Exceptions are listed under “Block network”.',
      keep: 'Keep the list on this device',
      keepHint:
        'Otherwise it only lasts until the app closes. The list is never synced, backed up or added to diagnostics.',
      clear: 'Clear list',
      cleared: 'List cleared.',
      catalogue: {
        title: 'Everything that can go to the network',
        intro:
          "The fixed addresses in the app's code (with their download servers), checked against the code on every test run. Beyond these, what you enter or open yourself, and with push your browser's push service.",
        when: {
          auto: 'Automatic, at most once a day; can be switched off under Updates',
          setup: 'Only when you set it up',
          click: 'Only after your click',
        } satisfies Record<NetWhen, string>,
        own: 'an address you enter yourself',
        other:
          'What you enter or open yourself: feeds, your mail account and images in mails (only when you allow them), link previews, pages in the browser module, downloads and torrents, home-network sync',
      },
    },
    es: {
      title: '¿Qué salió y adónde?',
      description:
        'Todo lo que la app ha enviado a la red desde que se inició: hora, destino, motivo y tamaño, nunca contenido. La lista se queda en este dispositivo.',
      keywords: [
        'red',
        'registro de conexiones',
        'bloquear',
        'sin conexión',
        'privacidad',
        'registro',
      ],
      summary: (n: number, hosts: number) =>
        n === 0
          ? 'Desde el inicio: ninguna conexión.'
          : `Desde el inicio: ${n} ${n === 1 ? 'conexión' : 'conexiones'} a ${hosts} ${hosts === 1 ? 'destino' : 'destinos'}.`,
      empty: 'Ninguna conexión hasta ahora.',
      listLabel: 'Conexiones desde el inicio',
      reasons: {
        update: 'Búsqueda de actualizaciones',
        sync: 'Sincronización',
        push: 'Recordatorios (push)',
        calendar: 'Suscripción de calendario',
        connector: 'Conexión (Google, Spotify)',
        ai: 'IA',
        weather: 'Tiempo',
        maps: 'Mapa y búsqueda de lugares',
        currency: 'Conversor de divisas',
        ip: 'Mostrar IP pública',
        download: 'Descarga de modelo',
        other: 'Otros',
      } as Record<string, string>,
      status: {
        blocked: 'bloqueada',
        error: 'sin respuesta',
        native: 'hecha por la propia app, tamaño desconocido',
      } as Record<string, string>,
      statusCode: (code: number) => `Respuesta ${code}`,
      size: (out: number, inn: number | undefined) =>
        inn === undefined
          ? `enviado ${bytes(out)}`
          : `enviado ${bytes(out)}, recibido ${bytes(inn)}`,
      block: 'Bloquear la red',
      blockHint:
        'La app no envía nada hasta que lo permitas de nuevo. Sincronización, búsqueda de actualizaciones, tiempo e IA indican entonces «bloqueada». Tus datos en este dispositivo y esta lista siguen funcionando.',
      blockedNote: 'La red está bloqueada. No sale nada.',
      keep: 'Conservar la lista en este dispositivo',
      keepHint:
        'Si no, solo dura hasta cerrar la app. La lista nunca se sincroniza, se copia ni pasa al diagnóstico.',
      clear: 'Vaciar lista',
      cleared: 'Lista vaciada.',
    },
    fr: {
      title: 'Qu’est-ce qui est parti, et où ?',
      description:
        'Tout ce que l’app a envoyé au réseau depuis son démarrage : heure, destination, motif et taille, jamais le contenu. La liste reste sur cet appareil.',
      keywords: [
        'réseau',
        'journal des connexions',
        'bloquer',
        'hors ligne',
        'confidentialité',
        'journal',
      ],
      summary: (n: number, hosts: number) =>
        n === 0
          ? 'Depuis le démarrage : aucune connexion.'
          : `Depuis le démarrage : ${n} ${n === 1 ? 'connexion' : 'connexions'} vers ${hosts} ${hosts === 1 ? 'destination' : 'destinations'}.`,
      empty: 'Aucune connexion jusqu’ici.',
      listLabel: 'Connexions depuis le démarrage',
      reasons: {
        update: 'Recherche de mises à jour',
        sync: 'Synchronisation',
        push: 'Rappels (push)',
        calendar: 'Abonnement de calendrier',
        connector: 'Connexion (Google, Spotify)',
        ai: 'IA',
        weather: 'Météo',
        maps: 'Carte et recherche de lieux',
        currency: 'Convertisseur de devises',
        ip: 'Afficher l’IP publique',
        download: 'Téléchargement de modèle',
        other: 'Autre',
      } as Record<string, string>,
      status: {
        blocked: 'bloquée',
        error: 'sans réponse',
        native: 'faite par l’app elle-même, taille inconnue',
      } as Record<string, string>,
      statusCode: (code: number) => `Réponse ${code}`,
      size: (out: number, inn: number | undefined) =>
        inn === undefined ? `envoyé ${bytes(out)}` : `envoyé ${bytes(out)}, reçu ${bytes(inn)}`,
      block: 'Bloquer le réseau',
      blockHint:
        'L’app n’envoie plus rien jusqu’à ce que vous l’autorisiez de nouveau. Synchronisation, recherche de mises à jour, météo et IA indiquent alors « bloquée ». Vos données sur cet appareil et cette liste continuent de fonctionner.',
      blockedNote: 'Le réseau est bloqué. Rien ne sort.',
      keep: 'Garder la liste sur cet appareil',
      keepHint:
        'Sinon elle ne dure que jusqu’à la fermeture de l’app. La liste n’est jamais synchronisée, sauvegardée ni ajoutée au diagnostic.',
      clear: 'Vider la liste',
      cleared: 'Liste vidée.',
    },
    'pt-BR': {
      title: 'O que foi para onde?',
      description:
        'Tudo o que o app enviou para a rede desde que iniciou: hora, destino, motivo e tamanho, nunca o conteúdo. A lista fica neste dispositivo.',
      keywords: ['rede', 'registro de conexões', 'bloquear', 'offline', 'privacidade', 'registro'],
      summary: (n: number, hosts: number) =>
        n === 0
          ? 'Desde o início: nenhuma conexão.'
          : `Desde o início: ${n} ${n === 1 ? 'conexão' : 'conexões'} com ${hosts} ${hosts === 1 ? 'destino' : 'destinos'}.`,
      empty: 'Nenhuma conexão até agora.',
      listLabel: 'Conexões desde o início',
      reasons: {
        update: 'Verificação de atualização',
        sync: 'Sincronização',
        push: 'Lembretes (push)',
        calendar: 'Assinatura de calendário',
        connector: 'Conexão (Google, Spotify)',
        ai: 'IA',
        weather: 'Clima',
        maps: 'Mapa e busca de lugares',
        currency: 'Conversor de moedas',
        ip: 'Mostrar IP público',
        download: 'Download de modelo',
        other: 'Outros',
      } as Record<string, string>,
      status: {
        blocked: 'bloqueada',
        error: 'sem resposta',
        native: 'feita pelo próprio app, tamanho desconhecido',
      } as Record<string, string>,
      statusCode: (code: number) => `Resposta ${code}`,
      size: (out: number, inn: number | undefined) =>
        inn === undefined
          ? `enviado ${bytes(out)}`
          : `enviado ${bytes(out)}, recebido ${bytes(inn)}`,
      block: 'Bloquear a rede',
      blockHint:
        'O app não envia nada até você permitir de novo. Sincronização, verificação de atualização, clima e IA informam então “bloqueada”. Seus dados neste dispositivo e esta lista continuam funcionando.',
      blockedNote: 'A rede está bloqueada. Nada sai.',
      keep: 'Manter a lista neste dispositivo',
      keepHint:
        'Caso contrário, ela dura só até o app fechar. A lista nunca é sincronizada, copiada em backup nem incluída no diagnóstico.',
      clear: 'Limpar lista',
      cleared: 'Lista limpa.',
    },
  },
);

/** Plain bytes for a connection line (language-neutral units). */
function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
