/**
 * Demo vault for dev builds. The vault is encrypted, so there are no plain rows: `afterSeed` creates
 * it with the module's own `createVault` (same Argon2id parameters as a real vault) – and only when no
 * vault exists yet, so a real one is never touched.
 */
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

export default {
  seed: () => ({}),
  async afterSeed() {
    if ((await readHeader()).state !== 'none') return [];
    await createVault(DEMO_PASSPHRASE);
    const ids: string[] = [];
    for (const draft of DEMO_ENTRIES) ids.push(await saveEntry(draft));
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
