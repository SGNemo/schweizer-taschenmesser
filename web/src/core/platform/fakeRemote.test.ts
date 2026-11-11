import { describe, expect, it } from 'vitest';
import { createFakeRemoteParts } from './fakeRemote';

const nothing = () => {};

describe('fake remote: the mouse level behaves like the shell', () => {
  it('needs a media session first and a grant of the level; nothing is asked or closed otherwise', async () => {
    const { remote, hooks } = createFakeRemoteParts();
    await expect(remote.open('full', nothing)).rejects.toThrow('media-first');
    const media = await remote.open('media', nothing);
    expect(media).toMatchObject({ level: 'media', grant: 'media', unlockRequired: false });
    await expect(remote.open('full', nothing)).rejects.toThrow('not-granted');
    // the media session is still the open one
    expect(hooks.isOpen()).toBe(true);
    expect(hooks.level()).toBe('media');
    expect(hooks.unlocks()).toBe(0);
    await remote.send(media.session, ['mute']);
  });

  it('asks for the unlock of the phone once when the PC wants it; a dismissed prompt leaves Medien open', async () => {
    const { remote, hooks } = createFakeRemoteParts();
    hooks.setGrant('full', true);
    const media = await remote.open('media', nothing);
    expect(media).toMatchObject({ level: 'media', grant: 'full', unlockRequired: true });
    hooks.setUnlock('cancel');
    await expect(remote.open('full', nothing)).rejects.toThrow('unlock-cancelled');
    expect(hooks.level()).toBe('media');
    await remote.send(media.session, ['volume-up']);
    hooks.setUnlock('ok');
    const full = await remote.open('full', nothing);
    expect(full).toMatchObject({ level: 'full', noLock: false });
    await remote.close(full.session);
    // unlocked for this run: no second prompt
    const again = await remote.open('full', nothing);
    expect(again.level).toBe('full');
    expect(hooks.unlocks()).toBe(2);
  });

  it('a phone without a lock is not blocked, and says so', async () => {
    const { remote, hooks } = createFakeRemoteParts();
    hooks.setGrant('full', true);
    hooks.setUnlock('none');
    await remote.open('media', nothing);
    expect(await remote.open('full', nothing)).toMatchObject({ level: 'full', noLock: true });
  });

  it('a locked PC opens no mouse session, and Medien stays as it is', async () => {
    const { remote, hooks } = createFakeRemoteParts();
    hooks.setGrant('full', true);
    const media = await remote.open('media', nothing);
    hooks.setState({ locked: true });
    await expect(remote.open('full', nothing)).rejects.toThrow('locked');
    expect(hooks.unlocks()).toBe(0);
    expect(hooks.level()).toBe('media');
    await remote.send(media.session, ['volume-down']);
  });

  it('mouse actions need the mouse level and never reach a locked PC', async () => {
    const { remote, hooks } = createFakeRemoteParts();
    const media = await remote.open('media', nothing);
    await expect(remote.send(media.session, ['left-down'])).rejects.toThrow('bad-level');
    await expect(remote.pointer(media.session, 'move', 1, 1)).rejects.toThrow('bad-level');
    hooks.setGrant('full');
    await remote.open('media', nothing);
    const full = await remote.open('full', nothing);
    await remote.pointer(full.session, 'move', 5.7, -3.2);
    await remote.pointer(full.session, 'scroll', 0, 0);
    await remote.send(full.session, ['left-down', 'left-up']);
    expect(hooks.pointed()).toEqual([{ kind: 'move', dx: 5, dy: -3 }]);
    expect(hooks.sent()).toEqual(['left-down', 'left-up']);
    hooks.setState({ locked: true });
    await remote.pointer(full.session, 'move', 9, 9);
    // a locked PC gets no press – but the release always goes, so nothing stays held
    await remote.send(full.session, ['right-down', 'mute', 'left-up']);
    expect(hooks.pointed()).toHaveLength(1);
    expect(hooks.sent()).toEqual(['left-down', 'left-up', 'mute', 'left-up']);
    await expect(remote.pointer(full.session + 1, 'move', 1, 1)).rejects.toThrow('closed');
  });
});
