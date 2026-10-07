import type { Strings } from '@/strings';

export const sync: Strings['sync'] = {
  defaultDeviceName: 'Appareil',
  title: 'Synchronisation',
  intro:
    'Facultatif : synchronisez vos données via votre propre serveur de synchronisation (en réseau local ou via Tailscale). Sans serveur, tout reste sur cet appareil.',
  serverUrl: 'Adresse du serveur',
  serverUrlHint: 'p. ex. https://mon-pc.tailnet.ts.net',
  token: 'Token d’accès',
  deviceName: 'Nom de l’appareil',
  deviceNameHint: 'C’est ainsi que cet appareil apparaît dans la liste des appareils.',
  deviceNames: {
    desktop: 'App Windows',
    android: 'Téléphone Android',
    web: 'Navigateur',
  } as Record<string, string>,
  encrypt: 'Chiffrement de bout en bout',
  encryptHint:
    'Les valeurs sont chiffrées sur l’appareil, le serveur ne voit que du texte chiffré. Possible uniquement sur un serveur vide.',
  plainWarning:
    'Sans chiffrement de bout en bout, vos données sont stockées en clair sur le serveur. Activez-le si le serveur n’est pas qu’à vous ou si son stockage n’est pas chiffré.',
  passphrase: 'Phrase secrète',
  passphraseHint:
    'Au moins 8 caractères. Sans la phrase secrète, les données ne peuvent pas être récupérées.',
  passphraseJoinHint: 'Nécessaire uniquement si le serveur est chiffré.',
  connect: 'Connecter',
  connecting: 'Connexion…',
  connected: (host: string) => `Connecté à ${host}`,
  encryptedBadge: 'Chiffré',
  plainBadge: 'Non chiffré',
  lastSync: 'Dernière synchronisation',
  never: 'pas encore',
  pending: (n: number) =>
    n === 0
      ? 'Tout est envoyé'
      : n === 1
        ? '1 modification en attente'
        : `${n} modifications en attente`,
  syncNow: 'Synchroniser maintenant',
  disconnect: 'Déconnecter',
  signOut: 'Déconnecter cet appareil',
  signOutHint:
    'Bloque le token de cet appareil sur le serveur et le déconnecte. Vos données locales sont conservées.',
  disconnectHint: 'Vos données locales sont conservées ; le serveur n’est pas modifié.',
  state: { off: 'Désactivée', idle: 'Synchronisé', syncing: 'Synchronisation…', error: 'Erreur' },
  badge: (state: string) => `Synchronisation : ${state}`,
  detailsTitle: 'État',
  lastResult: (pulled: number, pushed: number) =>
    `Dernière fois : ${pulled} reçu(s), ${pushed} envoyé(s)`,
  rejected: (n: number) =>
    n <= 1
      ? `${n} modification reçue n’a pas pu être déchiffrée et a été ignorée.`
      : `${n} modifications reçues n’ont pas pu être déchiffrées et ont été ignorées.`,
  failuresInRow: (n: number) => (n <= 1 ? `${n} échec` : `${n} échecs d’affilée`),
  serverSize: 'Données sur le serveur',
  serverSizeValue: (records: number, kb: number) =>
    `${records} ${records <= 1 ? 'entrée' : 'entrées'}, ${kb < 1024 ? `${kb} Ko` : `${(kb / 1024).toFixed(1)} Mo`}`,
  devicesTitle: 'Appareils',
  devicesIntro:
    'Tous les appareils qui se synchronisent avec ce serveur. Un appareil bloqué ne peut plus se synchroniser ; les données qu’il a déjà envoyées sont conservées.',
  devicesUnsupported:
    'Ce serveur ne gère pas les appareils (ancienne version). Mettez le serveur à jour pour pouvoir bloquer des appareils.',
  deviceThis: 'cet appareil',
  deviceLastSeen: (when: string) => `Dernière activité : ${when}`,
  deviceNever: 'jamais',
  deviceRevoked: (when: string) => `Bloqué le ${when}`,
  deviceStale: (days: number) =>
    `Inactif depuis ${days} jours. Bloquez-le si vous ne l’utilisez plus : les très anciens appareils peuvent faire revenir des entrées supprimées.`,
  deviceLock: 'Bloquer',
  deviceLockTitle: (name: string) => `Bloquer « ${name} » ?`,
  deviceLockText:
    'L’appareil ne pourra plus se synchroniser. Les données déjà envoyées restent sur le serveur. Pour se reconnecter, l’appareil aura besoin du token du serveur.',
  deviceLocked: 'Appareil bloqué.',
  deviceLockFailed: 'L’appareil n’a pas pu être bloqué.',
  deviceId: (id: string) => `ID de l’appareil : ${id}`,
  rotateToken: 'Renouveler le token de cet appareil',
  rotated: 'Token renouvelé.',
  conflictsTitle: 'Conflits',
  conflictsIntro:
    'Si deux appareils ont modifié le même champ en même temps, la modification la plus récente l’emporte. La valeur écrasée apparaît ici et peut être restaurée.',
  conflictsNone: 'Aucun conflit en attente.',
  conflictKept: {
    remote: 'La modification d’un autre appareil a écrasé la vôtre.',
    local: 'Votre modification a écrasé celle d’un autre appareil.',
  } as Record<string, string>,
  conflictLost: 'Écrasé',
  conflictNow: 'Valeur actuelle',
  conflictEmpty: '(vide)',
  conflictDeleted: '(supprimé)',
  conflictTooLarge: 'Valeur trop grande pour être conservée',
  conflictRestore: 'Restaurer',
  conflictDismiss: 'Ignorer',
  conflictDismissAll: 'Tout ignorer',
  conflictRestored: 'Valeur restaurée.',
  conflictOutcome: {
    'already-current': 'Cette valeur est déjà en vigueur.',
    'record-gone': 'L’entrée n’existe plus.',
    'not-restorable': 'Cette valeur ne peut pas être restaurée.',
  } as Record<string, string>,
  errors: {
    network: 'Serveur injoignable.',
    revoked:
      'Cet appareil a été bloqué. Déconnectez-le puis reconnectez-le si vous souhaitez l’autoriser à nouveau.',
    'rate-limited': 'Trop de requêtes ou d’échecs – nouvel essai automatique.',
    unauthorized: 'Le serveur a refusé le token.',
    server: 'Le serveur a signalé une erreur.',
    decrypt: 'Échec du déchiffrement – la phrase secrète est-elle correcte ?',
    'no-key':
      'Les données du serveur sont chiffrées. Veuillez vous déconnecter et vous reconnecter avec la phrase secrète.',
    unsupported: 'Non pris en charge.',
    unknown: 'Erreur inconnue.',
  } as Record<string, string>,
  failures: {
    'invalid-url': 'Veuillez saisir une adresse valide avec http:// ou https://.',
    unreachable:
      'Serveur injoignable. Si l’app est ouverte en HTTPS, le serveur doit aussi être joignable en HTTPS (p. ex. avec « tailscale serve »).',
    unauthorized: 'Le token a été refusé.',
    'passphrase-required': 'Ce serveur est chiffré. Veuillez saisir la phrase secrète.',
    'passphrase-too-short': 'La phrase secrète doit contenir au moins 8 caractères.',
    'wrong-passphrase': 'Phrase secrète incorrecte.',
    'server-has-plain-data':
      'Le serveur contient déjà des données non chiffrées. Le chiffrement n’est possible que sur un serveur vide.',
    revoked: 'Cet appareil est bloqué sur le serveur.',
    'rate-limited': 'Trop d’échecs. Veuillez réessayer dans une minute.',
    'vault-outdated':
      'Le serveur utilise encore l’ancien format de chiffrement. Réinitialisez le serveur pour le reconstruire.',
    'server-error': 'Le serveur a signalé une erreur.',
  } as Record<string, string>,
  resetServer: 'Réinitialiser le serveur et le reconstruire chiffré',
  resetTitle: 'Réinitialiser le serveur ?',
  resetText:
    'Toutes les données du serveur seront supprimées. Vos données locales sont conservées et renvoyées ; les autres appareils renverront aussi leurs données à la prochaine synchronisation.',
  resetConfirm: 'Réinitialiser',
};
