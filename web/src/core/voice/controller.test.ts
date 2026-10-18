import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setNow } from '@/core/time/now';
import { createVoiceController, HOLD_MS } from './controller';
import type { RecognitionEventLike, RecognitionLike } from './support';

class FakeRecognition implements RecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: RecognitionLike['onresult'] = null;
  onerror: RecognitionLike['onerror'] = null;
  onend: RecognitionLike['onend'] = null;
  calls: string[] = [];
  failStart = false;
  start() {
    if (this.failStart) throw new Error('InvalidStateError');
    this.calls.push('start');
  }
  stop() {
    this.calls.push('stop');
  }
  abort() {
    this.calls.push('abort');
  }
  say(parts: [string, boolean][]) {
    const results = parts.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } }));
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign(results, { length: results.length }),
    } as RecognitionEventLike);
  }
}

let clock: number;
let made: FakeRecognition[];
let texts: string[];
let available = true;
let failStart = false;

const make = () =>
  createVoiceController({
    create: () => {
      if (!available) return undefined;
      const r = new FakeRecognition();
      r.failStart = failStart;
      made.push(r);
      return r;
    },
    lang: () => 'de-DE',
    onTranscript: (t) => texts.push(t),
  });

beforeEach(() => {
  clock = 1_000;
  setNow(() => clock);
  made = [];
  texts = [];
  available = true;
  failStart = false;
});
afterEach(() => setNow());

describe('voice controller', () => {
  it('configures the engine with the given language, continuous and interim results', () => {
    const c = make();
    c.toggle();
    expect(made[0]).toMatchObject({ lang: 'de-DE', continuous: true, interimResults: true });
    expect(c.getState().phase).toBe('listening');
  });

  it('push-to-talk: a long hold stops on release and delivers the text', () => {
    const c = make();
    c.press();
    made[0]!.say([['Termin morgen', true]]);
    clock += HOLD_MS + 50;
    c.release();
    expect(c.getState().phase).toBe('finishing');
    expect(made[0]!.calls).toEqual(['start', 'stop']);
    made[0]!.onend?.();
    expect(texts).toEqual(['Termin morgen']);
    expect(c.getState().phase).toBe('idle');
  });

  it('a short tap keeps listening; the next press finishes', () => {
    const c = make();
    c.press();
    clock += 100;
    c.release();
    expect(c.getState().phase).toBe('listening');
    c.press();
    expect(c.getState().phase).toBe('finishing');
    c.release(); // the release of the second press changes nothing
    expect(made[0]!.calls).toEqual(['start', 'stop']);
  });

  it('toggle (button, global key) starts and stops', () => {
    const c = make();
    c.toggle();
    c.toggle();
    expect(c.getState().phase).toBe('finishing');
    made[0]!.say([['Hallo', false]]);
    made[0]!.onend?.();
    expect(texts).toEqual(['Hallo']);
  });

  it('Esc (cancel) aborts without delivering, even if the engine still ends', () => {
    const c = make();
    c.toggle();
    made[0]!.say([['nicht übernehmen', true]]);
    const first = made[0]!;
    c.cancel();
    expect(c.getState().phase).toBe('idle');
    expect(first.calls).toContain('abort');
    first.onend?.();
    expect(texts).toEqual([]);
  });

  it('a late end of a cancelled recording does not touch the next one', () => {
    const c = make();
    c.toggle();
    const first = made[0]!;
    c.cancel();
    c.toggle();
    first.onend?.();
    expect(c.getState().phase).toBe('listening');
  });

  it('where there is no engine it only reports a calm notice', () => {
    available = false;
    const c = make();
    c.toggle();
    expect(c.getState()).toMatchObject({ phase: 'idle', notice: 'failed' });
  });

  it('a start that throws ends in a notice, not an exception', () => {
    failStart = true;
    const c = make();
    expect(() => c.toggle()).not.toThrow();
    expect(c.getState()).toMatchObject({ phase: 'idle', notice: 'failed' });
  });

  it('maps a permission error to "denied" and stops the engine', () => {
    const c = make();
    c.toggle();
    made[0]!.onerror?.({ error: 'not-allowed' });
    expect(c.getState()).toMatchObject({ phase: 'idle', notice: 'denied' });
    expect(texts).toEqual([]);
  });

  it('tells subscribers about every change', () => {
    const c = make();
    const seen: string[] = [];
    const off = c.subscribe((s) => seen.push(s.phase));
    c.toggle();
    c.cancel();
    off();
    c.toggle();
    expect(seen).toEqual(['listening', 'idle']);
  });
});
