import { defineBundle } from '@/core/i18n/bundle';

/**
 * One-sentence explanations for module settings whose manifest gives none (`SettingField.help`).
 * Keyed `<moduleId>.<fieldKey>`; a module's own `help` always wins. Kept here, not in the modules'
 * string blocks, so the settings chat can complete the pages without touching other chats' files.
 */
export const tFieldHelp = defineBundle(
  {
    'accounts.autoLockMinutes':
      'Nach dieser Zeit ohne Eingabe sperrt sich der Tresor und muss neu entsperrt werden.',
    'accounts.backgroundLock':
      'Legt fest, wie schnell der Tresor sperrt, wenn du zu einer anderen App wechselst.',
    'accounts.originMatch':
      'Bestimmt, wofür die Browser-Erweiterung Zugangsdaten anbietet: für die ganze Domain oder nur für genau diese Adresse.',
    'accounts.genLength': 'So lang sind Passwörter, die die Browser-Erweiterung neu erzeugt.',
    'accounts.genSymbols': 'Neue Passwörter enthalten auch Sonderzeichen wie ! oder #.',
    'accounts.genAvoidAmbiguous':
      'Lässt Zeichen weg, die sich leicht verwechseln lassen, etwa I, l, 1, O und 0.',
    'browser.engine': 'Mit dieser Suchmaschine suchst du aus der Adressleiste.',
    'browser.history': 'Merkt sich besuchte Seiten auf diesem Gerät, damit du sie wiederfindest.',
    'browser.httpWarning':
      'Zeigt einen Hinweis, bevor du eine Seite ohne Verschlüsselung (HTTP) öffnest.',
    'browser.blocker':
      'Blockiert bekannte Werbe- und Tracking-Adressen auf Seiten, die du öffnest.',
    'browser.hint': 'Zeigt oder verbirgt den Hinweis zum Systembrowser.',
    'calendar.defaultView': 'Mit dieser Ansicht öffnet sich der Kalender.',
    'chat.defaultEngine':
      'Bestimmt, ob neue Chats mit deinen eingerichteten Anbietern oder mit dem lokalen Modell antworten.',
    'downloads.limitKb': 'Begrenzt die Geschwindigkeit aller Downloads; 0 heißt ohne Limit.',
    'downloads.folder':
      'Hier landen heruntergeladene Dateien; leer nimmt den Downloads-Ordner des Systems.',
    'downloads.torrent':
      'Erlaubt Downloads über BitTorrent. Ohne diesen Schalter bleibt der Torrent-Teil aus.',
    'downloads.torrentDht':
      'Findet Teilnehmer ohne zentralen Tracker; nötig für Magnet-Links ohne Tracker.',
    'downloads.torrentUpnp':
      'Bittet den Router, den nötigen Port selbst zu öffnen, damit andere dich erreichen.',
    'downloads.torrentUpKb':
      'Begrenzt die Upload-Geschwindigkeit bei Torrents; 0 heißt ohne Limit.',
    'downloads.torrentDownKb':
      'Begrenzt die Download-Geschwindigkeit bei Torrents; 0 heißt ohne Limit.',
    'downloads.seedRatio':
      'Beendet das Teilen, sobald du so viel hochgeladen hast wie dieses Vielfache des Heruntergeladenen; 0 heißt nie.',
    'downloads.seedMinutes': 'Beendet das Teilen nach dieser Zeit; 0 heißt nie.',
    'example.showDone': 'Zeigt erledigte Einträge weiter in der Liste.',
    'finance.forecastHorizon':
      'Wie weit der Ausblick vorausrechnet: bis Monatsende, 30 oder 90 Tage.',
    'finance.includeOpenInvoices':
      'Zieht offene Rechnungen vom verfügbaren Betrag ab, damit du siehst, was wirklich frei ist.',
    'mail.notifyEvery': 'So oft sieht die App nach neuen Mails, solange sie läuft.',
    'notes.width': 'Wie breit der Schreibbereich ist; schmal liest sich bequemer.',
    'notes.wordCount': 'Zeigt unter der Notiz, wie viele Wörter sie hat.',
    'pantry.soonDays':
      'Ab so vielen Tagen vor dem Ablaufdatum gilt ein Artikel als „läuft bald ab“.',
    'pantry.remindDaysBefore': 'So viele Tage vor dem Ablaufdatum bekommst du eine Erinnerung.',
    'todos.showDone': 'Zeigt abgehakte Aufgaben weiter in der Liste.',
    'vault.remindDaysBefore':
      'So viele Tage vor dem Ablauf eines Dokuments bekommst du eine Erinnerung.',
    'vault.remindDaysBeforeDeadline':
      'So viele Tage vor einer Kündigungsfrist bekommst du eine Erinnerung.',
  },
  {
    en: {
      'accounts.autoLockMinutes':
        'After this long without input the vault locks and has to be unlocked again.',
      'accounts.backgroundLock': 'Sets how quickly the vault locks when you switch to another app.',
      'accounts.originMatch':
        'Decides where the browser extension offers logins: for the whole domain or only for exactly this address.',
      'accounts.genLength': 'The length of passwords the browser extension creates.',
      'accounts.genSymbols': 'New passwords also contain special characters such as ! or #.',
      'accounts.genAvoidAmbiguous':
        'Leaves out characters that are easy to mix up, such as I, l, 1, O and 0.',
      'browser.engine': 'The search engine used from the address bar.',
      'browser.history': 'Remembers visited pages on this device so you can find them again.',
      'browser.httpWarning': 'Shows a notice before you open a page without encryption (HTTP).',
      'browser.blocker': 'Blocks known advertising and tracking addresses on pages you open.',
      'browser.hint': 'Shows or hides the note about the system browser.',
      'calendar.defaultView': 'The calendar opens with this view.',
      'chat.defaultEngine':
        'Decides whether new chats are answered by your providers or by the local model.',
      'downloads.limitKb': 'Limits the speed of all downloads; 0 means no limit.',
      'downloads.folder': 'Downloaded files end up here; empty uses the system Downloads folder.',
      'downloads.torrent':
        'Allows downloads over BitTorrent. Without this switch the torrent part stays off.',
      'downloads.torrentDht':
        'Finds peers without a central tracker; needed for magnet links without a tracker.',
      'downloads.torrentUpnp':
        'Asks the router to open the needed port itself so others can reach you.',
      'downloads.torrentUpKb': 'Limits the upload speed of torrents; 0 means no limit.',
      'downloads.torrentDownKb': 'Limits the download speed of torrents; 0 means no limit.',
      'downloads.seedRatio':
        'Stops sharing once you have uploaded this multiple of what you downloaded; 0 means never.',
      'downloads.seedMinutes': 'Stops sharing after this long; 0 means never.',
      'example.showDone': 'Keeps finished entries in the list.',
      'finance.forecastHorizon':
        'How far the outlook looks ahead: to the end of the month, 30 or 90 days.',
      'finance.includeOpenInvoices':
        'Subtracts open invoices from the available amount so you see what is really free.',
      'mail.notifyEvery': 'How often the app looks for new mail while it is running.',
      'notes.width': 'How wide the writing area is; narrow is easier to read.',
      'notes.wordCount': 'Shows how many words the note has below it.',
      'pantry.soonDays': 'An item counts as "expires soon" from this many days before its date.',
      'pantry.remindDaysBefore': 'You get a reminder this many days before the expiry date.',
      'todos.showDone': 'Keeps ticked tasks in the list.',
      'vault.remindDaysBefore': 'You get a reminder this many days before a document expires.',
      'vault.remindDaysBeforeDeadline':
        'You get a reminder this many days before a notice deadline.',
    },
    es: {
      'accounts.autoLockMinutes':
        'Tras este tiempo sin actividad, la caja fuerte se bloquea y hay que desbloquearla de nuevo.',
      'accounts.backgroundLock':
        'Define con qué rapidez se bloquea la caja fuerte al cambiar a otra app.',
      'accounts.originMatch':
        'Decide dónde la extensión del navegador ofrece accesos: para todo el dominio o solo para esta dirección exacta.',
      'accounts.genLength': 'La longitud de las contraseñas que crea la extensión del navegador.',
      'accounts.genSymbols':
        'Las contraseñas nuevas incluyen también caracteres especiales como ! o #.',
      'accounts.genAvoidAmbiguous': 'Omite caracteres fáciles de confundir, como I, l, 1, O y 0.',
      'browser.engine': 'El buscador que se usa desde la barra de direcciones.',
      'browser.history':
        'Recuerda las páginas visitadas en este dispositivo para que puedas volver a encontrarlas.',
      'browser.httpWarning': 'Muestra un aviso antes de abrir una página sin cifrado (HTTP).',
      'browser.blocker':
        'Bloquea direcciones conocidas de publicidad y rastreo en las páginas que abres.',
      'browser.hint': 'Muestra u oculta la nota sobre el navegador del sistema.',
      'calendar.defaultView': 'El calendario se abre con esta vista.',
      'chat.defaultEngine':
        'Decide si los chats nuevos los responden tus proveedores o el modelo local.',
      'downloads.limitKb': 'Limita la velocidad de todas las descargas; 0 significa sin límite.',
      'downloads.folder':
        'Aquí se guardan los archivos descargados; vacío usa la carpeta Descargas del sistema.',
      'downloads.torrent':
        'Permite descargas por BitTorrent. Sin este interruptor, la parte de torrents queda desactivada.',
      'downloads.torrentDht':
        'Encuentra participantes sin un rastreador central; necesario para enlaces magnet sin rastreador.',
      'downloads.torrentUpnp':
        'Pide al router que abra por sí mismo el puerto necesario para que otros te alcancen.',
      'downloads.torrentUpKb':
        'Limita la velocidad de subida de los torrents; 0 significa sin límite.',
      'downloads.torrentDownKb':
        'Limita la velocidad de descarga de los torrents; 0 significa sin límite.',
      'downloads.seedRatio':
        'Deja de compartir cuando hayas subido este múltiplo de lo descargado; 0 significa nunca.',
      'downloads.seedMinutes': 'Deja de compartir pasado este tiempo; 0 significa nunca.',
      'example.showDone': 'Mantiene las entradas terminadas en la lista.',
      'finance.forecastHorizon': 'Hasta dónde llega la previsión: hasta fin de mes, 30 o 90 días.',
      'finance.includeOpenInvoices':
        'Resta las facturas abiertas del importe disponible para que veas lo que está realmente libre.',
      'mail.notifyEvery': 'Cada cuánto busca la app correo nuevo mientras está en marcha.',
      'notes.width': 'El ancho del área de escritura; estrecha se lee con más comodidad.',
      'notes.wordCount': 'Muestra debajo de la nota cuántas palabras tiene.',
      'pantry.soonDays':
        'Un artículo cuenta como «caduca pronto» desde estos días antes de su fecha.',
      'pantry.remindDaysBefore':
        'Recibes un recordatorio estos días antes de la fecha de caducidad.',
      'todos.showDone': 'Mantiene las tareas marcadas en la lista.',
      'vault.remindDaysBefore':
        'Recibes un recordatorio estos días antes de que caduque un documento.',
      'vault.remindDaysBeforeDeadline':
        'Recibes un recordatorio estos días antes de un plazo de cancelación.',
    },
    fr: {
      'accounts.autoLockMinutes':
        'Après ce temps sans saisie, le coffre se verrouille et doit être déverrouillé de nouveau.',
      'accounts.backgroundLock':
        'Définit la rapidité avec laquelle le coffre se verrouille quand vous passez à une autre application.',
      'accounts.originMatch':
        'Décide où l’extension du navigateur propose des identifiants : pour tout le domaine ou seulement pour cette adresse exacte.',
      'accounts.genLength': 'La longueur des mots de passe créés par l’extension du navigateur.',
      'accounts.genSymbols':
        'Les nouveaux mots de passe contiennent aussi des caractères spéciaux comme ! ou #.',
      'accounts.genAvoidAmbiguous':
        'Omet les caractères faciles à confondre, comme I, l, 1, O et 0.',
      'browser.engine': 'Le moteur de recherche utilisé depuis la barre d’adresse.',
      'browser.history':
        'Retient les pages visitées sur cet appareil pour que vous puissiez les retrouver.',
      'browser.httpWarning':
        'Affiche un avertissement avant d’ouvrir une page sans chiffrement (HTTP).',
      'browser.blocker':
        'Bloque les adresses connues de publicité et de suivi sur les pages que vous ouvrez.',
      'browser.hint': 'Affiche ou masque la remarque sur le navigateur du système.',
      'calendar.defaultView': 'Le calendrier s’ouvre avec cette vue.',
      'chat.defaultEngine':
        'Décide si les nouvelles discussions reçoivent leur réponse de vos fournisseurs ou du modèle local.',
      'downloads.limitKb':
        'Limite la vitesse de tous les téléchargements ; 0 signifie sans limite.',
      'downloads.folder':
        'Les fichiers téléchargés arrivent ici ; vide utilise le dossier Téléchargements du système.',
      'downloads.torrent':
        'Autorise les téléchargements par BitTorrent. Sans cet interrupteur, la partie torrent reste désactivée.',
      'downloads.torrentDht':
        'Trouve des pairs sans tracker central ; nécessaire pour les liens magnet sans tracker.',
      'downloads.torrentUpnp':
        'Demande au routeur d’ouvrir lui-même le port nécessaire pour que d’autres puissent vous joindre.',
      'downloads.torrentUpKb': 'Limite la vitesse d’envoi des torrents ; 0 signifie sans limite.',
      'downloads.torrentDownKb':
        'Limite la vitesse de téléchargement des torrents ; 0 signifie sans limite.',
      'downloads.seedRatio':
        'Arrête le partage dès que vous avez envoyé ce multiple de ce que vous avez téléchargé ; 0 signifie jamais.',
      'downloads.seedMinutes': 'Arrête le partage après ce temps ; 0 signifie jamais.',
      'example.showDone': 'Garde les entrées terminées dans la liste.',
      'finance.forecastHorizon':
        'Jusqu’où va la prévision : jusqu’à la fin du mois, 30 ou 90 jours.',
      'finance.includeOpenInvoices':
        'Déduit les factures ouvertes du montant disponible pour que vous voyiez ce qui est vraiment libre.',
      'mail.notifyEvery':
        'La fréquence à laquelle l’application cherche de nouveaux e-mails tant qu’elle tourne.',
      'notes.width':
        'La largeur de la zone d’écriture ; étroite, elle se lit plus confortablement.',
      'notes.wordCount': 'Affiche sous la note le nombre de mots qu’elle contient.',
      'pantry.soonDays':
        'Un article compte comme « expire bientôt » à partir de ce nombre de jours avant sa date.',
      'pantry.remindDaysBefore':
        'Vous recevez un rappel ce nombre de jours avant la date d’expiration.',
      'todos.showDone': 'Garde les tâches cochées dans la liste.',
      'vault.remindDaysBefore':
        'Vous recevez un rappel ce nombre de jours avant l’expiration d’un document.',
      'vault.remindDaysBeforeDeadline':
        'Vous recevez un rappel ce nombre de jours avant un délai de résiliation.',
    },
    'pt-BR': {
      'accounts.autoLockMinutes':
        'Depois desse tempo sem uso, o cofre bloqueia e precisa ser desbloqueado de novo.',
      'accounts.backgroundLock':
        'Define com que rapidez o cofre bloqueia quando você troca para outro app.',
      'accounts.originMatch':
        'Decide onde a extensão do navegador oferece logins: para todo o domínio ou só para este endereço exato.',
      'accounts.genLength': 'O tamanho das senhas que a extensão do navegador cria.',
      'accounts.genSymbols': 'As senhas novas também têm caracteres especiais, como ! ou #.',
      'accounts.genAvoidAmbiguous':
        'Deixa de fora caracteres fáceis de confundir, como I, l, 1, O e 0.',
      'browser.engine': 'O buscador usado a partir da barra de endereços.',
      'browser.history':
        'Guarda as páginas visitadas neste dispositivo para você encontrá-las de novo.',
      'browser.httpWarning': 'Mostra um aviso antes de abrir uma página sem criptografia (HTTP).',
      'browser.blocker':
        'Bloqueia endereços conhecidos de publicidade e rastreamento nas páginas que você abre.',
      'browser.hint': 'Mostra ou oculta a observação sobre o navegador do sistema.',
      'calendar.defaultView': 'O calendário abre com esta visualização.',
      'chat.defaultEngine':
        'Decide se os chats novos são respondidos pelos seus provedores ou pelo modelo local.',
      'downloads.limitKb': 'Limita a velocidade de todos os downloads; 0 significa sem limite.',
      'downloads.folder':
        'Os arquivos baixados ficam aqui; vazio usa a pasta Downloads do sistema.',
      'downloads.torrent':
        'Permite downloads por BitTorrent. Sem esta chave, a parte de torrents fica desligada.',
      'downloads.torrentDht':
        'Encontra participantes sem um rastreador central; necessário para links magnet sem rastreador.',
      'downloads.torrentUpnp':
        'Pede ao roteador que abra sozinho a porta necessária para que outros alcancem você.',
      'downloads.torrentUpKb': 'Limita a velocidade de envio dos torrents; 0 significa sem limite.',
      'downloads.torrentDownKb':
        'Limita a velocidade de download dos torrents; 0 significa sem limite.',
      'downloads.seedRatio':
        'Para de compartilhar quando você tiver enviado este múltiplo do que baixou; 0 significa nunca.',
      'downloads.seedMinutes': 'Para de compartilhar depois deste tempo; 0 significa nunca.',
      'example.showDone': 'Mantém as entradas concluídas na lista.',
      'finance.forecastHorizon': 'Até onde vai a previsão: até o fim do mês, 30 ou 90 dias.',
      'finance.includeOpenInvoices':
        'Desconta as faturas em aberto do valor disponível para você ver o que está realmente livre.',
      'mail.notifyEvery': 'Com que frequência o app procura e-mails novos enquanto está aberto.',
      'notes.width': 'A largura da área de escrita; estreita é mais confortável de ler.',
      'notes.wordCount': 'Mostra abaixo da nota quantas palavras ela tem.',
      'pantry.soonDays':
        'Um item conta como «vence em breve» a partir deste número de dias antes da data.',
      'pantry.remindDaysBefore': 'Você recebe um lembrete este número de dias antes do vencimento.',
      'todos.showDone': 'Mantém as tarefas marcadas na lista.',
      'vault.remindDaysBefore':
        'Você recebe um lembrete este número de dias antes de um documento vencer.',
      'vault.remindDaysBeforeDeadline':
        'Você recebe um lembrete este número de dias antes de um prazo de cancelamento.',
    },
  },
);

/** The explanation of a module setting that has no `help` of its own, if one is written. */
export function fieldHelpFor(moduleId: string, key: string): string | undefined {
  return (tFieldHelp.get() as Record<string, string>)[`${moduleId}.${key}`];
}
