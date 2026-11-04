import { defineBundle } from '@/core/i18n/bundle';

/**
 * Texts of the automation templates (`core/automation/templates.ts`): name and one-line description
 * for the settings, plus the wording of the hints, reminders and entries a rule leaves. `{field}`
 * is replaced by the engine from the event (see `core/automation/template.ts`). Calm wording: no
 * guilt, no counters, no exclamation marks (docs/design/FOCUS-WORDING.md).
 */
const de = {
  settings: {
    title: 'Automatisierungen',
    description:
      'Fertige Regeln nach dem Muster „Wenn das passiert, dann tu das“. Alles bleibt auf diesem Gerät, nichts wird gelöscht oder verschickt.',
    keywords: ['Regeln', 'Automatisierung', 'Wenn dann', 'Vorlagen', 'Trockenlauf', 'Erinnerung'],
    enabled: 'Automatisierungen verwenden',
    enabledHint: 'Aus: keine Regel läuft, nichts wird beobachtet.',
    dryRun: 'Nur ausprobieren (Trockenlauf)',
    dryRunHint:
      'Die Regeln schreiben nur ins Protokoll, was sie tun würden. Es ändert sich nichts.',
    limit: 'Regelläufe pro Stunde, alle zusammen',
    limitHint: '0 heißt: kein gemeinsames Limit. Jede Regel hat zusätzlich ihr eigenes Limit.',
    templates: 'Vorlagen',
    templatesHint: 'Alle sind zu Beginn aus.',
    needs: (names: string) => `Braucht: ${names}`,
    params: { daysBefore: 'Tage vorher', time: 'Uhrzeit', minutes: 'Minuten' } as Record<
      string,
      string
    >,
    ruleOn: (title: string) => `${title} einschalten`,
  },
  log: {
    title: 'Regel-Protokoll',
    description: 'Was die Regeln zuletzt getan haben. Ein Lauf lässt sich zurücknehmen.',
    keywords: ['Protokoll', 'Regel', 'Rückgängig', 'Verlauf', 'Automatisierung'],
    listLabel: 'Letzte Regelläufe',
    empty: 'Noch kein Regellauf.',
    undo: 'Rückgängig',
    undone: 'Zurückgenommen',
    undoneDetail: (removed: number, kept: number) =>
      kept > 0
        ? `${removed} zurückgenommen, ${kept} behalten (inzwischen geändert).`
        : `${removed} zurückgenommen.`,
    results: {
      done: 'ausgeführt',
      dry: 'Trockenlauf',
      skipped: 'übersprungen',
      error: 'nicht möglich',
    } as Record<string, string>,
    reasons: {
      loop: 'Schleife erkannt',
      depth: 'zu viele Schritte hintereinander',
      limit: 'Limit pro Stunde erreicht',
      'global-limit': 'gemeinsames Limit erreicht',
      duplicate: 'schon erledigt',
    } as Record<string, string>,
    notes: {
      dry: 'nur geprüft',
      exists: 'war schon da',
      busy: 'läuft schon',
      incomplete: 'unvollständig',
      'not-allowed': 'nicht erlaubt',
      'module-unavailable': 'Modul ist aus',
      'no-target': 'Eintrag nicht gefunden',
      conflict: 'Eintrag wurde geändert',
      error: 'Fehler',
      'unknown-profile': 'Profil unbekannt',
      invalid: 'ungültig',
    } as Record<string, string>,
    suggestions: 'Vorschläge',
    suggestionsHint:
      'Eine Regel hat diese Einträge vorbereitet. Gespeichert wird erst, wenn du bestätigst.',
    review: 'Prüfen',
    dismiss: 'Verwerfen',
    reviewTitle: 'Vorschlag prüfen',
  },
  palette: {
    run: (title: string) => `Regel ausführen: ${title}`,
    ran: 'Regel ausgeführt.',
    log: 'Regel-Protokoll öffnen',
    undoLast: 'Letzte Regel-Ausführung rückgängig',
    nothingToUndo: 'Es gibt nichts zurückzunehmen.',
    keywords: ['regel', 'automatisierung', 'protokoll'],
  },
  dev: {
    dryRunAll: 'Regeln trocken laufen lassen',
    dryRunDone: (n: number) => `Trockenlauf: ${n} Regeln geprüft, siehe Regel-Protokoll.`,
    dryRunNone: 'Keine Regel ist an.',
  },
  templates: {
    invoiceDue: {
      title: 'Rechnung bald fällig',
      description:
        'Erinnerung und Aufgabe, wenn eine offene Rechnung in den nächsten Tagen fällig wird.',
      reminder: 'Rechnung {payee} ist am {dueDate} fällig',
      task: 'Rechnung {payee} bezahlen',
    },
    stockLow: {
      title: 'Vorrat fast leer',
      description:
        'Setzt einen Vorrat auf die Einkaufsliste, sobald er den Mindestbestand erreicht.',
    },
    priceUp: {
      title: 'Abo wird teurer',
      description: 'Ein Hinweis, wenn sich der Preis eines Abos erhöht.',
      notice: '{name}: Preis um {percent} % erhöht',
    },
    weeklyReview: {
      title: 'Wochenrückblick',
      description: 'Ein Hinweis zu einer festen Zeit, einmal in der Woche.',
      notice: 'Zeit für den Wochenrückblick',
      body: 'Was lief gut, und was steht als Nächstes an?',
    },
    invoiceMail: {
      title: 'Rechnung per Mail',
      description:
        'Legt einen Vorschlag an, wenn eine neue Mail nach einer Rechnung aussieht. Du bestätigst ihn selbst.',
    },
    timeFocus: {
      title: 'Zeiterfassung startet Fokus',
      description:
        'Startet eine Fokusrunde, wenn du die Zeiterfassung startest und keine Runde läuft.',
      task: 'Zeiterfassung',
    },
    renewal: {
      title: 'Abo wird bald abgebucht',
      description: 'Erinnerung einige Tage vor der nächsten Abbuchung.',
      reminder: '{name} wird am {nextDate} abgebucht',
    },
    habitEvening: {
      title: 'Ziel am Abend noch offen',
      description:
        'Ein leiser Hinweis am Abend, wenn ein Tagesziel noch offen ist. Einmal pro Ziel und Tag.',
      notice: '{name} ist heute noch offen',
      body: 'Nur, falls du magst.',
    },
    pantryExpiry: {
      title: 'Vorrat läuft bald ab',
      description: 'Eine Aufgabe, wenn das Haltbarkeitsdatum näher rückt.',
      task: '{name} aufbrauchen',
    },
    workMorning: {
      title: 'Profil „Arbeit“ am Morgen',
      description: 'Schaltet an Werktagen zu einer festen Zeit auf das Profil „Arbeit“.',
    },
    eveningProfile: {
      title: 'Profil „Abends“',
      description: 'Schaltet jeden Tag zu einer festen Zeit auf das Profil „Abends“.',
    },
    taskDone: {
      title: 'Wichtige Aufgabe erledigt',
      description: 'Ein freundlicher Hinweis, wenn eine Aufgabe mit hoher Priorität erledigt ist.',
      notice: 'Geschafft: {title}',
    },
  },
};

