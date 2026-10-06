import { SUPPORTER_PUBLIC_KEYS } from './publicKeys';

/**
 * Keys the app accepts. The E2E build (`VITE_INCLUDE_EXAMPLE`) additionally trusts the public test
 * key (id 255) so specs can enter signed codes; the literal comparison is replaced at build time,
 * so no other build contains it (`core/seed/devFlag.test.ts`). The matching private key is the
 * public TEST key of packages/supporter-codes – it is never accepted by a normal build.
 */
export const E2E_TEST_KEY_ID = 255;
export const E2E_TEST_PUBLIC_KEY =
  '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664';

export const ACCEPTED_KEYS: Readonly<Record<number, string>> =
  import.meta.env.VITE_INCLUDE_EXAMPLE === 'true'
    ? { ...SUPPORTER_PUBLIC_KEYS, [E2E_TEST_KEY_ID]: E2E_TEST_PUBLIC_KEY }
    : SUPPORTER_PUBLIC_KEYS;
