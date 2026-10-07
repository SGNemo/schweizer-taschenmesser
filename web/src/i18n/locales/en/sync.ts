import type { Strings } from '@/strings';

export const sync: Strings['sync'] = {
  defaultDeviceName: 'Device',
  title: 'Sync',
  intro:
    'Optional: sync your data through your own sync server (on your LAN or via Tailscale). Without a server, everything stays on this device.',
  serverUrl: 'Server address',
  serverUrlHint: 'e.g. https://my-pc.tailnet.ts.net',
  token: 'Access token',
  deviceName: 'Device name',
  deviceNameHint: 'This is how this device appears in the device list.',
  deviceNames: { desktop: 'Windows app', android: 'Android phone', web: 'Browser' } as Record<
    string,
    string
  >,
  encrypt: 'End-to-end encryption',
  encryptHint:
    'Values are encrypted on the device; the server only sees ciphertext. Only possible on an empty server.',
  plainWarning:
    'Without end-to-end encryption, your data is stored on the server in plain text. Use it if the server isn’t yours alone or isn’t stored encrypted.',
  passphrase: 'Passphrase',
  passphraseHint: 'At least 8 characters. Without the passphrase, the data can’t be recovered.',
  passphraseJoinHint: 'Only needed if the server is encrypted.',
  connect: 'Connect',
  connecting: 'Connecting …',
  connected: (host: string) => `Connected to ${host}`,
  encryptedBadge: 'Encrypted',
  plainBadge: 'Not encrypted',
  lastSync: 'Last synced',
  never: 'not yet',
  pending: (n: number) =>
    n === 0 ? 'Everything sent' : n === 1 ? '1 change waiting' : `${n} changes waiting`,
  syncNow: 'Sync now',
  disconnect: 'Disconnect',
  signOut: 'Sign out this device',
  signOutHint:
    'Blocks this device’s token on the server and disconnects it. Your local data stays.',
  disconnectHint: 'Your local data stays; the server isn’t changed.',
  state: { off: 'Off', idle: 'Synced', syncing: 'Syncing …', error: 'Error' },
  badge: (state: string) => `Sync: ${state}`,
  detailsTitle: 'Status',
  lastResult: (pulled: number, pushed: number) => `Last time: ${pulled} received, ${pushed} sent`,
  rejected: (n: number) =>
    n === 1
      ? '1 received change couldn’t be decrypted and was skipped.'
      : `${n} received changes couldn’t be decrypted and were skipped.`,
  failuresInRow: (n: number) => (n === 1 ? '1 failed attempt' : `${n} failed attempts in a row`),
  serverSize: 'Data on the server',
  serverSizeValue: (records: number, kb: number) =>
    `${records} ${records === 1 ? 'entry' : 'entries'}, ${kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`}`,
  devicesTitle: 'Devices',
  devicesIntro:
    'All devices that sync with this server. A blocked device can no longer sync; data it already sent stays.',
  devicesUnsupported:
    'This server has no device management (older version). Update the server to block devices.',
  deviceThis: 'this device',
  deviceLastSeen: (when: string) => `Last active: ${when}`,
  deviceNever: 'never',
  deviceRevoked: (when: string) => `Blocked on ${when}`,
  deviceStale: (days: number) =>
    `Not active for ${days} days. Block it if you no longer use it: very old devices can bring back deleted entries.`,
  deviceLock: 'Block',
  deviceLockTitle: (name: string) => `Block “${name}”?`,
  deviceLockText:
    'The device can no longer sync afterwards. Data it already sent stays on the server. To reconnect, the device needs the server token.',
  deviceLocked: 'Device blocked.',
  deviceLockFailed: 'The device couldn’t be blocked.',
  deviceId: (id: string) => `Device ID: ${id}`,
  rotateToken: 'Renew this device’s token',
  rotated: 'Token renewed.',
  conflictsTitle: 'Conflicts',
  conflictsIntro:
    'If two devices changed the same field at the same time, the newer change wins. The overwritten value is shown here and can be restored.',
  conflictsNone: 'No open conflicts.',
  conflictKept: {
    remote: 'A change from another device overwrote yours.',
    local: 'Your change overwrote one from another device.',
  } as Record<string, string>,
  conflictLost: 'Overwritten',
  conflictNow: 'Now',
  conflictEmpty: '(empty)',
  conflictDeleted: '(deleted)',
  conflictTooLarge: 'Value too large to keep',
  conflictRestore: 'Restore',
  conflictDismiss: 'Dismiss',
  conflictDismissAll: 'Dismiss all',
  conflictRestored: 'Value restored.',
  conflictOutcome: {
    'already-current': 'That value is already current.',
    'record-gone': 'The entry no longer exists.',
    'not-restorable': 'This value can’t be restored.',
  } as Record<string, string>,
  errors: {
    network: 'Server not reachable.',
    revoked:
      'This device has been blocked. Disconnect it and connect again if you want to allow it again.',
    'rate-limited': 'Too many requests or failed attempts – it will retry automatically.',
    unauthorized: 'The server rejected the token.',
    server: 'The server reported an error.',
    decrypt: 'Decryption failed – is the passphrase right?',
    'no-key':
      'The data on the server is encrypted. Please disconnect and connect again with the passphrase.',
    unsupported: 'Not supported.',
    unknown: 'Unknown error.',
  } as Record<string, string>,
  failures: {
    'invalid-url': 'Please enter a valid address starting with http:// or https://.',
    unreachable:
      'Server not reachable. If the app is opened via HTTPS, the server must be reachable via HTTPS too (e.g. with “tailscale serve”).',
    unauthorized: 'The token was rejected.',
    'passphrase-required': 'This server is encrypted. Please enter the passphrase.',
    'passphrase-too-short': 'The passphrase needs at least 8 characters.',
    'wrong-passphrase': 'Wrong passphrase.',
    'server-has-plain-data':
      'The server already holds unencrypted data. Encryption is only possible on an empty server.',
    revoked: 'This device is blocked on the server.',
    'rate-limited': 'Too many failed attempts. Please try again in a minute.',
    'vault-outdated':
      'The server still uses the old encryption format. Reset the server to rebuild it.',
    'server-error': 'The server reported an error.',
  } as Record<string, string>,
  resetServer: 'Reset server and rebuild it encrypted',
  resetTitle: 'Reset server?',
  resetText:
    'All data on the server will be deleted. Your local data stays and is uploaded again; other devices also upload their data again on their next sync.',
  resetConfirm: 'Reset',
};