type Shape = typeof de;

const en: Shape = {
  settings: {
    title: 'Automations',
    description:
      'Ready-made rules of the kind “when this happens, do that”. Everything stays on this device, nothing is deleted or sent.',
    keywords: ['rules', 'automation', 'if then', 'templates', 'dry run', 'reminder'],
    enabled: 'Use automations',
    enabledHint: 'Off: no rule runs and nothing is watched.',
    dryRun: 'Just try it out (dry run)',
    dryRunHint: 'Rules only write to the log what they would do. Nothing changes.',
    limit: 'Rule runs per hour, all together',
    limitHint: '0 means no shared limit. Every rule also has its own limit.',
    templates: 'Templates',
    templatesHint: 'All of them are off at first.',
    needs: (names: string) => `Needs: ${names}`,
    params: { daysBefore: 'Days before', time: 'Time', minutes: 'Minutes' } as Record<
      string,
      string
    >,
    ruleOn: (title: string) => `Turn on ${title}`,
  },
  log: {
    title: 'Rule log',
    description: 'What the rules did lately. A run can be taken back.',
    keywords: ['log', 'rule', 'undo', 'history', 'automation'],
    listLabel: 'Latest rule runs',
    empty: 'No rule run yet.',
    undo: 'Undo',
    undone: 'Taken back',
    undoneDetail: (removed: number, kept: number) =>
      kept > 0
        ? `${removed} taken back, ${kept} kept (changed meanwhile).`
        : `${removed} taken back.`,
    results: {
      done: 'done',
      dry: 'dry run',
      skipped: 'skipped',
      error: 'not possible',
    } as Record<string, string>,
    reasons: {
      loop: 'loop detected',
      depth: 'too many steps in a row',
      limit: 'hourly limit reached',
      'global-limit': 'shared limit reached',
      duplicate: 'already done',
    } as Record<string, string>,
    notes: {
      dry: 'only checked',
      exists: 'was already there',
      busy: 'already running',
      incomplete: 'incomplete',
      'not-allowed': 'not allowed',
      'module-unavailable': 'module is off',
      'no-target': 'entry not found',
      conflict: 'entry was changed',
      error: 'error',
      'unknown-profile': 'unknown profile',
      invalid: 'invalid',
    } as Record<string, string>,
    suggestions: 'Suggestions',
    suggestionsHint: 'A rule prepared these entries. Nothing is saved until you confirm.',
    review: 'Review',
    dismiss: 'Dismiss',
    reviewTitle: 'Review suggestion',
  },
  palette: {
    run: (title: string) => `Run rule: ${title}`,
    ran: 'Rule run.',
    log: 'Open rule log',
    undoLast: 'Undo last rule run',
    nothingToUndo: 'There is nothing to take back.',
    keywords: ['rule', 'automation', 'log'],
  },
  dev: {
    dryRunAll: 'Dry-run the rules',
    dryRunDone: (n: number) => `Dry run: ${n} rules checked, see the rule log.`,
    dryRunNone: 'No rule is on.',
  },
  templates: {
    invoiceDue: {
      title: 'Invoice due soon',
      description: 'A reminder and a task when an open invoice falls due in the next few days.',
      reminder: 'Invoice {payee} is due on {dueDate}',
      task: 'Pay invoice {payee}',
    },
    stockLow: {
      title: 'Stock running low',
      description: 'Puts a pantry item on the shopping list once it reaches its minimum.',
    },
    priceUp: {
      title: 'Subscription gets pricier',
      description: 'A hint when the price of a subscription goes up.',
      notice: '{name}: price up by {percent} %',
    },
    weeklyReview: {
      title: 'Weekly review',
      description: 'A hint at a fixed time, once a week.',
      notice: 'Time for the weekly review',
      body: 'What went well, and what is next?',
    },
    invoiceMail: {
      title: 'Invoice by mail',
      description:
        'Creates a suggestion when a new mail looks like an invoice. You confirm it yourself.',
    },
    timeFocus: {
      title: 'Time tracking starts focus',
      description: 'Starts a focus round when you start time tracking and no round is running.',
      task: 'Time tracking',
    },
    renewal: {
      title: 'Subscription charged soon',
      description: 'A reminder a few days before the next charge.',
      reminder: '{name} will be charged on {nextDate}',
    },
    habitEvening: {
      title: 'Goal still open in the evening',
      description:
        'A quiet hint in the evening when a daily goal is still open. Once per goal and day.',
      notice: '{name} is still open today',
      body: 'Only if you like.',
    },
    pantryExpiry: {
      title: 'Stock expires soon',
      description: 'A task when the best-before date gets close.',
      task: 'Use up {name}',
    },
    workMorning: {
      title: 'Profile “Work” in the morning',
      description: 'Switches to the profile “Work” on weekdays at a fixed time.',
    },
    eveningProfile: {
      title: 'Profile “Evening”',
      description: 'Switches to the profile “Evening” every day at a fixed time.',
    },
    taskDone: {
      title: 'Important task done',
      description: 'A friendly hint when a high-priority task is done.',
      notice: 'Done: {title}',
    },
  },
};

