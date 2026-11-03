import { defineBundle } from '@/core/i18n/bundle';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Texts of "Aus anderer App importieren": detection, report and reasons for skipped entries. */
export const tImp = defineBundle(
  {
    title: 'Aus anderer App importieren',
    intro:
      'Wähle die Datei(en) deines Exports, auch ZIP. Nemo erkennt, aus welcher App sie stammen, und zeigt vor dem Übernehmen eine Vorschau. Nichts verlässt dieses Gerät.',
    choose: 'Dateien wählen',
    reading: (done: number, total: number) => `Dateien werden gelesen … ${done} von ${total}`,
    cancel: 'Abbrechen',
    parsing: 'Daten werden gelesen …',
    detected: (apps: string) => `Erkannt: ${apps}`,
    unknown: 'Ich erkenne nicht, aus welcher App diese Dateien stammen. Wähle die Quelle selbst:',
    manual: 'Andere Quelle wählen',
    step: (i: number, n: number) => `Teil ${i} von ${n}`,
    nothing: 'In den Dateien wurde nichts Lesbares gefunden.',
    vaultHint:
      'Passwörter importierst du im Tresor, nach Eingabe des Master-Passworts. Dort öffnet sich der CSV-Import.',
    openVault: 'Zum Tresor',
    paletteCommand: 'Aus anderer App importieren …',
    sources: {
      enex: 'Evernote (.enex)',
      obsidian: 'Obsidian oder Markdown-Ordner',
      'outlook-tasks': 'Microsoft To Do (Outlook-CSV)',
      todoist: 'Todoist (CSV)',
      'google-tasks': 'Google Aufgaben',
      'google-keep': 'Google Keep',
      'google-calendar': 'Google Kalender (.ics)',
      bank: 'Kontoumsätze (CSV, OFX, CAMT)',
      'vault-csv': 'Passwort-Manager (Bitwarden, KeePass, 1Password)',
    },
    reasons: {
      trashed: (n: number) =>
        n1(
          n,
          '1 Eintrag aus Papierkorb oder Archiv wurde ausgelassen.',
          `${n} Einträge aus Papierkorb oder Archiv wurden ausgelassen.`,
        ),
      empty: (n: number) =>
        n1(n, '1 leerer Eintrag wurde übersprungen.', `${n} leere Einträge wurden übersprungen.`),
      unreadable: (n: number) =>
        n1(
          n,
          '1 Datei ist nicht lesbar oder aus einer anderen App und wurde übersprungen.',
          `${n} Dateien sind nicht lesbar oder aus einer anderen App und wurden übersprungen.`,
        ),
      attachment: (n: number) =>
        n1(
          n,
          '1 Anhang (Bild oder Datei) wurde nicht übernommen: Notizen speichern nur Text.',
          `${n} Anhänge (Bilder oder Dateien) wurden nicht übernommen: Notizen speichern nur Text.`,
        ),
      unsupported: (n: number) =>
        n1(n, '1 Eintrag wird nicht unterstützt.', `${n} Einträge werden nicht unterstützt.`),
      tooMany: (n: number) =>
        `Die Vorschau zeigt höchstens ${n} Einträge; der Rest wurde ausgelassen.`,
      done: (n: number) =>
        n1(
          n,
          '1 erledigter Eintrag wurde ausgelassen.',
          `${n} erledigte Einträge wurden ausgelassen.`,
        ),
    },
    report: {
      title: 'Bericht',
      imported: (n: number) => n1(n, '1 Eintrag übernommen.', `${n} Einträge übernommen.`),
      duplicates: (n: number) => n1(n, '1 war schon vorhanden.', `${n} waren schon vorhanden.`),
      invalid: (n: number) =>
        n1(
          n,
          '1 passte nicht ins Format und wurde nicht gespeichert.',
          `${n} passten nicht ins Format und wurden nicht gespeichert.`,
        ),
      deselected: (n: number) => n1(n, '1 hast du abgewählt.', `${n} hast du abgewählt.`),
    },
    newNotebook: 'Neues Notizbuch',
  },
  {
    en: {
      title: 'Import from another app',
      intro:
        'Choose the file(s) of your export, ZIP files too. Nemo recognises which app they come from and shows a preview before anything is added. Nothing leaves this device.',
      choose: 'Choose files',
      reading: (done: number, total: number) => `Reading files … ${done} of ${total}`,
      cancel: 'Cancel',
      parsing: 'Reading data …',
      detected: (apps: string) => `Recognised: ${apps}`,
      unknown: 'I can’t tell which app these files come from. Choose the source yourself:',
      manual: 'Choose another source',
      step: (i: number, n: number) => `Part ${i} of ${n}`,
      nothing: 'Nothing readable was found in the files.',
      vaultHint:
        'Passwords are imported in the vault, after you enter the master password. The CSV import opens there.',
      openVault: 'Go to the vault',
      paletteCommand: 'Import from another app …',
      sources: {
        enex: 'Evernote (.enex)',
        obsidian: 'Obsidian or Markdown folder',
        'outlook-tasks': 'Microsoft To Do (Outlook CSV)',
        todoist: 'Todoist (CSV)',
        'google-tasks': 'Google Tasks',
        'google-keep': 'Google Keep',
        'google-calendar': 'Google Calendar (.ics)',
        bank: 'Bank transactions (CSV, OFX, CAMT)',
        'vault-csv': 'Password manager (Bitwarden, KeePass, 1Password)',
      },
      reasons: {
        trashed: (n: number) =>
          n1(
            n,
            '1 entry from the trash or archive was left out.',
            `${n} entries from the trash or archive were left out.`,
          ),
        empty: (n: number) =>
          n1(n, '1 empty entry was skipped.', `${n} empty entries were skipped.`),
        unreadable: (n: number) =>
          n1(
            n,
            '1 file is unreadable or from another app and was skipped.',
            `${n} files are unreadable or from another app and were skipped.`,
          ),
        attachment: (n: number) =>
          n1(
            n,
            '1 attachment (image or file) was not imported: notes store text only.',
            `${n} attachments (images or files) were not imported: notes store text only.`,
          ),
        unsupported: (n: number) =>
          n1(n, '1 entry is not supported.', `${n} entries are not supported.`),
        tooMany: (n: number) => `The preview shows at most ${n} entries; the rest was left out.`,
        done: (n: number) =>
          n1(n, '1 completed entry was left out.', `${n} completed entries were left out.`),
      },
      report: {
        title: 'Report',
        imported: (n: number) => n1(n, '1 entry imported.', `${n} entries imported.`),
        duplicates: (n: number) => n1(n, '1 was already there.', `${n} were already there.`),
        invalid: (n: number) =>
          n1(
            n,
            '1 did not fit the format and was not saved.',
            `${n} did not fit the format and were not saved.`,
          ),
        deselected: (n: number) => n1(n, 'You unticked 1.', `You unticked ${n}.`),
      },
      newNotebook: 'New notebook',
    },
    es: {
      title: 'Importar desde otra app',
      intro:
        'Elige el archivo o los archivos de tu exportación, también ZIP. Nemo reconoce de qué app vienen y muestra una vista previa antes de añadir nada. Nada sale de este dispositivo.',
      choose: 'Elegir archivos',
      reading: (done: number, total: number) => `Leyendo archivos … ${done} de ${total}`,
      cancel: 'Cancelar',
      parsing: 'Leyendo datos …',
      detected: (apps: string) => `Reconocido: ${apps}`,
      unknown: 'No reconozco de qué app son estos archivos. Elige tú el origen:',
      manual: 'Elegir otro origen',
      step: (i: number, n: number) => `Parte ${i} de ${n}`,
      nothing: 'No se encontró nada legible en los archivos.',
      vaultHint:
        'Las contraseñas se importan en la bóveda, tras introducir la contraseña maestra. Allí se abre la importación de CSV.',
      openVault: 'Ir a la bóveda',
      paletteCommand: 'Importar desde otra app …',
      sources: {
        enex: 'Evernote (.enex)',
        obsidian: 'Obsidian o carpeta de Markdown',
        'outlook-tasks': 'Microsoft To Do (CSV de Outlook)',
        todoist: 'Todoist (CSV)',
        'google-tasks': 'Google Tasks',
        'google-keep': 'Google Keep',
        'google-calendar': 'Google Calendar (.ics)',
        bank: 'Movimientos bancarios (CSV, OFX, CAMT)',
        'vault-csv': 'Gestor de contraseñas (Bitwarden, KeePass, 1Password)',
      },
      reasons: {
        trashed: (n: number) =>
          n1(
            n,
            'Se omitió 1 entrada de la papelera o del archivo.',
            `Se omitieron ${n} entradas de la papelera o del archivo.`,
          ),
        empty: (n: number) =>
          n1(n, 'Se omitió 1 entrada vacía.', `Se omitieron ${n} entradas vacías.`),
        unreadable: (n: number) =>
          n1(
            n,
            'Se omitió 1 archivo ilegible o de otra app.',
            `Se omitieron ${n} archivos ilegibles o de otra app.`,
          ),
        attachment: (n: number) =>
          n1(
            n,
            'No se importó 1 adjunto (imagen o archivo): las notas solo guardan texto.',
            `No se importaron ${n} adjuntos (imágenes o archivos): las notas solo guardan texto.`,
          ),
        unsupported: (n: number) =>
          n1(n, '1 entrada no es compatible.', `${n} entradas no son compatibles.`),
        tooMany: (n: number) =>
          `La vista previa muestra como máximo ${n} entradas; el resto se omitió.`,
        done: (n: number) =>
          n1(n, 'Se omitió 1 entrada completada.', `Se omitieron ${n} entradas completadas.`),
      },
      report: {
        title: 'Informe',
        imported: (n: number) => n1(n, '1 entrada importada.', `${n} entradas importadas.`),
        duplicates: (n: number) => n1(n, '1 ya existía.', `${n} ya existían.`),
        invalid: (n: number) =>
          n1(
            n,
            '1 no encajaba en el formato y no se guardó.',
            `${n} no encajaban en el formato y no se guardaron.`,
          ),
        deselected: (n: number) => n1(n, 'Desmarcaste 1.', `Desmarcaste ${n}.`),
      },
      newNotebook: 'Cuaderno nuevo',
    },
    fr: {
      title: 'Importer depuis une autre appli',
      intro:
        'Choisissez le ou les fichiers de votre export, ZIP compris. Nemo reconnaît de quelle appli ils viennent et affiche un aperçu avant d’ajouter quoi que ce soit. Rien ne quitte cet appareil.',
      choose: 'Choisir des fichiers',
      reading: (done: number, total: number) => `Lecture des fichiers … ${done} sur ${total}`,
      cancel: 'Annuler',
      parsing: 'Lecture des données …',
      detected: (apps: string) => `Reconnu : ${apps}`,
      unknown: 'Je ne reconnais pas l’appli d’origine de ces fichiers. Choisissez la source :',
      manual: 'Choisir une autre source',
      step: (i: number, n: number) => `Partie ${i} sur ${n}`,
      nothing: 'Rien de lisible n’a été trouvé dans les fichiers.',
      vaultHint:
        'Les mots de passe s’importent dans le coffre, après saisie du mot de passe maître. L’import CSV s’y ouvre.',
      openVault: 'Aller au coffre',
      paletteCommand: 'Importer depuis une autre appli …',
      sources: {
        enex: 'Evernote (.enex)',
        obsidian: 'Obsidian ou dossier Markdown',
        'outlook-tasks': 'Microsoft To Do (CSV Outlook)',
        todoist: 'Todoist (CSV)',
        'google-tasks': 'Google Tasks',
        'google-keep': 'Google Keep',
        'google-calendar': 'Google Agenda (.ics)',
        bank: 'Opérations bancaires (CSV, OFX, CAMT)',
        'vault-csv': 'Gestionnaire de mots de passe (Bitwarden, KeePass, 1Password)',
      },
      reasons: {
        trashed: (n: number) =>
          n1(
            n,
            '1 entrée de la corbeille ou des archives a été ignorée.',
            `${n} entrées de la corbeille ou des archives ont été ignorées.`,
          ),
        empty: (n: number) =>
          n1(n, '1 entrée vide a été ignorée.', `${n} entrées vides ont été ignorées.`),
        unreadable: (n: number) =>
          n1(
            n,
            '1 fichier illisible ou d’une autre appli a été ignoré.',
            `${n} fichiers illisibles ou d’une autre appli ont été ignorés.`,
          ),
        attachment: (n: number) =>
          n1(
            n,
            '1 pièce jointe (image ou fichier) n’a pas été importée : les notes ne gardent que du texte.',
            `${n} pièces jointes (images ou fichiers) n’ont pas été importées : les notes ne gardent que du texte.`,
          ),
        unsupported: (n: number) =>
          n1(
            n,
            '1 entrée n’est pas prise en charge.',
            `${n} entrées ne sont pas prises en charge.`,
          ),
        tooMany: (n: number) => `L’aperçu montre au plus ${n} entrées ; le reste a été ignoré.`,
        done: (n: number) =>
          n1(n, '1 entrée terminée a été ignorée.', `${n} entrées terminées ont été ignorées.`),
      },
      report: {
        title: 'Rapport',
        imported: (n: number) => n1(n, '1 entrée importée.', `${n} entrées importées.`),
        duplicates: (n: number) => n1(n, '1 existait déjà.', `${n} existaient déjà.`),
        invalid: (n: number) =>
          n1(
            n,
            '1 ne correspondait pas au format et n’a pas été enregistrée.',
            `${n} ne correspondaient pas au format et n’ont pas été enregistrées.`,
          ),
        deselected: (n: number) => n1(n, 'Vous en avez décoché 1.', `Vous en avez décoché ${n}.`),
      },
      newNotebook: 'Nouveau carnet',
    },
    'pt-BR': {
      title: 'Importar de outro app',
      intro:
        'Escolha o arquivo ou os arquivos da sua exportação, inclusive ZIP. O Nemo reconhece de qual app vêm e mostra uma prévia antes de adicionar qualquer coisa. Nada sai deste dispositivo.',
      choose: 'Escolher arquivos',
      reading: (done: number, total: number) => `Lendo arquivos … ${done} de ${total}`,
      cancel: 'Cancelar',
      parsing: 'Lendo dados …',
      detected: (apps: string) => `Reconhecido: ${apps}`,
      unknown: 'Não reconheço de qual app são estes arquivos. Escolha a origem:',
      manual: 'Escolher outra origem',
      step: (i: number, n: number) => `Parte ${i} de ${n}`,
      nothing: 'Nada legível foi encontrado nos arquivos.',
      vaultHint:
        'As senhas são importadas no cofre, depois de digitar a senha mestra. A importação de CSV abre lá.',
      openVault: 'Ir ao cofre',
      paletteCommand: 'Importar de outro app …',
      sources: {
        enex: 'Evernote (.enex)',
        obsidian: 'Obsidian ou pasta de Markdown',
        'outlook-tasks': 'Microsoft To Do (CSV do Outlook)',
        todoist: 'Todoist (CSV)',
        'google-tasks': 'Google Tasks',
        'google-keep': 'Google Keep',
        'google-calendar': 'Google Agenda (.ics)',
        bank: 'Lançamentos bancários (CSV, OFX, CAMT)',
        'vault-csv': 'Gerenciador de senhas (Bitwarden, KeePass, 1Password)',
      },
      reasons: {
        trashed: (n: number) =>
          n1(
            n,
            '1 item da lixeira ou do arquivo foi deixado de fora.',
            `${n} itens da lixeira ou do arquivo foram deixados de fora.`,
          ),
        empty: (n: number) =>
          n1(n, '1 item vazio foi ignorado.', `${n} itens vazios foram ignorados.`),
        unreadable: (n: number) =>
          n1(
            n,
            '1 arquivo ilegível ou de outro app foi ignorado.',
            `${n} arquivos ilegíveis ou de outro app foram ignorados.`,
          ),
        attachment: (n: number) =>
          n1(
            n,
            '1 anexo (imagem ou arquivo) não foi importado: as notas guardam só texto.',
            `${n} anexos (imagens ou arquivos) não foram importados: as notas guardam só texto.`,
          ),
        unsupported: (n: number) =>
          n1(n, '1 item não é compatível.', `${n} itens não são compatíveis.`),
        tooMany: (n: number) =>
          `A prévia mostra no máximo ${n} itens; o restante foi deixado de fora.`,
        done: (n: number) =>
          n1(
            n,
            '1 item concluído foi deixado de fora.',
            `${n} itens concluídos foram deixados de fora.`,
          ),
      },
      report: {
        title: 'Relatório',
        imported: (n: number) => n1(n, '1 item importado.', `${n} itens importados.`),
        duplicates: (n: number) => n1(n, '1 já existia.', `${n} já existiam.`),
        invalid: (n: number) =>
          n1(
            n,
            '1 não cabia no formato e não foi salvo.',
            `${n} não cabiam no formato e não foram salvos.`,
          ),
        deselected: (n: number) => n1(n, 'Você desmarcou 1.', `Você desmarcou ${n}.`),
      },
      newNotebook: 'Novo caderno',
    },
  },
);
