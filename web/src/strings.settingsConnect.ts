import { defineBundle } from '@/core/i18n/bundle';

/**
 * Titles of the step cards in Sync and Backup (identity v3). Next to the feature instead of in `strings.ts`
 * (a hotspot); the texts of the forms themselves stay in `t.sync` / `t.backup`.
 */
export const tSettingsConnect = defineBundle(
  {
    sync: {
      off: 'Nicht verbunden',
      offLine: 'Deine Daten bleiben auf diesem Gerät, bis du einen eigenen Server verbindest.',
      stepServer: 'Server',
      stepServerHint: 'Adresse und Zugangsschlüssel deines Sync-Servers.',
      stepDevice: 'Dieses Gerät und Schutz',
      stepDeviceHint: 'Wie das Gerät heißt und wie die Daten unterwegs geschützt sind.',
      facts: 'Stand der Synchronisation',
      factPending: 'Noch zu senden',
      stepConnection: 'Verbindung',
    },
    share: {
      stepOnce: 'Einmal als Datei teilen',
      stepOnceHint: 'Eine Auswahl packen und der anderen Person geben, ohne dauerhafte Verbindung.',
      stepOpenHint: 'Eine erhaltene Datei ansehen und übernehmen.',
    },
    backup: {
      stepSave: 'Sichern',
      stepSaveHint: 'Alle Daten als Datei auf dieses Gerät legen.',
      stepRestore: 'Wiederherstellen',
      stepRestoreHint: 'Eine Sicherung ansehen, prüfen und zurückspielen.',
    },
  },
  {
    en: {
      sync: {
        off: 'Not connected',
        offLine: 'Your data stays on this device until you connect a server of your own.',
        stepServer: 'Server',
        stepServerHint: 'Address and access key of your sync server.',
        stepDevice: 'This device and protection',
        stepDeviceHint: 'What the device is called and how the data is protected in transit.',
        facts: 'State of the sync',
        factPending: 'Still to send',
        stepConnection: 'Connection',
      },
      share: {
        stepOnce: 'Share once as a file',
        stepOnceHint: 'Pack a selection and hand it over, without a standing connection.',
        stepOpenHint: 'Look at a file you received and take it over.',
      },
      backup: {
        stepSave: 'Save',
        stepSaveHint: 'Put all your data into a file on this device.',
        stepRestore: 'Restore',
        stepRestoreHint: 'Look at a backup, check it and play it back.',
      },
    },
    es: {
      sync: {
        off: 'Sin conexión',
        offLine: 'Tus datos se quedan en este dispositivo hasta que conectes un servidor propio.',
        stepServer: 'Servidor',
        stepServerHint: 'Dirección y clave de acceso de tu servidor de sincronización.',
        stepDevice: 'Este dispositivo y protección',
        stepDeviceHint: 'Cómo se llama el dispositivo y cómo se protegen los datos en el camino.',
        facts: 'Estado de la sincronización',
        factPending: 'Por enviar',
        stepConnection: 'Conexión',
      },
      share: {
        stepOnce: 'Compartir una vez como archivo',
        stepOnceHint: 'Prepara una selección y entrégala, sin conexión permanente.',
        stepOpenHint: 'Mira un archivo recibido y acéptalo.',
      },
      backup: {
        stepSave: 'Guardar',
        stepSaveHint: 'Guarda todos tus datos en un archivo en este dispositivo.',
        stepRestore: 'Restaurar',
        stepRestoreHint: 'Mira una copia, compruébala y vuelve a cargarla.',
      },
    },
    fr: {
      sync: {
        off: 'Non connecté',
        offLine:
          'Tes données restent sur cet appareil tant que tu ne connectes pas ton propre serveur.',
        stepServer: 'Serveur',
        stepServerHint: 'Adresse et clé d’accès de ton serveur de synchronisation.',
        stepDevice: 'Cet appareil et la protection',
        stepDeviceHint: 'Le nom de l’appareil et la protection des données en transit.',
        facts: 'État de la synchronisation',
        factPending: 'À envoyer',
        stepConnection: 'Connexion',
      },
      share: {
        stepOnce: 'Partager une fois en fichier',
        stepOnceHint: 'Prépare une sélection et remets-la, sans connexion permanente.',
        stepOpenHint: 'Regarde un fichier reçu et reprends-le.',
      },
      backup: {
        stepSave: 'Sauvegarder',
        stepSaveHint: 'Mets toutes tes données dans un fichier sur cet appareil.',
        stepRestore: 'Restaurer',
        stepRestoreHint: 'Regarde une sauvegarde, vérifie-la et remets-la en place.',
      },
    },
    'pt-BR': {
      sync: {
        off: 'Não conectado',
        offLine: 'Seus dados ficam neste dispositivo até você conectar um servidor próprio.',
        stepServer: 'Servidor',
        stepServerHint: 'Endereço e chave de acesso do seu servidor de sincronização.',
        stepDevice: 'Este dispositivo e proteção',
        stepDeviceHint: 'Como o dispositivo se chama e como os dados são protegidos no caminho.',
        facts: 'Estado da sincronização',
        factPending: 'A enviar',
        stepConnection: 'Conexão',
      },
      share: {
        stepOnce: 'Compartilhar uma vez como arquivo',
        stepOnceHint: 'Monte uma seleção e entregue, sem conexão permanente.',
        stepOpenHint: 'Veja um arquivo recebido e aceite.',
      },
      backup: {
        stepSave: 'Salvar',
        stepSaveHint: 'Coloque todos os seus dados em um arquivo neste dispositivo.',
        stepRestore: 'Restaurar',
        stepRestoreHint: 'Veja um backup, confira e restaure.',
      },
    },
  },
);