const es: Shape = {
  settings: {
    title: 'Automatizaciones',
    description:
      'Reglas listas del tipo «cuando pase esto, haz aquello». Todo queda en este dispositivo, no se borra ni se envía nada.',
    keywords: [
      'reglas',
      'automatización',
      'si entonces',
      'plantillas',
      'simulacro',
      'recordatorio',
    ],
    enabled: 'Usar automatizaciones',
    enabledHint: 'Desactivado: no se ejecuta ninguna regla ni se observa nada.',
    dryRun: 'Solo probar (simulacro)',
    dryRunHint: 'Las reglas solo anotan en el registro lo que harían. No cambia nada.',
    limit: 'Ejecuciones de reglas por hora, en total',
    limitHint: '0 significa sin límite común. Cada regla tiene además su propio límite.',
    templates: 'Plantillas',
    templatesHint: 'Al principio todas están desactivadas.',
    needs: (names: string) => `Necesita: ${names}`,
    params: { daysBefore: 'Días antes', time: 'Hora', minutes: 'Minutos' } as Record<
      string,
      string
    >,
    ruleOn: (title: string) => `Activar ${title}`,
  },
  log: {
    title: 'Registro de reglas',
    description: 'Lo que hicieron las reglas últimamente. Una ejecución se puede deshacer.',
    keywords: ['registro', 'regla', 'deshacer', 'historial', 'automatización'],
    listLabel: 'Últimas ejecuciones de reglas',
    empty: 'Aún no hay ninguna ejecución.',
    undo: 'Deshacer',
    undone: 'Deshecho',
    undoneDetail: (removed: number, kept: number) =>
      kept > 0
        ? `${removed} deshechos, ${kept} conservados (cambiados entretanto).`
        : `${removed} deshechos.`,
    results: {
      done: 'hecho',
      dry: 'simulacro',
      skipped: 'omitido',
      error: 'no es posible',
    } as Record<string, string>,
    reasons: {
      loop: 'bucle detectado',
      depth: 'demasiados pasos seguidos',
      limit: 'límite por hora alcanzado',
      'global-limit': 'límite común alcanzado',
      duplicate: 'ya hecho',
    } as Record<string, string>,
    notes: {
      dry: 'solo comprobado',
      exists: 'ya existía',
      busy: 'ya en marcha',
      incomplete: 'incompleto',
      'not-allowed': 'no permitido',
      'module-unavailable': 'módulo desactivado',
      'no-target': 'entrada no encontrada',
      conflict: 'la entrada cambió',
      error: 'error',
      'unknown-profile': 'perfil desconocido',
      invalid: 'no válido',
    } as Record<string, string>,
    suggestions: 'Sugerencias',
    suggestionsHint: 'Una regla preparó estas entradas. No se guarda nada hasta que confirmes.',
    review: 'Revisar',
    dismiss: 'Descartar',
    reviewTitle: 'Revisar sugerencia',
  },
  palette: {
    run: (title: string) => `Ejecutar regla: ${title}`,
    ran: 'Regla ejecutada.',
    log: 'Abrir registro de reglas',
    undoLast: 'Deshacer la última ejecución de reglas',
    nothingToUndo: 'No hay nada que deshacer.',
    keywords: ['regla', 'automatización', 'registro'],
  },
  dev: {
    dryRunAll: 'Probar las reglas en simulacro',
    dryRunDone: (n: number) => `Simulacro: ${n} reglas comprobadas, ver el registro de reglas.`,
    dryRunNone: 'No hay ninguna regla activada.',
  },
  templates: {
    invoiceDue: {
      title: 'Factura a punto de vencer',
      description:
        'Un recordatorio y una tarea cuando una factura abierta vence en los próximos días.',
      reminder: 'La factura {payee} vence el {dueDate}',
      task: 'Pagar la factura {payee}',
    },
    stockLow: {
      title: 'Existencias casi agotadas',
      description:
        'Añade un artículo de la despensa a la lista de la compra al llegar a su mínimo.',
    },
    priceUp: {
      title: 'Una suscripción sube de precio',
      description: 'Un aviso cuando sube el precio de una suscripción.',
      notice: '{name}: precio +{percent} %',
    },
    weeklyReview: {
      title: 'Repaso semanal',
      description: 'Un aviso a una hora fija, una vez por semana.',
      notice: 'Es hora del repaso semanal',
      body: '¿Qué fue bien y qué viene ahora?',
    },
    invoiceMail: {
      title: 'Factura por correo',
      description:
        'Crea una sugerencia cuando un correo nuevo parece una factura. La confirmas tú.',
    },
    timeFocus: {
      title: 'El registro de tiempo inicia el foco',
      description:
        'Inicia una ronda de foco al iniciar el registro de tiempo si no hay ninguna en marcha.',
      task: 'Registro de tiempo',
    },
    renewal: {
      title: 'Suscripción a punto de cobrarse',
      description: 'Un recordatorio unos días antes del próximo cobro.',
      reminder: '{name} se cobrará el {nextDate}',
    },
    habitEvening: {
      title: 'Objetivo aún abierto por la tarde',
      description:
        'Un aviso discreto por la tarde si un objetivo diario sigue abierto. Una vez por objetivo y día.',
      notice: '{name} sigue abierto hoy',
      body: 'Solo si quieres.',
    },
    pantryExpiry: {
      title: 'Existencias a punto de caducar',
      description: 'Una tarea cuando se acerca la fecha de caducidad.',
      task: 'Consumir {name}',
    },
    workMorning: {
      title: 'Perfil «Trabajo» por la mañana',
      description: 'Cambia al perfil «Trabajo» los días laborables a una hora fija.',
    },
    eveningProfile: {
      title: 'Perfil «Tarde»',
      description: 'Cambia al perfil «Tarde» cada día a una hora fija.',
    },
    taskDone: {
      title: 'Tarea importante hecha',
      description: 'Un aviso amable cuando se completa una tarea de prioridad alta.',
      notice: 'Hecho: {title}',
    },
  },
};

