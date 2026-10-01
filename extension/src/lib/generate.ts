/** Password generation in the service worker (same code as the app); nothing is stored. */
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  MAX_LENGTH,
  MIN_LENGTH,
  characterPools,
  generatePassphrase,
  generatePassword,
  loadWordlist,
  passphraseEntropyBits,
  passwordEntropyBits,
  type PassphraseOptions,
  type PasswordOptions,
  type Rng,
} from '@nemo/vault-core';

export interface GenSettings {
  mode: 'password' | 'passphrase';
  password: PasswordOptions;
  passphrase: PassphraseOptions;
}

export const DEFAULT_GEN: GenSettings = {
  mode: 'password',
  password: DEFAULT_PASSWORD_OPTIONS,
  passphrase: DEFAULT_PASSPHRASE_OPTIONS,
};

/** Clamps whatever came in to values the generator accepts (the page never sees this code). */
export function sanitize(input: GenSettings): GenSettings {
  const p = input.password;
  const pools = characterPools(p).length;
  const password: PasswordOptions =
    pools === 0
      ? DEFAULT_PASSWORD_OPTIONS
      : { ...p, length: Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, pools, Math.round(p.length))) };
  const words = Math.min(12, Math.max(3, Math.round(input.passphrase.words)));
  return {
    mode: input.mode === 'passphrase' ? 'passphrase' : 'password',
    password,
    passphrase: { ...input.passphrase, words, separator: input.passphrase.separator.slice(0, 3) },
  };
}

export interface Generated {
  value: string;
  bits: number;
  /** 0 (very weak) … 4 (very strong), by entropy of the generator – the value is random, not chosen. */
  level: 0 | 1 | 2 | 3 | 4;
}

export const levelOf = (bits: number): Generated['level'] =>
  bits < 40 ? 0 : bits < 60 ? 1 : bits < 80 ? 2 : bits < 100 ? 3 : 4;

export async function generate(settings: GenSettings, rng?: Rng): Promise<Generated> {
  const s = sanitize(settings);
  if (s.mode === 'passphrase') {
    const list = await loadWordlist();
    const bits = passphraseEntropyBits(list.length, s.passphrase);
    return { value: generatePassphrase(list, s.passphrase, rng), bits, level: levelOf(bits) };
  }
  const bits = passwordEntropyBits(s.password);
  return { value: generatePassword(s.password, rng), bits, level: levelOf(bits) };
}
