import { defineBundle } from '@/core/i18n/bundle';

/**
 * Texts of the automation templates (`core/automation/templates.ts`): name and one-line description
 * for the settings, plus the wording of the hints, reminders and entries a rule leaves. `{field}`
 * is replaced by the engine from the event (see `core/automation/template.ts`). Calm wording: no
 * guilt, no counters, no exclamation marks (docs/design/FOCUS-WORDING.md).
 */
const de = {
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