const fr: Shape = {
  settings: {
    title: 'Automatisations',
    description:
      'Des règles toutes prêtes du type « quand ceci arrive, fais cela ». Tout reste sur cet appareil, rien n’est supprimé ni envoyé.',
    keywords: ['règles', 'automatisation', 'si alors', 'modèles', 'test à blanc', 'rappel'],
    enabled: 'Utiliser les automatisations',
    enabledHint: 'Désactivé : aucune règle ne s’exécute et rien n’est surveillé.',
    dryRun: 'Seulement essayer (test à blanc)',
    dryRunHint: 'Les règles notent seulement dans le journal ce qu’elles feraient. Rien ne change.',
    limit: 'Exécutions de règles par heure, au total',
    limitHint: '0 signifie pas de limite commune. Chaque règle a aussi sa propre limite.',
    templates: 'Modèles',
    templatesHint: 'Au début, tous sont désactivés.',
    needs: (names: string) => `Nécessite : ${names}`,
    params: { daysBefore: 'Jours avant', time: 'Heure', minutes: 'Minutes' } as Record<
      string,
      string
    >,
    ruleOn: (title: string) => `Activer ${title}`,
  },
  log: {
    title: 'Journal des règles',
    description: 'Ce que les règles ont fait récemment. Une exécution peut être annulée.',
    keywords: ['journal', 'règle', 'annuler', 'historique', 'automatisation'],
    listLabel: 'Dernières exécutions de règles',
    empty: 'Aucune exécution pour l’instant.',
    undo: 'Annuler',
    undone: 'Annulé',
    undoneDetail: (removed: number, kept: number) =>
      kept > 0
        ? `${removed} annulés, ${kept} conservés (modifiés entre-temps).`
        : `${removed} annulés.`,
    results: {
      done: 'fait',
      dry: 'test à blanc',
      skipped: 'ignoré',
      error: 'impossible',
    } as Record<string, string>,
    reasons: {
      loop: 'boucle détectée',
      depth: 'trop d’étapes à la suite',
      limit: 'limite par heure atteinte',
      'global-limit': 'limite commune atteinte',
      duplicate: 'déjà fait',
    } as Record<string, string>,
    notes: {
      dry: 'seulement vérifié',
      exists: 'existait déjà',
      busy: 'déjà en cours',
      incomplete: 'incomplet',
      'not-allowed': 'non autorisé',
      'module-unavailable': 'module désactivé',
      'no-target': 'entrée introuvable',
      conflict: 'l’entrée a changé',
      error: 'erreur',
      'unknown-profile': 'profil inconnu',
      invalid: 'invalide',
    } as Record<string, string>,
    suggestions: 'Suggestions',
    suggestionsHint:
      'Une règle a préparé ces entrées. Rien n’est enregistré tant que tu n’as pas confirmé.',
    review: 'Vérifier',
    dismiss: 'Écarter',
    reviewTitle: 'Vérifier la suggestion',
  },
  palette: {
    run: (title: string) => `Exécuter la règle : ${title}`,
    ran: 'Règle exécutée.',
    log: 'Ouvrir le journal des règles',
    undoLast: 'Annuler la dernière exécution de règle',
    nothingToUndo: 'Il n’y a rien à annuler.',
    keywords: ['règle', 'automatisation', 'journal'],
  },
  dev: {
    dryRunAll: 'Tester les règles à blanc',
    dryRunDone: (n: number) => `Test à blanc : ${n} règles vérifiées, voir le journal des règles.`,
    dryRunNone: 'Aucune règle n’est activée.',
  },
  templates: {
    invoiceDue: {
      title: 'Facture bientôt due',
      description:
        'Un rappel et une tâche quand une facture ouverte arrive à échéance dans les prochains jours.',
      reminder: 'La facture {payee} est due le {dueDate}',
      task: 'Payer la facture {payee}',
    },
    stockLow: {
      title: 'Stock presque épuisé',
      description:
        'Ajoute un article du garde-manger à la liste de courses dès qu’il atteint son minimum.',
    },
    priceUp: {
      title: 'Un abonnement augmente',
      description: 'Une alerte quand le prix d’un abonnement augmente.',
      notice: '{name} : prix en hausse de {percent} %',
    },
    weeklyReview: {
      title: 'Bilan de la semaine',
      description: 'Une alerte à heure fixe, une fois par semaine.',
      notice: 'C’est l’heure du bilan de la semaine',
      body: 'Qu’est-ce qui s’est bien passé, et la suite ?',
    },
    invoiceMail: {
      title: 'Facture par e-mail',
      description:
        'Crée une suggestion quand un nouvel e-mail ressemble à une facture. Tu la confirmes toi-même.',
    },
    timeFocus: {
      title: 'Le suivi du temps lance le focus',
      description:
        'Lance une session de focus quand tu démarres le suivi du temps et qu’aucune ne tourne.',
      task: 'Suivi du temps',
    },
    renewal: {
      title: 'Abonnement bientôt prélevé',
      description: 'Un rappel quelques jours avant le prochain prélèvement.',
      reminder: '{name} sera prélevé le {nextDate}',
    },
    habitEvening: {
      title: 'Objectif encore ouvert le soir',
      description:
        'Une alerte discrète le soir si un objectif quotidien est encore ouvert. Une fois par objectif et par jour.',
      notice: '{name} est encore ouvert aujourd’hui',
      body: 'Seulement si tu veux.',
    },
    pantryExpiry: {
      title: 'Stock bientôt périmé',
      description: 'Une tâche quand la date limite approche.',
      task: 'Utiliser {name}',
    },
    workMorning: {
      title: 'Profil « Travail » le matin',
      description: 'Passe au profil « Travail » les jours ouvrés à une heure fixe.',
    },
    eveningProfile: {
      title: 'Profil « Soir »',
      description: 'Passe au profil « Soir » chaque jour à une heure fixe.',
    },
    taskDone: {
      title: 'Tâche importante terminée',
      description: 'Une alerte bienveillante quand une tâche de priorité haute est terminée.',
      notice: 'Fait : {title}',
    },
  },
};

