import type { Strings } from '@/strings';

export const supporter: Strings['supporter'] = {
  tier: { kaffee: 'Café', kuchen: 'Gâteau', developer: 'Développeur' },
  section: {
    title: 'Soutien',
    keywords: ['don', 'soutenir', 'soutien', 'café', 'merci', 'code', 'Ko-fi', 'supporter'],
    intro:
      'Nemo est gratuit et le restera : toutes les fonctions sont ouvertes à tous. Si l’app vous plaît, vous pouvez contribuer librement, chaque montant aide. En guise de petit merci, vous recevez des extras purement cosmétiques : un badge « Merci » et des thèmes de couleurs supplémentaires.',
    donate: 'Soutenir librement',
    donateHint:
      'Ouvre la page de paiement dans le navigateur. Le paiement se fait uniquement là-bas, Nemo ne traite aucune donnée de paiement.',
    codeLabel: 'Code de soutien',
    codeHint:
      'Vous recevez le code automatiquement par e-mail après votre don. Collez-le ici, il est vérifié uniquement sur cet appareil.',
    codePlaceholder: 'NEMO1-…',
    paste: 'Coller',
    pasteFailed: 'Impossible de coller. Collez le code directement dans le champ.',
    save: 'Appliquer le code',
    invalid: 'Ce code ne correspond pas. Vérifiez qu’il a été copié en entier.',
    accepted: 'Merci ! Le code a été appliqué.',
    statusTitle: 'Votre statut',
    tierLabel: 'Niveau',
    nameLabel: 'Nom',
    issuedLabel: 'Émis le',
    notSupporter: 'Aucun code saisi. C’est tout à fait normal, il ne vous manque rien.',
    remove: 'Retirer le code',
    removed: 'Code retiré. Vous pouvez le saisir à nouveau à tout moment.',
    unrecognised:
      'Un code enregistré n’est pas reconnu par cette version de l’app. Mettez l’app à jour ou saisissez à nouveau le code.',
    sidebarBadge: 'Badge « Merci » dans la barre latérale',
    sidebarBadgeHint: 'Affiche discrètement le niveau sous le logo.',
    noMail: 'Rien reçu ? Regardez aussi dans le dossier spam.',
    resend: 'Renvoyer le code',
    contact: 'Nous contacter',
    linkOpen: 'Ouvrir',
  },
  aboutRow: {
    label: 'Soutenir Nemo',
    description: 'Librement, avec des extras cosmétiques en guise de merci.',
    open: 'En savoir plus',
  },
  badge: {
    thanks: 'Merci',
    thanksName: (name: string) => `Merci, ${name}`,
  },
  palette: {
    label: 'Thème de couleurs',
    hintSupporter: 'Purement visuel, retour au thème standard à tout moment.',
    hintLocked:
      'Les thèmes de couleurs supplémentaires sont un petit merci pour les soutiens. Vous pouvez quand même les essayer : un clic affiche le thème pendant 30 secondes.',
    standard: 'Standard',
    names: {
      korallenriff: 'Récif corallien',
      tiefsee: 'Grands fonds',
      sand: 'Sable',
      nordlicht: 'Aurore boréale',
      monochrom: 'Monochrome',
    },
    choose: (name: string) => `Choisir le thème ${name}`,
    tryOut: (name: string) => `Voir le thème ${name} pendant 30 secondes`,
    locked: 'Pour les soutiens',
    previewing: (name: string) => `Aperçu : ${name}`,
    previewEnd: 'Terminer l’aperçu',
    accentFollows: 'Le thème de couleurs définit la couleur d’accent.',
  },
  logo: {
    label: 'Logo aux couleurs du thème',
    hint: 'Le poisson prend la couleur d’accent.',
    hintLocked: 'Pour les soutiens.',
  },
};
