import type { Strings } from '@/strings';

export const help: Strings['help'] = {
  label: 'Help',
  sync: 'The sync server is your own small server that keeps the data of several devices in step. If you like, the data is end-to-end encrypted: the server then only sees unreadable values, and only your devices know the passphrase.',
  aiLocal:
    'A small language model runs only on this device and understands sentences the fixed rules don’t know – no token, no internet. It is only downloaded after you agree (you see size, source and checksum first) and checks the download itself.',
  aiWrite:
    'Nemo always shows recognised entries as a preview first; nothing is saved until you confirm. Here you decide whether and where the assistant may suggest entries.',
  aiCloudWrite:
    'Nemo first tries fixed rules, then (if set up) the local model – both are free and stay on the device. Only if neither is enough and you allow it here does the sentence go to an AI provider, together with the date and the modules’ field names (never your entries).',
  aiAskMissing:
    'On: if the due date is missing, for example, the preview asks for it. Off: such sentences are not suggested as entries.',
  aiRouter:
    'Several AI providers are listed in order. The app asks the first available one; if it is overloaded, unreachable or has hit its limit, the app moves on to the next. Only your question and a short schema are sent, never your data.',
  updateChannel:
    '“Stable” only offers finished versions. “Beta” also shows pre-releases, which bring new features earlier but are less tested. The app makes a backup before every update.',
  vault:
    'The vault is encrypted with your master password, which is stored nowhere. If you forget it, nobody can recover the entries – not even us. So keep it somewhere safe.',
  startData:
    'The assistant reads text or files and shows a preview first. Nothing is saved until you confirm, and every import can be undone as a whole.',
  localApi:
    'The interface only listens on this computer (127.0.0.1) and is useless without an access key. Each access only gets the rights you tick. Imports land in the app as a preview first. It can never reach the vault (Passwords), settings or keys.',
  connectors:
    'Connections only read; they change nothing at the service. Login details are kept in this device’s key store and are never synced or backed up. Emails are only analysed on your device and never sent to an AI.',
};
