import { describe, expect, it } from 'vitest';
import { fallbackPayload } from './pushPayload';

describe('fallback push body', () => {
  it('follows the device language among the active ones (German, English)', () => {
    expect(fallbackPayload(['de-AT']).body).toBe('Erinnerung');
    expect(fallbackPayload(['en-US']).body).toBe('Reminder');
    expect(fallbackPayload([]).body).toBe('Reminder');
  });

  it('shows English for a frozen language (es, fr, pt), like the app', () => {
    expect(fallbackPayload(['es-ES']).body).toBe('Reminder');
    expect(fallbackPayload(['fr-FR', 'de']).body).toBe('Erinnerung');
    expect(fallbackPayload(['pt-BR']).body).toBe('Reminder');
  });
});