const ptBR: Shape = {
  settings: {
    title: 'Automações',
    description:
      'Regras prontas do tipo “quando isto acontecer, faça aquilo”. Tudo fica neste dispositivo, nada é apagado nem enviado.',
    keywords: ['regras', 'automação', 'se então', 'modelos', 'simulação', 'lembrete'],
    enabled: 'Usar automações',
    enabledHint: 'Desligado: nenhuma regra roda e nada é observado.',
    dryRun: 'Só experimentar (simulação)',
    dryRunHint: 'As regras só anotam no registro o que fariam. Nada muda.',
    limit: 'Execuções de regras por hora, no total',
    limitHint: '0 significa sem limite comum. Cada regra também tem o seu próprio limite.',
    templates: 'Modelos',
    templatesHint: 'No começo, todos estão desligados.',
    needs: (names: string) => `Precisa de: ${names}`,
    params: { daysBefore: 'Dias antes', time: 'Hora', minutes: 'Minutos' } as Record<
      string,
      string
    >,
    ruleOn: (title: string) => `Ligar ${title}`,
  },
  log: {
    title: 'Registro de regras',
    description: 'O que as regras fizeram ultimamente. Uma execução pode ser desfeita.',
    keywords: ['registro', 'regra', 'desfazer', 'histórico', 'automação'],
    listLabel: 'Últimas execuções de regras',
    empty: 'Ainda não há execuções.',
    undo: 'Desfazer',
    undone: 'Desfeito',
    undoneDetail: (removed: number, kept: number) =>
      kept > 0
        ? `${removed} desfeitos, ${kept} mantidos (alterados nesse meio-tempo).`
        : `${removed} desfeitos.`,
    results: {
      done: 'feito',
      dry: 'simulação',
      skipped: 'ignorado',
      error: 'não foi possível',
    } as Record<string, string>,
    reasons: {
      loop: 'laço detectado',
      depth: 'passos demais seguidos',
      limit: 'limite por hora atingido',
      'global-limit': 'limite comum atingido',
      duplicate: 'já feito',
    } as Record<string, string>,
    notes: {
      dry: 'só verificado',
      exists: 'já existia',
      busy: 'já em andamento',
      incomplete: 'incompleto',
      'not-allowed': 'não permitido',
      'module-unavailable': 'módulo desligado',
      'no-target': 'entrada não encontrada',
      conflict: 'a entrada foi alterada',
      error: 'erro',
      'unknown-profile': 'perfil desconhecido',
      invalid: 'inválido',
    } as Record<string, string>,
    suggestions: 'Sugestões',
    suggestionsHint: 'Uma regra preparou estas entradas. Nada é salvo até você confirmar.',
    review: 'Revisar',
    dismiss: 'Descartar',
    reviewTitle: 'Revisar sugestão',
  },
  palette: {
    run: (title: string) => `Executar regra: ${title}`,
    ran: 'Regra executada.',
    log: 'Abrir registro de regras',
    undoLast: 'Desfazer a última execução de regra',
    nothingToUndo: 'Não há nada para desfazer.',
    keywords: ['regra', 'automação', 'registro'],
  },
  dev: {
    dryRunAll: 'Rodar as regras em simulação',
    dryRunDone: (n: number) => `Simulação: ${n} regras verificadas, veja o registro de regras.`,
    dryRunNone: 'Nenhuma regra está ligada.',
  },
  templates: {
    invoiceDue: {
      title: 'Fatura vencendo em breve',
      description: 'Um lembrete e uma tarefa quando uma fatura em aberto vence nos próximos dias.',
      reminder: 'A fatura {payee} vence em {dueDate}',
      task: 'Pagar a fatura {payee}',
    },
    stockLow: {
      title: 'Estoque quase acabando',
      description: 'Coloca um item da despensa na lista de compras quando chega ao mínimo.',
    },
    priceUp: {
      title: 'Assinatura ficou mais cara',
      description: 'Um aviso quando o preço de uma assinatura sobe.',
      notice: '{name}: preço subiu {percent} %',
    },
    weeklyReview: {
      title: 'Revisão da semana',
      description: 'Um aviso em um horário fixo, uma vez por semana.',
      notice: 'Hora da revisão da semana',
      body: 'O que foi bem e o que vem agora?',
    },
    invoiceMail: {
      title: 'Fatura por e-mail',
      description:
        'Cria uma sugestão quando um novo e-mail parece uma fatura. Você mesmo confirma.',
    },
    timeFocus: {
      title: 'Registro de tempo inicia o foco',
      description:
        'Inicia uma rodada de foco ao iniciar o registro de tempo, se nenhuma estiver em andamento.',
      task: 'Registro de tempo',
    },
    renewal: {
      title: 'Assinatura será cobrada em breve',
      description: 'Um lembrete alguns dias antes da próxima cobrança.',
      reminder: '{name} será cobrada em {nextDate}',
    },
    habitEvening: {
      title: 'Meta ainda aberta à noite',
      description:
        'Um aviso discreto à noite se uma meta diária ainda está aberta. Uma vez por meta e dia.',
      notice: '{name} ainda está aberta hoje',
      body: 'Só se quiser.',
    },
    pantryExpiry: {
      title: 'Item perto de vencer',
      description: 'Uma tarefa quando a data de validade se aproxima.',
      task: 'Usar {name}',
    },
    workMorning: {
      title: 'Perfil “Trabalho” de manhã',
      description: 'Muda para o perfil “Trabalho” em dias úteis, em um horário fixo.',
    },
    eveningProfile: {
      title: 'Perfil “Noite”',
      description: 'Muda para o perfil “Noite” todos os dias, em um horário fixo.',
    },
    taskDone: {
      title: 'Tarefa importante concluída',
      description: 'Um aviso amigável quando uma tarefa de prioridade alta é concluída.',
      notice: 'Pronto: {title}',
    },
  },
};

export const tAuto = defineBundle(de, { en, es, fr, 'pt-BR': ptBR });
