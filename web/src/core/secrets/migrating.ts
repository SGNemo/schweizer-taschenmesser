import type { SecretStore } from './types';

/**
 * The OS keystore as primary store, the WebCrypto store as legacy source and fallback:
 *  - `get` finds secrets that were saved before the keystore existed (or while it failed), copies them
 *    into the keystore and deletes the old copy,
 *  - `set` writes to the keystore; if that fails the secret is still saved (in the legacy store) rather
 *    than lost – the next `get` moves it over,
 *  - `has` answers from the keystore, else from the legacy store; it only reads (the next `get` moves).
 *    An empty keystore value falls through to the legacy store here but not in `get`; `set` clears the
 *    legacy copy, so both stores never hold the name at once in practice,
 *  - `delete` removes it everywhere.
 */
export function createMigratingStore(primary: SecretStore, legacy: SecretStore): SecretStore {
  return {
    protection: primary.protection,
    async get(name) {
      let value: string | undefined;
      try {
        value = await primary.get(name);
      } catch (e) {
        console.warn('[secrets] keystore read failed', e);
      }
      if (value !== undefined) return value;
      const old = await legacy.get(name);
      if (old === undefined) return undefined;
      try {
        await primary.set(name, old);
        await legacy.delete(name);
      } catch (e) {
        console.warn('[secrets] could not move a secret into the keystore yet', e);
      }
      return old;
    },
    async has(name) {
      try {
        if (await primary.has(name)) return true;
      } catch (e) {
        console.warn('[secrets] keystore check failed', e);
      }
      return legacy.has(name);
    },
    async set(name, value) {
      try {
        await primary.set(name, value);
        await legacy.delete(name);
      } catch (e) {
        console.warn('[secrets] keystore write failed, keeping the secret in the local store', e);
        await legacy.set(name, value);
      }
    },
    async delete(name) {
      await Promise.allSettled([primary.delete(name), legacy.delete(name)]);
    },
  };
}
