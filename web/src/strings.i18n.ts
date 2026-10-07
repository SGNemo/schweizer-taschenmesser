import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the language setting (German + English). */
export const tLang = defineBundle(
  {
    title: 'Sprache',
    label: 'Sprache der Oberfläche',
    hint: 'Gilt nur für dieses Gerät. Neue Funktionen sind zweisprachig, der Rest der App bleibt vorerst Deutsch.',
    options: { de: 'Deutsch', en: 'English' },
    keywords: ['Language', 'Englisch', 'Deutsch'],
  },
  {
    title: 'Language',
    label: 'Interface language',
    hint: 'Applies to this device only. New features are bilingual; the rest of the app stays German for now.',
    options: { de: 'Deutsch', en: 'English' },
    keywords: ['Sprache', 'English', 'German'],
  },
);
