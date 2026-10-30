import { defineBundle } from '@/core/i18n/bundle';

/** Texts of forms that keep a draft after an accidental close, in every UI language. */
export const tDraft = defineBundle(
  {
    restored: 'Dein Entwurf ist wieder da.',
    discard: 'Entwurf verwerfen',
  },
  {
    en: { restored: 'Your draft is back.', discard: 'Discard draft' },
    es: { restored: 'Tu borrador ha vuelto.', discard: 'Descartar borrador' },
    fr: { restored: 'Votre brouillon est de retour.', discard: 'Abandonner le brouillon' },
    'pt-BR': { restored: 'Seu rascunho está de volta.', discard: 'Descartar rascunho' },
  },
);
