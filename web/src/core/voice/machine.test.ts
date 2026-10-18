import { describe, expect, it } from 'vitest';
import { IDLE, reduce, transcriptOf, type VoiceEvent, type VoiceState } from './machine';

const run = (events: VoiceEvent[], from: VoiceState = IDLE) => {
  let state = from;
  const delivered: string[] = [];
  for (const e of events) {
    const r = reduce(state, e);
    state = r.state;
    if (r.deliver) delivered.push(r.deliver);
  }
  return { state, delivered };
};

describe('voice state machine', () => {
  it('goes idle → listening → finishing → idle and delivers the text once', () => {
    const { state, delivered } = run([
      { type: 'start' },
      { type: 'result', final: 'offene Rechnungen', interim: 'diese' },
      { type: 'stop' },
      { type: 'result', final: 'offene Rechnungen diese Woche', interim: '' },
      { type: 'end' },
    ]);
    expect(state).toEqual(IDLE);
    expect(delivered).toEqual(['offene Rechnungen diese Woche']);
  });

  it('keeps text that was still interim when the engine ends', () => {
    expect(
      run([{ type: 'start' }, { type: 'result', final: '', interim: ' Hallo ' }, { type: 'end' }])
        .delivered,
    ).toEqual(['Hallo']);
    expect(transcriptOf({ final: 'a ', interim: ' b' })).toBe('a b');
  });

  it('ignores start while busy and results while idle', () => {
    const busy = run([
      { type: 'start' },
      { type: 'result', final: 'x', interim: '' },
      { type: 'start' },
    ]);
    expect(busy.state.final).toBe('x');
    expect(run([{ type: 'result', final: 'x', interim: '' }]).state).toEqual(IDLE);
  });

  it('cancel drops everything and delivers nothing', () => {
    const r = run([
      { type: 'start' },
      { type: 'result', final: 'weg', interim: '' },
      { type: 'cancel' },
      { type: 'end' },
    ]);
    expect(r.state).toEqual(IDLE);
    expect(r.delivered).toEqual([]);
  });

  it('an empty recording says "silent", never an error', () => {
    const r = run([{ type: 'start' }, { type: 'stop' }, { type: 'end' }]);
    expect(r.state).toEqual({ ...IDLE, notice: 'silent' });
    expect(r.delivered).toEqual([]);
  });

  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'denied'],
    ['no-speech', 'silent'],
    ['network', 'failed'],
    ['audio-capture', 'failed'],
    ['unavailable', 'failed'],
  ])('maps the engine error %s to the calm notice %s', (code, notice) => {
    const r = run([
      { type: 'start' },
      { type: 'result', final: 'x', interim: '' },
      { type: 'error', code },
    ]);
    expect(r.state).toEqual({ ...IDLE, notice });
    expect(r.delivered).toEqual([]);
  });

  it('an abort error is not shown to anyone', () => {
    expect(run([{ type: 'start' }, { type: 'error', code: 'aborted' }]).state).toEqual(IDLE);
  });

  it('a new start clears the old notice', () => {
    const r = run([{ type: 'start' }], { ...IDLE, notice: 'failed' });
    expect(r.state.notice).toBeUndefined();
  });
});
