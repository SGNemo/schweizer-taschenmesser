/**
 * Secret-store name of the sync server token (S5). In the apps (`os-keystore`: Windows Credential
 * Manager, Android Keystore) the token lives there and the `_secrets.syncConfig` record keeps the
 * rest – the service worker reads only the key from it. In the PWA the record keeps the token: its
 * secret store (`device-key`) sits in the same origin's IndexedDB, next to the record, so moving it
 * would add a second place without a second barrier.
 */
export const SYNC_TOKEN_SECRET = 'sync.token';
