/**
 * Demo vault for dev builds. The vault is encrypted, so there are no plain rows: `afterSeed` creates
 * it with the module's own `createVault` (same Argon2id parameters as a real vault) – and only when no
 * vault exists yet, so a real one is never touched.
 */
import type { Lang } from '@/core/i18n/lang';
import type { SeedModule } from '@/core/seed/types';
import { disableBiometricUnlock } from './biometric';
import { VAULT_RECORD_ID, type EntryDraft } from './schema';
import { createVault, lockVault, readHeader, saveEntry } from './vault';

/** Must equal `DEMO_PASSPHRASE` in `core/seed/dev.ts` (core may not import modules). */
export const DEMO_PASSPHRASE = 'nemo-demo-tresor'; // gitleaks:allow

export const DEMO_ENTRIES: EntryDraft[] = [
  {
    title: 'Demo-Shop',
    username: 'demo.nutzer',
    password: 'Demo-Passwort-1',
    url: 'https://shop.example.org',
    tags: ['Einkauf'],
    favorite: true,
  }, // gitleaks:allow
  {
    title: 'Demo-Forum',
    username: 'forum.demo',
    password: 'Demo-Passwort-2',
    url: 'https://forum.example.org',
    tags: ['Freizeit'],
  }, // gitleaks:allow
  {
    title: 'Demo-Streaming',
    username: 'demo@example.org',
    password: 'Demo-Passwort-3',
    url: 'https://streaming.example.com',
    notes: 'Familien-Abo',
    tags: ['Freizeit'],
  }, // gitleaks:allow
  {
    title: 'Demo-Bank (Beispiel)',
    username: 'DE00 0000 0000',
    password: 'Demo-Passwort-4',
    url: 'https://bank.example.org',
    tags: ['Finanzen'],
    favorite: true,
  }, // gitleaks:allow
  {
    title: 'Demo-Cloudspeicher',
    username: 'cloud.demo',
    password: 'Demo-Passwort-5',
    url: 'https://cloud.example.com',
    tags: ['Arbeit'],
  }, // gitleaks:allow
  {
    title: 'Demo-Fahrdienst',
    username: 'fahr.demo',
    password: 'Demo-Passwort-6',
    url: 'https://fahrdienst.example.org',
    tags: [],
  }, // gitleaks:allow
];

/** German source text → [en, es, fr, pt-BR]; a text without an entry stays German. */
const TR: Record<string, readonly [string, string, string, string]> = {
  'Demo-Shop': ['Demo shop', 'Tienda demo', 'Boutique démo', 'Loja demo'],
  'Demo-Forum': ['Demo forum', 'Foro demo', 'Forum démo', 'Fórum demo'],
  'Demo-Streaming': ['Demo streaming', 'Streaming demo', 'Streaming démo', 'Streaming demo'],
  'Demo-Bank (Beispiel)': [
    'Demo bank (example)',
    'Banco demo (ejemplo)',
    'Banque démo (exemple)',
    'Banco demo (exemplo)',
  ],
  'Demo-Cloudspeicher': [
    'Demo cloud storage',
    'Almacenamiento demo en la nube',
    'Stockage cloud démo',
    'Armazenamento demo na nuvem',
  ],
  'Demo-Fahrdienst': [
    'Demo ride service',
    'Servicio de transporte demo',
    'Service de transport démo',
    'Serviço de transporte demo',
  ],
  'Familien-Abo': ['Family plan', 'Plan familiar', 'Abonnement famille', 'Plano família'],
  Einkauf: ['Shopping', 'Compras', 'Achats', 'Compras'],
  Freizeit: ['Leisure', 'Ocio', 'Loisirs', 'Lazer'],
  Finanzen: ['Finance', 'Finanzas', 'Finances', 'Finanças'],
  Arbeit: ['Work', 'Trabajo', 'Travail', 'Trabalho'],
};
const LANG_INDEX = { en: 0, es: 1, fr: 2, 'pt-BR': 3 } as const;
const tr = (lang: Lang, de: string): string =>
  lang === 'de' ? de : (TR[de]?.[LANG_INDEX[lang]] ?? de);

/** The demo entries with title, notes and tags in `lang` (logins and passwords are language-free). */
export const demoEntries = (lang: Lang): EntryDraft[] =>
  DEMO_ENTRIES.map((e) => ({
    ...e,
    title: tr(lang, e.title),
    ...(e.notes ? { notes: tr(lang, e.notes) } : {}),
    tags: (e.tags ?? []).map((x) => tr(lang, x)),
  }));

export default {
  seed: () => ({}),
  async afterSeed(ctx) {
    if ((await readHeader()).state !== 'none') return [];
    await createVault(DEMO_PASSPHRASE);
    const ids: string[] = [];
    for (const draft of demoEntries(ctx.lang)) ids.push(await saveEntry(draft));
    lockVault();
    return [
      { collection: 'vault', ids: [VAULT_RECORD_ID] },
      { collection: 'entry', ids },
    ];
  },
  async beforeRemove() {
    lockVault(); // the key of the vault about to be deleted must not stay in memory
    // Neither must its data key stay sealed in the OS keystore (it would still open the old ciphertext).
    await disableBiometricUnlock().catch(() => undefined);
  },
} satisfies SeedModule;
