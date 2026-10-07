import { defineBundle } from '@/core/i18n/bundle';

/** Texts of diagnostics, bug report, error cards and recovery in every UI language. */
export const tDiag = defineBundle(
  {
    title: 'Diagnose und Fehler melden',
    export: {
      label: 'Diagnose exportieren',
      description:
        'Zeigt zuerst genau, was in der Datei steht, und speichert sie erst nach deiner Bestätigung. Ohne Einträge, Tresor, Schlüssel, Server-Adressen und Pfade mit Benutzernamen. Die App sendet nichts.',
      previewTitle: 'Diagnose-Datei ansehen',
      previewHint: 'Das ist der komplette Inhalt der Datei. Prüfe ihn, bevor du speicherst.',
      save: 'Speichern',
      cancel: 'Schließen',
      saved: 'Diagnose gespeichert.',
      loading: 'Wird erstellt …',
    },
    report: {
      label: 'Fehler melden',
      description:
        'Öffnet ein vorausgefülltes GitHub-Formular im Browser. Hänge die Diagnose-Datei an, wenn du magst. Die App überträgt selbst nichts.',
      mail: 'Per Mail melden',
      mailSubject: 'Nemo: Fehlerbericht',
      mailIntro: 'Bitte beschreibe kurz das Problem und hänge die Diagnose-Datei an.',
      stepsPlaceholder:
        '1. …\n2. …\n(Bitte die Diagnose-Datei anhängen: Einstellungen → Über Nemo → Diagnose exportieren)',
      paletteCommand: 'Fehler melden',
      keywords: ['Bug', 'Problem', 'Diagnose', 'Fehlerbericht'],
    },
    recovery: {
      title: 'Die Datenbank lässt sich nicht öffnen',
      intro:
        'Nemo konnte die lokalen Daten auf diesem Gerät nicht lesen. Es wurde nichts gelöscht. Bevor etwas verändert wird, sicherst du eine Kopie des defekten Stands.',
      details: 'Technische Angabe',
      repair: 'Datenbank reparieren',
      repairHint: 'Öffnet die Datenbank neu und leert nur Tabellen, die nicht lesbar sind.',
      repairDone: 'Repariert. Die App startet neu.',
      repairFailed:
        'Das ließ sich nicht reparieren. Spiele ein Backup ein oder starte neu mit leerer Datenbank.',
      restore: 'Backup einspielen',
      restoreHint:
        'Wähle eine Backup-Datei. Der defekte Stand wird vorher gesichert und dann ersetzt.',
      passphrase: 'Passwort der Backup-Datei',
      errors: {
        unreadable: 'Das ist keine Nemo-Backup-Datei.',
        'passphrase-required': 'Diese Datei ist verschlüsselt. Gib das Passwort ein.',
        'wrong-passphrase': 'Das Passwort passt nicht.',
        cancelled: 'Abgebrochen. Es wurde nichts verändert.',
        failed: 'Das Einspielen ist fehlgeschlagen.',
      },
      reset: 'Mit leerer Datenbank neu starten',
      resetHint:
        'Zuerst wird eine Kopie des defekten Stands gesichert. Danach beginnt Nemo ohne Daten.',
      resetTitle: 'Mit leerer Datenbank neu starten',
      resetWarning:
        'Alle lokalen Daten auf diesem Gerät werden ersetzt (die Kopie bleibt erhalten). Tippe zur Bestätigung NEU STARTEN.',
      resetPhrase: 'NEU STARTEN',
      resetConfirm: 'Neu starten',
      copyCancelled: 'Ohne gesicherte Kopie wird nichts verändert.',
      report: 'Fehler melden',
    },
    fatal: {
      title: 'Nemo ist auf ein Problem gestoßen',
      body: 'Die App konnte nicht weiterlaufen. Deine Daten wurden nicht verändert.',
      reload: 'Neu laden',
      safeMode: 'Im Sicheren Modus starten',
      safeHint: 'Startet mit allen Modulen aus. Beim nächsten normalen Start ist alles wieder da.',
    },
    safe: {
      banner: 'Sicherer Modus: Alle Module sind aus. Es wurde nichts verändert.',
      leave: 'Normal neu starten',
      leaveForced: 'Beende Nemo und starte es ohne --safe-mode.',
    },
    widget: {
      message: 'Dieses Widget konnte nicht angezeigt werden. Der Rest der Startseite läuft weiter.',
      retry: 'Erneut versuchen',
    },
    card: {
      title: (name: string) => `${name} hat ein Problem`,
      body: 'Dieser Bereich konnte nicht angezeigt werden. Der Rest der App läuft weiter, deine Daten sind nicht betroffen.',
      retry: 'Erneut versuchen',
      disable: 'Modul deaktivieren',
      disabled: 'Modul deaktiviert. Du kannst es in den Einstellungen wieder einschalten.',
      report: 'Fehler melden',
    },
  },
  {
    en: {
      title: 'Diagnostics and bug reports',
      export: {
        label: 'Export diagnostics',
        description:
          'Shows exactly what is in the file first and only saves it after you confirm. No entries, vault, keys, server addresses or paths with user names. The app sends nothing.',
        previewTitle: 'Review diagnostics file',
        previewHint: 'This is the complete content of the file. Check it before you save.',
        save: 'Save',
        cancel: 'Close',
        saved: 'Diagnostics saved.',
        loading: 'Preparing …',
      },
      report: {
        label: 'Report a bug',
        description:
          'Opens a prefilled GitHub form in your browser. Attach the diagnostics file if you like. The app transmits nothing itself.',
        mail: 'Report by e-mail',
        mailSubject: 'Nemo: bug report',
        mailIntro: 'Please describe the problem briefly and attach the diagnostics file.',
        stepsPlaceholder:
          '1. …\n2. …\n(Please attach the diagnostics file: Settings → About Nemo → Export diagnostics)',
        paletteCommand: 'Report a bug',
        keywords: ['Bug', 'Problem', 'Diagnostics', 'Report'],
      },
      recovery: {
        title: 'The database cannot be opened',
        intro:
          'Nemo could not read the local data on this device. Nothing has been deleted. Before anything is changed you keep a copy of the defective state.',
        details: 'Technical detail',
        repair: 'Repair database',
        repairHint: 'Reopens the database and only empties tables that cannot be read.',
        repairDone: 'Repaired. The app restarts.',
        repairFailed:
          'This could not be repaired. Restore a backup or start again with an empty database.',
        restore: 'Restore a backup',
        restoreHint: 'Choose a backup file. The defective state is saved first and then replaced.',
        passphrase: 'Password of the backup file',
        errors: {
          unreadable: 'This is not a Nemo backup file.',
          'passphrase-required': 'This file is encrypted. Enter the password.',
          'wrong-passphrase': 'The password does not match.',
          cancelled: 'Cancelled. Nothing was changed.',
          failed: 'Restoring failed.',
        },
        reset: 'Start again with an empty database',
        resetHint: 'A copy of the defective state is saved first. Then Nemo starts without data.',
        resetTitle: 'Start again with an empty database',
        resetWarning:
          'All local data on this device is replaced (the copy is kept). Type RESTART to confirm.',
        resetPhrase: 'RESTART',
        resetConfirm: 'Start again',
        copyCancelled: 'Nothing is changed without a saved copy.',
        report: 'Report a bug',
      },
      fatal: {
        title: 'Nemo ran into a problem',
        body: 'The app could not continue. Your data has not been changed.',
        reload: 'Reload',
        safeMode: 'Start in safe mode',
        safeHint: 'Starts with all modules off. The next normal start brings everything back.',
      },
      safe: {
        banner: 'Safe mode: all modules are off. Nothing was changed.',
        leave: 'Restart normally',
        leaveForced: 'Quit Nemo and start it without --safe-mode.',
      },
      widget: {
        message: 'This widget could not be shown. The rest of the home screen keeps running.',
        retry: 'Try again',
      },
      card: {
        title: (name: string) => `${name} ran into a problem`,
        body: 'This area could not be shown. The rest of the app keeps running and your data is not affected.',
        retry: 'Try again',
        disable: 'Disable module',
        disabled: 'Module disabled. You can switch it back on in Settings.',
        report: 'Report a bug',
      },
    },
    es: {
      title: 'Diagnóstico e informe de errores',
      export: {
        label: 'Exportar diagnóstico',
        description:
          'Primero muestra exactamente lo que contiene el archivo y solo lo guarda cuando lo confirmas. Sin entradas, bóveda, claves, direcciones de servidor ni rutas con nombres de usuario. La app no envía nada.',
        previewTitle: 'Revisar archivo de diagnóstico',
        previewHint: 'Este es el contenido completo del archivo. Revísalo antes de guardarlo.',
        save: 'Guardar',
        cancel: 'Cerrar',
        saved: 'Diagnóstico guardado.',
        loading: 'Preparando …',
      },
      report: {
        label: 'Informar de un error',
        description:
          'Abre en tu navegador un formulario de GitHub ya rellenado. Si quieres, adjunta el archivo de diagnóstico. La app no transmite nada por sí misma.',
        mail: 'Informar por correo',
        mailSubject: 'Nemo: informe de error',
        mailIntro: 'Describe brevemente el problema y adjunta el archivo de diagnóstico.',
        stepsPlaceholder:
          '1. …\n2. …\n(Adjunta el archivo de diagnóstico: Ajustes → Acerca de Nemo → Exportar diagnóstico)',
        paletteCommand: 'Informar de un error',
        keywords: ['Error', 'Fallo', 'Problema', 'Diagnóstico', 'Informe'],
      },
      recovery: {
        title: 'No se puede abrir la base de datos',
        intro:
          'Nemo no ha podido leer los datos locales de este dispositivo. No se ha borrado nada. Antes de cambiar algo, conservas una copia del estado dañado.',
        details: 'Detalle técnico',
        repair: 'Reparar base de datos',
        repairHint:
          'Vuelve a abrir la base de datos y solo vacía las tablas que no se pueden leer.',
        repairDone: 'Reparada. La app se reinicia.',
        repairFailed:
          'No se ha podido reparar. Restaura una copia de seguridad o empieza de nuevo con una base de datos vacía.',
        restore: 'Restaurar una copia de seguridad',
        restoreHint:
          'Elige un archivo de copia de seguridad. Primero se guarda el estado dañado y luego se sustituye.',
        passphrase: 'Contraseña del archivo de copia',
        errors: {
          unreadable: 'Este no es un archivo de copia de seguridad de Nemo.',
          'passphrase-required': 'Este archivo está cifrado. Introduce la contraseña.',
          'wrong-passphrase': 'La contraseña no coincide.',
          cancelled: 'Cancelado. No se ha cambiado nada.',
          failed: 'No se ha podido restaurar.',
        },
        reset: 'Empezar de nuevo con una base de datos vacía',
        resetHint: 'Primero se guarda una copia del estado dañado. Luego Nemo se inicia sin datos.',
        resetTitle: 'Empezar de nuevo con una base de datos vacía',
        resetWarning:
          'Se sustituyen todos los datos locales de este dispositivo (la copia se conserva). Escribe REINICIAR para confirmar.',
        resetPhrase: 'REINICIAR',
        resetConfirm: 'Empezar de nuevo',
        copyCancelled: 'No se cambia nada sin una copia guardada.',
        report: 'Informar de un error',
      },
      fatal: {
        title: 'Nemo ha tenido un problema',
        body: 'La app no ha podido continuar. Tus datos no se han modificado.',
        reload: 'Recargar',
        safeMode: 'Iniciar en modo seguro',
        safeHint:
          'Inicia con todos los módulos desactivados. El próximo inicio normal lo recupera todo.',
      },
      safe: {
        banner: 'Modo seguro: todos los módulos están desactivados. No se ha cambiado nada.',
        leave: 'Reiniciar con normalidad',
        leaveForced: 'Cierra Nemo y vuelve a iniciarlo sin --safe-mode.',
      },
      widget: {
        message: 'No se pudo mostrar este widget. El resto de la pantalla de inicio sigue funcionando.',
        retry: 'Reintentar',
      },
      card: {
        title: (name: string) => `${name} ha tenido un problema`,
        body: 'Esta sección no se ha podido mostrar. El resto de la app sigue funcionando y tus datos no se ven afectados.',
        retry: 'Reintentar',
        disable: 'Desactivar módulo',
        disabled: 'Módulo desactivado. Puedes volver a activarlo en los ajustes.',
        report: 'Informar de un error',
      },
    },
    fr: {
      title: 'Diagnostic et signalement d’erreurs',
      export: {
        label: 'Exporter le diagnostic',
        description:
          'Affiche d’abord exactement le contenu du fichier et ne l’enregistre qu’après votre confirmation. Sans entrées, coffre-fort, clés, adresses de serveur ni chemins contenant des noms d’utilisateur. L’app n’envoie rien.',
        previewTitle: 'Examiner le fichier de diagnostic',
        previewHint: 'Voici le contenu complet du fichier. Vérifiez-le avant d’enregistrer.',
        save: 'Enregistrer',
        cancel: 'Fermer',
        saved: 'Diagnostic enregistré.',
        loading: 'Préparation …',
      },
      report: {
        label: 'Signaler une erreur',
        description:
          'Ouvre dans votre navigateur un formulaire GitHub prérempli. Joignez-y le fichier de diagnostic si vous le souhaitez. L’app ne transmet rien elle-même.',
        mail: 'Signaler par e-mail',
        mailSubject: 'Nemo : signalement d’erreur',
        mailIntro: 'Décrivez brièvement le problème et joignez le fichier de diagnostic.',
        stepsPlaceholder:
          '1. …\n2. …\n(Joignez le fichier de diagnostic : Paramètres → À propos de Nemo → Exporter le diagnostic)',
        paletteCommand: 'Signaler une erreur',
        keywords: ['Erreur', 'Bug', 'Problème', 'Diagnostic', 'Signaler'],
      },
      recovery: {
        title: 'Impossible d’ouvrir la base de données',
        intro:
          'Nemo n’a pas pu lire les données locales de cet appareil. Rien n’a été supprimé. Avant toute modification, vous gardez une copie de l’état défectueux.',
        details: 'Détail technique',
        repair: 'Réparer la base de données',
        repairHint: 'Rouvre la base de données et ne vide que les tables illisibles.',
        repairDone: 'Réparée. L’app redémarre.',
        repairFailed:
          'La réparation a échoué. Restaurez une sauvegarde ou recommencez avec une base de données vide.',
        restore: 'Restaurer une sauvegarde',
        restoreHint:
          'Choisissez un fichier de sauvegarde. L’état défectueux est d’abord enregistré, puis remplacé.',
        passphrase: 'Mot de passe du fichier de sauvegarde',
        errors: {
          unreadable: 'Ce n’est pas un fichier de sauvegarde Nemo.',
          'passphrase-required': 'Ce fichier est chiffré. Saisissez le mot de passe.',
          'wrong-passphrase': 'Le mot de passe ne correspond pas.',
          cancelled: 'Annulé. Rien n’a été modifié.',
          failed: 'La restauration a échoué.',
        },
        reset: 'Recommencer avec une base de données vide',
        resetHint:
          'Une copie de l’état défectueux est d’abord enregistrée. Nemo démarre ensuite sans données.',
        resetTitle: 'Recommencer avec une base de données vide',
        resetWarning:
          'Toutes les données locales de cet appareil sont remplacées (la copie est conservée). Saisissez RECOMMENCER pour confirmer.',
        resetPhrase: 'RECOMMENCER',
        resetConfirm: 'Recommencer',
        copyCancelled: 'Rien n’est modifié sans copie enregistrée.',
        report: 'Signaler une erreur',
      },
      fatal: {
        title: 'Nemo a rencontré un problème',
        body: 'L’app n’a pas pu continuer. Vos données n’ont pas été modifiées.',
        reload: 'Recharger',
        safeMode: 'Démarrer en mode sans échec',
        safeHint:
          'Démarre avec tous les modules désactivés. Le prochain démarrage normal rétablit tout.',
      },
      safe: {
        banner: 'Mode sans échec : tous les modules sont désactivés. Rien n’a été modifié.',
        leave: 'Redémarrer normalement',
        leaveForced: 'Quittez Nemo et relancez-le sans --safe-mode.',
      },
      widget: {
        message: 'Ce widget n’a pas pu s’afficher. Le reste de l’écran d’accueil continue de fonctionner.',
        retry: 'Réessayer',
      },
      card: {
        title: (name: string) => `${name} a rencontré un problème`,
        body: 'Cette section n’a pas pu s’afficher. Le reste de l’app continue de fonctionner et vos données ne sont pas touchées.',
        retry: 'Réessayer',
        disable: 'Désactiver le module',
        disabled: 'Module désactivé. Vous pouvez le réactiver dans les paramètres.',
        report: 'Signaler une erreur',
      },
    },
    'pt-BR': {
      title: 'Diagnóstico e relato de erros',
      export: {
        label: 'Exportar diagnóstico',
        description:
          'Primeiro mostra exatamente o que está no arquivo e só salva depois da sua confirmação. Sem entradas, cofre, chaves, endereços de servidor nem caminhos com nomes de usuário. O app não envia nada.',
        previewTitle: 'Ver arquivo de diagnóstico',
        previewHint: 'Este é o conteúdo completo do arquivo. Confira antes de salvar.',
        save: 'Salvar',
        cancel: 'Fechar',
        saved: 'Diagnóstico salvo.',
        loading: 'Preparando …',
      },
      report: {
        label: 'Relatar um erro',
        description:
          'Abre no seu navegador um formulário do GitHub já preenchido. Se quiser, anexe o arquivo de diagnóstico. O app não transmite nada por conta própria.',
        mail: 'Relatar por e-mail',
        mailSubject: 'Nemo: relato de erro',
        mailIntro: 'Descreva o problema em poucas palavras e anexe o arquivo de diagnóstico.',
        stepsPlaceholder:
          '1. …\n2. …\n(Anexe o arquivo de diagnóstico: Configurações → Sobre o Nemo → Exportar diagnóstico)',
        paletteCommand: 'Relatar um erro',
        keywords: ['Erro', 'Bug', 'Problema', 'Diagnóstico', 'Relatar'],
      },
      recovery: {
        title: 'Não é possível abrir o banco de dados',
        intro:
          'O Nemo não conseguiu ler os dados locais deste dispositivo. Nada foi excluído. Antes de qualquer mudança, você fica com uma cópia do estado com defeito.',
        details: 'Detalhe técnico',
        repair: 'Reparar banco de dados',
        repairHint:
          'Abre o banco de dados de novo e só esvazia as tabelas que não podem ser lidas.',
        repairDone: 'Reparado. O app vai reiniciar.',
        repairFailed:
          'Não foi possível reparar. Restaure um backup ou comece de novo com um banco de dados vazio.',
        restore: 'Restaurar um backup',
        restoreHint:
          'Escolha um arquivo de backup. O estado com defeito é salvo primeiro e depois substituído.',
        passphrase: 'Senha do arquivo de backup',
        errors: {
          unreadable: 'Este não é um arquivo de backup do Nemo.',
          'passphrase-required': 'Este arquivo está criptografado. Digite a senha.',
          'wrong-passphrase': 'A senha não confere.',
          cancelled: 'Cancelado. Nada foi alterado.',
          failed: 'Não foi possível restaurar.',
        },
        reset: 'Começar de novo com um banco de dados vazio',
        resetHint:
          'Primeiro é salva uma cópia do estado com defeito. Depois o Nemo inicia sem dados.',
        resetTitle: 'Começar de novo com um banco de dados vazio',
        resetWarning:
          'Todos os dados locais deste dispositivo são substituídos (a cópia é mantida). Digite RECOMEÇAR para confirmar.',
        resetPhrase: 'RECOMEÇAR',
        resetConfirm: 'Começar de novo',
        copyCancelled: 'Nada é alterado sem uma cópia salva.',
        report: 'Relatar um erro',
      },
      fatal: {
        title: 'O Nemo teve um problema',
        body: 'O app não conseguiu continuar. Seus dados não foram alterados.',
        reload: 'Recarregar',
        safeMode: 'Iniciar no modo de segurança',
        safeHint:
          'Inicia com todos os módulos desligados. O próximo início normal traz tudo de volta.',
      },
      safe: {
        banner: 'Modo de segurança: todos os módulos estão desligados. Nada foi alterado.',
        leave: 'Reiniciar normalmente',
        leaveForced: 'Feche o Nemo e inicie-o de novo sem --safe-mode.',
      },
      widget: {
        message: 'Não foi possível exibir este widget. O resto da tela inicial continua funcionando.',
        retry: 'Tentar de novo',
      },
      card: {
        title: (name: string) => `${name} teve um problema`,
        body: 'Esta área não pôde ser exibida. O resto do app continua funcionando e seus dados não são afetados.',
        retry: 'Tentar de novo',
        disable: 'Desativar módulo',
        disabled: 'Módulo desativado. Você pode ativá-lo de novo nas configurações.',
        report: 'Relatar um erro',
      },
    },
  },
);
