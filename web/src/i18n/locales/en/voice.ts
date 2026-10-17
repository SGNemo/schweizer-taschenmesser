import type { Strings } from '@/strings';

export const voice: Strings['voice'] = {
  title: 'Voice input',
  intro:
    'Press a key to talk to search and the AI. The recognised text lands in the input field; you send it yourself.',
  enable: 'Use voice input',
  enableHint: 'Off until you switch it on.',
  unavailable:
    'Not available here: this device or browser has no speech recognition. Typing works as usual.',
  key: 'Key in the app',
  keyHint: 'Hold and speak, or tap once and tap again to finish. Esc cancels.',
  keyRecord: 'Change key',
  keyRecording: 'Press a key …',
  keyOff: 'No key',
  keyClear: 'Remove',
  keyDefault: 'Default',
  keyInvalid: 'Use a key from F1 to F12, or a key together with Ctrl or Alt.',
  globalKey: 'System-wide key',
  globalHint:
    'Also works while Nemo is in the background: one press starts, the next one ends the recording.',
  globalErrors: {
    invalid: 'This key combination is not understood.',
    taken: 'Another program already uses this key combination.',
    failed: 'The key could not be set.',
  },
  noticeTitle: 'Switch on voice input?',
  noticeText:
    'To recognise speech, your browser or system may send the audio to its provider, for example Google or Microsoft. Nemo stores neither audio nor recognised text, writes nothing to logs and passes nothing to the AI until you send it yourself. The language follows the app language.',
  noticeConfirm: 'Switch on',
  noticeCancel: 'Not now',
  button: 'Speak',
  buttonStop: 'Finish recording',
  listening: 'Listening …',
  listeningHint: (key: string) => `${key} or a tap finishes. Esc cancels.`,
  listeningHintNoKey: 'A tap finishes. Esc cancels.',
  finishing: 'One moment …',
  shortcutText: 'Speak (hold or tap)',
  notices: {
    denied: 'The microphone is not allowed. You can allow it in the browser settings.',
    silent: 'I did not hear anything. Feel free to try again.',
    failed: 'Voice input does not work here right now. Typing works as usual.',
  },
  searchWords: ['Microphone', 'Dictation', 'Speak', 'Push-to-talk', 'Voice', 'Speech recognition'],
};
