import { describe, expect, it } from 'vitest';
import {
  createFrameCollector,
  FRAME_CHARS,
  MANY_FRAMES,
  parseFrame,
  splitIntoFrames,
} from './frames';

const text = JSON.stringify({ a: 'Schöne Grüße ✓', blob: 'x'.repeat(3000) });

describe('QR frames', () => {
  it('cut a text into numbered frames that are small enough to scan', () => {
    const frames = splitIntoFrames(text, 'abc123');
    expect(frames.length).toBeGreaterThan(5);
    frames.forEach((f, i) => {
      expect(f.startsWith(`NSH1.abc123.${i + 1}.${frames.length}.`)).toBe(true);
      expect(f.length).toBeLessThan(FRAME_CHARS + 30);
    });
    expect(parseFrame(frames[0]!)).toMatchObject({ session: 'abc123', index: 1 });
    expect(MANY_FRAMES).toBeGreaterThan(frames.length);
  });

  it('are put back together in any order, with repeats, umlauts included', () => {
    const frames = splitIntoFrames(text, 'abc123');
    const collector = createFrameCollector();
    const shuffled = [...frames].reverse();
    let last = collector.add(shuffled[0]!);
    expect(last).toMatchObject({ state: 'collecting', have: 1 });
    expect(collector.add(shuffled[0]!)).toMatchObject({ state: 'collecting', have: 1 }); // repeat
    for (const f of shuffled.slice(1)) last = collector.add(f);
    expect(last).toEqual({ state: 'done', text });
  });

  it('get a session from the CSPRNG that the frame format accepts', () => {
    const a = splitIntoFrames('x');
    const b = splitIntoFrames('x');
    expect(a[0]).toMatch(/^NSH1\.[0-9a-f]{6}\.1\.1\./);
    expect(a[0]).not.toEqual(b[0]);
  });

  it('can be reset after a damaged result and then collect a fresh run', () => {
    const collector = createFrameCollector();
    const good = splitIntoFrames('again'.repeat(300), 'abc123');
    // Same session and total, but one chunk cut mid-way: everything is there, nothing fits.
    const damaged = good.map((f, i) => (i === 0 ? f.slice(0, -3) : f));
    let last;
    for (const f of damaged) last = collector.add(f);
    expect(last).toEqual({ state: 'broken' });
    collector.reset();
    for (const f of good) last = collector.add(f);
    expect(last).toEqual({ state: 'done', text: 'again'.repeat(300) });
  });

  it('ignore other codes and restart when a new session begins', () => {
    const a = splitIntoFrames('first text '.repeat(200), 'aaaaaa');
    const b = splitIntoFrames('second text '.repeat(200), 'bbbbbb');
    const collector = createFrameCollector();
    expect(collector.add('https://example.test')).toEqual({ state: 'ignored' });
    expect(collector.add('NSH1.broken')).toEqual({ state: 'ignored' });
    collector.add(a[0]!);
    expect(collector.add(b[0]!)).toMatchObject({ state: 'collecting', have: 1 });
    let last = collector.add(b[0]!);
    for (const f of b.slice(1)) last = collector.add(f);
    expect(last).toEqual({ state: 'done', text: 'second text '.repeat(200) });
  });

  it('report a damaged result instead of a wrong text', () => {
    const frames = splitIntoFrames('hello'.repeat(300), 'abc123');
    const damaged = frames.map((f, i) => (i === 0 ? f.replace(/\.[^.]*$/, '.@@@') : f));
    const collector = createFrameCollector();
    // "@" is not base64url: the frame is not even recognised as one of ours.
    expect(collector.add(damaged[0]!)).toEqual({ state: 'ignored' });
    const mixed = splitIntoFrames('x', 'abc123');
    expect(mixed).toHaveLength(1);
    expect(collector.add(mixed[0]!)).toEqual({ state: 'done', text: 'x' });
  });
});
