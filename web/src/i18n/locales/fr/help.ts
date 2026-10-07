import type { Strings } from '@/strings';

export const help: Strings['help'] = {
  label: 'Aide',
  sync: 'Le serveur de synchronisation est votre propre petit serveur qui accorde les données de plusieurs appareils. Si vous le souhaitez, les données sont chiffrées de bout en bout : le serveur ne voit alors que des valeurs illisibles, et seuls vos appareils connaissent la phrase secrète.',
  aiLocal:
    'Un petit modèle de langage tourne uniquement sur cet appareil et comprend les phrases que les règles fixes ne connaissent pas – sans Token, sans Internet. Il n’est téléchargé qu’avec votre accord (vous voyez d’abord la taille, la source et la somme de contrôle) et vérifie lui-même le téléchargement.',
  aiWrite:
    'Nemo affiche toujours d’abord les entrées reconnues en aperçu ; rien n’est enregistré sans votre confirmation. Ici, vous choisissez si et où l’assistant peut proposer des entrées.',
  aiCloudWrite:
    'Nemo essaie d’abord des règles fixes, puis (s’il est configuré) le modèle local – les deux sont gratuits et ne quittent pas l’appareil. Seulement si cela ne suffit pas et que vous l’autorisez ici, la phrase est envoyée à un fournisseur d’IA avec la date et les noms de champs des modules (jamais vos entrées).',
  aiAskMissing:
    'Activé : s’il manque par ex. la date d’échéance, l’aperçu la demande. Désactivé : ces phrases ne sont pas proposées comme entrée.',
  aiRouter:
    'Plusieurs fournisseurs d’IA sont rangés dans un ordre. L’app interroge le premier disponible ; s’il est surchargé, injoignable ou a atteint sa limite, elle passe au suivant. Seuls votre question et un court schéma sont envoyés, jamais vos données.',
  updateChannel:
    '« Stable » ne propose que des versions finales. « Bêta » montre aussi des préversions, qui apportent les nouveautés plus tôt mais sont moins éprouvées. Avant chaque mise à jour, l’app crée une copie de sauvegarde.',
  vault:
    'Le coffre-fort est chiffré avec votre mot de passe maître, qui n’est enregistré nulle part. Si vous l’oubliez, personne ne peut récupérer les entrées – pas même nous. Conservez-le donc en lieu sûr.',
  startData:
    'L’assistant lit du texte ou des fichiers et affiche d’abord un aperçu. Rien n’est enregistré sans votre confirmation, et chaque import peut être annulé en entier.',
  localApi:
    'L’interface n’écoute que sur cet ordinateur (127.0.0.1) et ne sert à rien sans clé d’accès. Chaque accès n’obtient que les droits que vous cochez. Les imports arrivent d’abord en aperçu dans l’app. Elle ne peut jamais atteindre le coffre-fort (Accounts), les paramètres ni les clés.',
  connectors:
    'Les connexions ne font que lire, elles ne modifient rien chez le service. Les identifiants restent dans le trousseau de cet appareil et ne sont jamais synchronisés ni sauvegardés. Les e-mails sont analysés uniquement sur votre appareil et jamais envoyés à une IA.',
};
