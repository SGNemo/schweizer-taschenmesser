import type { Strings } from '@/strings';

export const onboarding: Strings['onboarding'] = {
  button: 'Configurer les données de départ',
  title: (module: string) => `Données de départ : ${module}`,
  chooseIntro:
    'D’où doivent venir les premières entrées ? Rien n’est enregistré avant que vous ayez confirmé l’aperçu.',
  skip: 'Passer',
  skipHint: 'Vous retrouverez l’assistant plus tard dans les paramètres du module.',
  back: 'Retour',
  preview: 'Afficher l’aperçu',
  parsing: 'Lecture…',
  chooseFile: 'Choisir un fichier…',
  fileChosen: (name: string) => `Fichier : ${name}`,
  textLabel: 'Une ligne = une entrée',
  pickTemplates: 'Choisir des suggestions',
  noInput: 'Veuillez saisir quelque chose.',
  nothingFound: 'Aucune entrée n’a été reconnue.',
  fileTooLarge: 'Le fichier est trop volumineux (10 Mo au maximum).',
  readError: 'Impossible de lire le fichier.',
  previewTitle: 'Aperçu',
  previewIntro: 'Voici ce qui serait enregistré. Décochez les entrées dont vous ne voulez pas.',
  found: (n: number) => (n <= 1 ? `${n} entrée reconnue` : `${n} entrées reconnues`),
  selectAll: 'Tout sélectionner',
  selectNone: 'Tout désélectionner',
  duplicate: 'Déjà présent',
  change: 'Modification',
  unchanged: 'Aucune modification',
  invalid: 'Non importable',
  importN: (n: number) => (n <= 1 ? `Importer ${n} entrée` : `Importer ${n} entrées`),
  importing: 'Enregistrement…',
  imported: (n: number) =>
    n <= 1 ? `${n} entrée a été importée.` : `${n} entrées ont été importées.`,
  undo: 'Annuler l’import',
  undone: (removed: number, kept: number) =>
    `${removed} ${removed <= 1 ? 'entrée retirée' : 'entrées retirées'}.` +
    (kept > 0
      ? kept <= 1
        ? ` ${kept} a été modifiée entre-temps et reste conservée.`
        : ` ${kept} ont été modifiées entre-temps et restent conservées.`
      : ''),
  close: 'Fermer',
  recent: 'Importés récemment',
  recentEntry: (source: string, n: number, date: string) =>
    `${source} · ${n} ${n <= 1 ? 'entrée' : 'entrées'} · ${date}`,
  recentUndone: 'annulé',
  errors: {
    'unknown-collection': 'Cet import ne correspond pas à ce module.',
    'nothing-selected': 'Rien n’est sélectionné.',
    fallback: 'Cela n’a pas fonctionné.',
  } as Record<string, string>,
  add: 'Ajouter',
  required: 'Veuillez remplir ce champ.',

  mail: {
    hint: 'Uniquement avec un compte Google connecté (Paramètres → Connexions). Les suggestions viennent de l’expéditeur, de l’objet, de la date et de l’aperçu ; vous confirmez chacune d’elles.',
    invoices: 'Repérer les factures dans les e-mails',
    subscriptions: 'Repérer les abonnements dans les e-mails',
    contracts: 'Repérer les contrats dans les e-mails',
    calendar: 'Repérer les événements et billets dans les e-mails',
    source: (url: string) => `Repéré dans un e-mail : ${url}`,
    dueUnclear: 'Échéance non reconnue – à vérifier',
    startUnclear: 'Date de prélèvement estimée – à vérifier',
    noAmount: (n: number) =>
      n <= 1
        ? `${n} facture sans montant reconnaissable a été ignorée.`
        : `${n} factures sans montant reconnaissable ont été ignorées.`,
    noEnd: 'Fin de contrat non reconnue',
    notice: (days: number) => `Délai de résiliation ${days} ${days <= 1 ? 'jour' : 'jours'}`,
  },
  ics: {
    exdate: (n: number) =>
      n <= 1
        ? `${n} événement récurrent avait des exceptions (jours sautés) ; ces exceptions ne sont pas reprises.`
        : `${n} événements récurrents avaient des exceptions (jours sautés) ; ces exceptions ne sont pas reprises.`,
    rruleUnsupported: (n: number) =>
      n <= 1
        ? `${n} événement a une répétition que cette app ne connaît pas ; il est importé comme événement unique.`
        : `${n} événements ont une répétition que cette app ne connaît pas ; ils sont importés comme événements uniques.`,
    override: (n: number) =>
      n <= 1
        ? `${n} occurrence modifiée d’une série a été ignorée.`
        : `${n} occurrences modifiées d’une série ont été ignorées.`,
    cancelled: (n: number) =>
      n <= 1 ? `${n} événement annulé a été ignoré.` : `${n} événements annulés ont été ignorés.`,
    invalid: (n: number) =>
      n <= 1
        ? `${n} événement sans date valide a été ignoré.`
        : `${n} événements sans date valide ont été ignorés.`,
  },
  lines: (skipped: number) =>
    skipped <= 1
      ? `${skipped} ligne n’a pas été reconnue.`
      : `${skipped} lignes n’ont pas été reconnues.`,
  calendar: {
    ics: 'Fichier de calendrier (.ics)',
    icsHint:
      'Exportez votre calendrier (p. ex. Google Agenda, Outlook, Thunderbird) en fichier .ics et sélectionnez-le ici.',
  },
  todos: {
    text: 'Coller des tâches',
    textHint: 'Collez une liste venant d’une app de notes ou d’un message : une ligne par tâche.',
    placeholder: 'Trier les papiers des impôts\nAppeler le dentiste\nRéparer le vélo',
    list: 'Dans cette liste',
  },
  reminders: {
    textDetail: 'aujourd’hui, 09:00',
    templates: 'Modèles de rappels courants',
    templatesHint:
      'Choisissez ce que l’app doit vous rappeler. Vous pourrez ensuite modifier les heures et les jours.',
    text: 'Coller des rappels',
    textHint:
      'Une ligne par rappel ; il vaut à partir d’aujourd’hui à 09:00 et peut être ajusté ensuite.',
    placeholder: 'Changer les pneus\nAcheter un cadeau pour maman',
    rent: ['Virer le loyer', 'chaque mois le 1er'],
    trash: ['Sortir la poubelle', 'chaque semaine, dimanche 19:00 – ajustez ensuite le jour'],
    insurance: [
      'Comparer l’assurance auto',
      'chaque année le 1er novembre (délai de changement souvent au 30.11.)',
    ],
    energy: ['Vérifier les contrats d’électricité et de gaz', 'chaque année le 1er septembre'],
    tax: ['Rassembler les papiers des impôts', 'chaque année le 1er juin'],
    dentist: ['Prendre rendez-vous chez le dentiste', 'tous les 6 mois'],
    smoke: ['Tester les détecteurs de fumée', 'chaque année le 1er janvier'],
    statements: ['Vérifier les relevés de compte', 'chaque mois le 1er'],
  },
  finance: {
    account: 'Créer un compte avec solde de départ',
    accountHint:
      'Pour un compte supplémentaire. Le compte existant se modifie sous Finances → Comptes.',
    name: 'Nom du compte',
    balance: 'Solde aujourd’hui',
    balanceHint: (sample: string) => `p. ex. ${sample} – avec « - » pour un solde négatif.`,
    badBalance: (sample: string) => `Veuillez saisir un montant comme ${sample}.`,
    bank: 'Importer un relevé de compte (CSV ou CAMT)',
    bankHint:
      'Dans votre banque en ligne, exportez les opérations (p. ex. « CSV-CAMT » ou « CAMT ») et sélectionnez le fichier ici. Le fichier n’est lu que sur cet appareil.',
    bankAccount: 'Enregistrer sur le compte',
    noAccounts: 'Créez d’abord un compte.',
    bankFormat:
      'Le format du fichier n’a pas été reconnu. Attendu : un fichier CSV avec date d’opération et montant, ou un fichier CAMT (XML).',
    bankSkipped: (n: number) =>
      n <= 1
        ? `${n} ligne sans date ou montant valide a été ignorée.`
        : `${n} lignes sans date ou montant valide ont été ignorées.`,
    bankTruncated: (n: number) => `Seules les ${n} premières opérations sont affichées.`,
  },
  invoices: {
    form: 'Saisir une facture à payer',
    payee: 'Émetteur de la facture',
    amount: 'Montant',
    due: 'À échéance le',
    reference: 'Référence (facultatif)',
    badAmount: (sample: string) => `Veuillez saisir un montant comme ${sample}.`,
    badDate: 'Veuillez saisir une date comme 15.03.2026.',
  },
  subscriptions: {
    form: 'Saisir un abonnement',
    name: 'Nom',
    amount: 'Prix par prélèvement',
    rhythm: 'Fréquence',
    monthly: 'mensuel',
    quarterly: 'trimestriel',
    yearly: 'annuel',
    next: 'Prochain prélèvement le',
    notice: 'Délai de résiliation en jours (facultatif)',
    badAmount: (sample: string) => `Veuillez saisir un montant comme ${sample}.`,
    badDate: 'Veuillez saisir une date comme 15.03.2026.',
    badNotice: 'Veuillez saisir un nombre entier.',
    bank: 'Repérer les abonnements dans le relevé de compte',
    bankHint:
      'Choisissez un relevé de compte (CSV ou CAMT, idéalement sur un an). L’app cherche les prélèvements réguliers d’un même montant et les propose comme abonnements. Le fichier n’est lu que sur cet appareil.',
    bankFormat:
      'Le format du fichier n’a pas été reconnu. Attendu : un fichier CSV avec date d’opération et montant, ou un fichier CAMT (XML).',
    bankNone:
      'Aucun prélèvement régulier trouvé. La détection demande au moins trois prélèvements identiques à intervalles similaires.',
    seen: (n: number, last: string) =>
      `${n} ${n <= 1 ? 'prélèvement' : 'prélèvements'}, le dernier le ${last}`,
  },
  bookmarks: {
    html: 'Signets du navigateur (HTML)',
    htmlHint:
      'Exportez les signets de votre navigateur en fichier HTML (Chrome/Edge : gestionnaire de favoris → ⋮ → Exporter les favoris). Les noms de dossiers deviennent des mots-clés.',
    text: 'Coller des liens',
    textHint: 'Une ligne par lien, éventuellement précédé d’un titre.',
    placeholder: 'https://example.org/article\nBelle randonnée https://example.org/randonnee',
  },
  birthdays: {
    text: 'Coller des anniversaires',
    textHint: 'Une ligne par personne : nom et date, avec ou sans année.',
    placeholder: 'Anne Exemple 15.03.1985\nOncle Max 02.11.\n24.12. Mamie',
  },
  lists: {
    text: 'Coller une liste de courses',
    textHint: 'Un article par ligne, les quantités comme « 2 lait » sont reconnues.',
    placeholder: '2 lait\nPain\n500 g farine',
    templates: 'Modèles de listes de bagages',
    templatesHint:
      'Des listes prêtes pour les voyages courants ; vous pourrez les modifier ensuite.',
    packingKind: 'Liste de bagages',
    weekend: {
      name: 'Escapade d’un week-end',
      note: 'Deux nuits, train et bagage à main',
      items: [
        'Brosse à dents',
        'Câble de charge',
        'Veste de pluie',
        'Vêtements de rechange',
        'Billet de train',
        'Écouteurs',
        'Lunettes de soleil',
        'Livre',
      ],
    },
    camping: {
      name: 'Camping',
      note: 'Trois jours au bord du lac',
      items: [
        'Tente',
        'Sac de couchage',
        'Matelas de sol',
        'Réchaud de camping',
        'Lampe frontale',
        'Anti-moustiques',
        'Jerrican d’eau',
        'Couteau de poche',
        'Sacs-poubelle',
        'Crème solaire',
      ],
    },
    beach: {
      name: 'Vacances à la plage',
      note: '',
      items: [
        'Maillot de bain',
        'Serviette de plage',
        'Tongs',
        'Chapeau de soleil',
        'Passeport',
        'Trousse de secours',
      ],
    },
    ski: {
      name: 'Week-end au ski',
      note: '',
      items: [
        'Veste de ski',
        'Gants',
        'Masque de ski',
        'Sous-vêtements thermiques',
        'Forfait de ski',
        'Baume à lèvres',
      ],
    },
  },
};
