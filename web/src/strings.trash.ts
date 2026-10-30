import { defineBundle } from '@/core/i18n/bundle';

/** "Zuletzt gelöscht" (Settings → Allgemein) in every UI language. */
export const tTrash = defineBundle(
  {
    title: 'Zuletzt gelöscht',
    description:
      'Gelöschte Unterlagen, Abos und Termine bleiben 30 Tage hier und lassen sich zurückholen.',
    keywords: ['Papierkorb', 'wiederherstellen', 'gelöscht', 'zurückholen'],
    keep: 'Gelöschtes 30 Tage aufbewahren',
    keepHint:
      'Aus: Zurückholen geht nur direkt nach dem Löschen („Rückgängig“), Dateien von Unterlagen werden nach kurzer Zeit entfernt. An: Gelöschtes bleibt 30 Tage auf diesem Gerät, auch im Backup.',
    off: 'Aufbewahren ist aus. Gelöschtes lässt sich nur direkt über „Rückgängig“ zurückholen.',
    empty: 'In den letzten 30 Tagen wurde nichts gelöscht.',
    kinds: { document: 'Unterlage', subscription: 'Abo', event: 'Termin', reminder: 'Erinnerung' },
    meta: (kind: string, date: string, days: number) =>
      `${kind} · gelöscht ${date} · noch ${days === 1 ? '1 Tag' : `${days} Tage`}`,
    restore: 'Wiederherstellen',
    restoreAria: (title: string) => `${title} wiederherstellen`,
    purge: 'Endgültig löschen',
    purgeAria: (title: string) => `${title} endgültig löschen`,
    purgeSure: 'Sicher? Endgültig löschen',
    restored: 'Wiederhergestellt.',
    purged: 'Endgültig gelöscht.',
    purgeWaits: 'Wird nach dem nächsten Abgleich endgültig entfernt.',
    list: 'Gelöscht in den letzten 30 Tagen',
  },
  {
    en: {
      title: 'Recently deleted',
      description:
        'Deleted documents, subscriptions and appointments stay here for 30 days and can be brought back.',
      keywords: ['trash', 'recycle bin', 'restore', 'deleted', 'undelete'],
      keep: 'Keep deleted items for 30 days',
      keepHint:
        'Off: you can only bring something back right after deleting it (“Undo”); files of documents are removed after a short while. On: deleted items stay on this device for 30 days, backups included.',
      off: 'Keeping is off. Deleted items can only be brought back right away with “Undo”.',
      empty: 'Nothing was deleted in the last 30 days.',
      kinds: {
        document: 'Document',
        subscription: 'Subscription',
        event: 'Appointment',
        reminder: 'Reminder',
      },
      meta: (kind: string, date: string, days: number) =>
        `${kind} · deleted ${date} · ${days === 1 ? '1 day' : `${days} days`} left`,
      restore: 'Restore',
      restoreAria: (title: string) => `Restore ${title}`,
      purge: 'Delete for good',
      purgeAria: (title: string) => `Delete ${title} for good`,
      purgeSure: 'Sure? Delete for good',
      restored: 'Restored.',
      purged: 'Deleted for good.',
      purgeWaits: 'It will be removed for good after the next sync.',
      list: 'Deleted in the last 30 days',
    },
    es: {
      title: 'Eliminados recientemente',
      description:
        'Los documentos, suscripciones y citas eliminados se quedan aquí 30 días y se pueden recuperar.',
      keywords: ['papelera', 'restaurar', 'eliminado', 'recuperar'],
      keep: 'Conservar lo eliminado 30 días',
      keepHint:
        'Desactivado: solo se puede recuperar justo después de eliminar («Deshacer»); los archivos de documentos se borran al poco tiempo. Activado: lo eliminado se queda 30 días en este dispositivo, también en las copias de seguridad.',
      off: 'Conservar está desactivado. Lo eliminado solo se recupera enseguida con «Deshacer».',
      empty: 'No se ha eliminado nada en los últimos 30 días.',
      kinds: {
        document: 'Documento',
        subscription: 'Suscripción',
        event: 'Cita',
        reminder: 'Recordatorio',
      },
      meta: (kind: string, date: string, days: number) =>
        `${kind} · eliminado ${date} · ${days === 1 ? 'queda 1 día' : `quedan ${days} días`}`,
      restore: 'Restaurar',
      restoreAria: (title: string) => `Restaurar ${title}`,
      purge: 'Eliminar definitivamente',
      purgeAria: (title: string) => `Eliminar ${title} definitivamente`,
      purgeSure: '¿Seguro? Eliminar definitivamente',
      restored: 'Restaurado.',
      purged: 'Eliminado definitivamente.',
      purgeWaits: 'Se eliminará definitivamente tras la próxima sincronización.',
      list: 'Eliminado en los últimos 30 días',
    },
    fr: {
      title: 'Supprimés récemment',
      description:
        'Les documents, abonnements et rendez-vous supprimés restent ici 30 jours et peuvent être récupérés.',
      keywords: ['corbeille', 'restaurer', 'supprimé', 'récupérer'],
      keep: 'Conserver les éléments supprimés 30 jours',
      keepHint:
        'Désactivé : on ne peut récupérer qu’un élément juste après la suppression (« Annuler ») ; les fichiers des documents sont effacés peu après. Activé : les éléments supprimés restent 30 jours sur cet appareil, sauvegardes comprises.',
      off: 'La conservation est désactivée. Un élément supprimé ne se récupère qu’aussitôt avec « Annuler ».',
      empty: 'Rien n’a été supprimé au cours des 30 derniers jours.',
      kinds: {
        document: 'Document',
        subscription: 'Abonnement',
        event: 'Rendez-vous',
        reminder: 'Rappel',
      },
      meta: (kind: string, date: string, days: number) =>
        `${kind} · supprimé ${date} · ${days === 1 ? '1 jour restant' : `${days} jours restants`}`,
      restore: 'Restaurer',
      restoreAria: (title: string) => `Restaurer ${title}`,
      purge: 'Supprimer définitivement',
      purgeAria: (title: string) => `Supprimer ${title} définitivement`,
      purgeSure: 'Sûr ? Supprimer définitivement',
      restored: 'Restauré.',
      purged: 'Supprimé définitivement.',
      purgeWaits: 'Sera supprimé définitivement après la prochaine synchronisation.',
      list: 'Supprimés au cours des 30 derniers jours',
    },
    'pt-BR': {
      title: 'Excluídos recentemente',
      description:
        'Documentos, assinaturas e compromissos excluídos ficam aqui por 30 dias e podem ser recuperados.',
      keywords: ['lixeira', 'restaurar', 'excluído', 'recuperar'],
      keep: 'Manter excluídos por 30 dias',
      keepHint:
        'Desligado: só dá para recuperar logo depois de excluir (“Desfazer”); os arquivos dos documentos são removidos pouco depois. Ligado: o que foi excluído fica 30 dias neste aparelho, inclusive nos backups.',
      off: 'Manter está desligado. O que foi excluído só volta logo em seguida com “Desfazer”.',
      empty: 'Nada foi excluído nos últimos 30 dias.',
      kinds: {
        document: 'Documento',
        subscription: 'Assinatura',
        event: 'Compromisso',
        reminder: 'Lembrete',
      },
      meta: (kind: string, date: string, days: number) =>
        `${kind} · excluído ${date} · ${days === 1 ? 'resta 1 dia' : `restam ${days} dias`}`,
      restore: 'Restaurar',
      restoreAria: (title: string) => `Restaurar ${title}`,
      purge: 'Excluir definitivamente',
      purgeAria: (title: string) => `Excluir ${title} definitivamente`,
      purgeSure: 'Certeza? Excluir definitivamente',
      restored: 'Restaurado.',
      purged: 'Excluído definitivamente.',
      purgeWaits: 'Será removido definitivamente após a próxima sincronização.',
      list: 'Excluídos nos últimos 30 dias',
    },
  },
);
