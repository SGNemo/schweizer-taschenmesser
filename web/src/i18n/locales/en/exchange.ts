import type { Strings } from '@/strings';

export const exchange: Strings['exchange'] = {
  meta: {
    name: 'Device drop',
    description:
      'Send notes and links between phone and PC – on your home network, over the existing pairing.',
    widget: 'Device drop',
  },
  peer: {
    pc: 'Your PC',
    phone: 'Your phone',
  },
  from: {
    phone: 'from the phone',
    pc: 'from the PC',
    you: 'from you',
  },
  kind: {
    text: 'Note',
    link: 'Link',
    clip: 'Clipboard',
  },
  state: {
    waitingPc: 'Arrives as soon as Nemo is open on your phone.',
    waitingPhone: 'Goes out as soon as you are on your home network and Nemo runs on your PC.',
    sent: 'Handing over',
    delivered: 'Arrived',
    fullPc: 'There is not enough room on the PC right now.',
    fullPhone: 'There is not enough room on the phone right now.',
    rejected: 'Did not arrive.',
  },
  reach: {
    connected: 'reachable',
    away: 'not connected right now',
  },
  compose: {
    label: 'Message or link',
    placeholder: 'Message or link …',
    send: 'Send',
    failed: 'Could not be saved. Please send it again.',
  },
  actions: {
    copy: 'Copy',
    open: 'Open',
    remove: 'Remove card',
    copied: 'Copied',
  },
  empty: 'Nothing here yet. Send yourself a note or a link.',
  footer: 'Cards stay for 30 days.',
  unsupported: 'Device drop works in the desktop app and on the phone.',
  pc: {
    notPaired: 'No device paired yet. Pair your phone, then you can send it notes and links.',
    pair: 'Pair a device',
    hubOff: 'Home-network sync is off. Turn it on so your phone can reach this PC.',
    hubOn: 'Open sync',
    setupTitle: 'Turn on Device drop',
    setupLead: 'Choose which devices may send you notes and links. Windows asks once.',
    setupHint: 'What you send to your phone arrives as soon as Nemo is open there.',
    setupButton: 'Turn on Device drop',
    deviceOff: 'Device drop is still off for this device.',
    enable: 'Turn on',
    paused: 'Paused for this device.',
    resume: 'Resume',
    pause: 'Pause',
    lastSeen: (when: string) => `last seen: ${when}`,
    device: 'Device',
    cancelled: 'Not turned on.',
    busyControlled: 'A phone is controlling this PC right now. This works again afterwards.',
    failed: 'That did not work. Please try again.',
  },
  phone: {
    notPaired: 'Not paired with your PC yet. Pair it, then you can send it notes and links.',
    pair: 'Pair with PC',
    unreachable: 'Goes out as soon as you are on your home network and Nemo runs on your PC.',
    exchangeOff:
      'Device drop is not turned on at the PC yet. At the PC: More → Module library → Device drop.',
    notGranted:
      'Device drop is still off for this phone at the PC. At the PC: Device drop → Turn on.',
    paused: 'Device drop is paused at the PC. Turn it on again there.',
    limit: (minutes: number) => `Too much at once. The rest goes on in ${minutes} minutes.`,
  },
  widget: {
    nothing: 'Nothing new',
    fresh: (n: number) => (n === 1 ? '1 new' : `${n} new`),
    open: 'Open Device drop',
  },
};
