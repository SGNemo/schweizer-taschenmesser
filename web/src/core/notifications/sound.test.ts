import { describe, expect, it, vi } from 'vitest';
import { playReminderTone, REMINDER_SOUNDS, SOUND_NOTES, toGain, type ToneDeps } from './sound';

const deps = (patch: Partial<ToneDeps> = {}): ToneDeps => ({
  visible: () => true,
  web: vi.fn(async () => true),
  native: vi.fn(async () => undefined),
  ...patch,
});

describe('the reminder tunes', () => {
  it('are short, gentle and within what the native player accepts', () => {
    expect(REMINDER_SOUNDS).toHaveLength(3);
    for (const sound of REMINDER_SOUNDS) {
      const notes = SOUND_NOTES[sound];
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.length).toBeLessThanOrEqual(8);
      for (const n of notes) {
        expect(n.hz).toBeGreaterThanOrEqual(100);
        expect(n.hz).toBeLessThanOrEqual(4000);
        expect(n.gain).toBeGreaterThan(0);
        expect(n.gain).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...notes.map((n) => n.atMs + n.durMs))).toBeLessThanOrEqual(1200);
    }
  });

  it('map the volume to a gentle curve', () => {
    expect(toGain(0)).toBe(0);
    expect(toGain(100)).toBe(1);
    expect(toGain(50)).toBeLessThan(0.5);
    expect(toGain(500)).toBe(1);
  });
});

describe('playReminderTone', () => {
  it('uses Web Audio while the window is visible and the context runs', async () => {
    const d = deps();
    expect(await playReminderTone('soft', 50, d)).toBe('web');
    expect(d.web).toHaveBeenCalledWith(SOUND_NOTES.soft, toGain(50));
    expect(d.native).not.toHaveBeenCalled();
  });

  it('hands over to the native player when the window is hidden (tray, behind a game)', async () => {
    const d = deps({ visible: () => false });
    expect(await playReminderTone('bell', 50, d)).toBe('native');
    expect(d.web).not.toHaveBeenCalled();
    expect(d.native).toHaveBeenCalledWith(SOUND_NOTES.bell, toGain(50));
  });

  it('hands over when the audio context stays suspended or fails', async () => {
    const suspended = deps({ web: vi.fn(async () => false) });
    expect(await playReminderTone('drop', 50, suspended)).toBe('native');
    const throwing = deps({
      web: vi.fn(async () => {
        throw new Error('blocked');
      }),
    });
    expect(await playReminderTone('drop', 50, throwing)).toBe('native');
  });

  it('is silent without a native player and never throws', async () => {
    expect(
      await playReminderTone('soft', 50, deps({ visible: () => false, native: undefined })),
    ).toBe('none');
    const failing = deps({
      visible: () => false,
      native: vi.fn(async () => {
        throw new Error('x');
      }),
    });
    expect(await playReminderTone('soft', 50, failing)).toBe('none');
  });

  it('plays nothing at volume zero', async () => {
    const d = deps();
    expect(await playReminderTone('soft', 0, d)).toBe('none');
    expect(d.web).not.toHaveBeenCalled();
    expect(d.native).not.toHaveBeenCalled();
  });
});
