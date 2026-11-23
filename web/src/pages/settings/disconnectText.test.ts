import { describe, expect, it } from 'vitest';
import { connectors } from '@/core/connectors/registry';
import { t } from '@/strings';
import { disconnectChoices, disconnectText } from './disconnectText';

// M7 (launch review 2026-11): Spotify has no revoke endpoint, so "Trennen" cannot withdraw the
// app's access there; the dialog must not say it does, and names where to remove it instead.
describe('disconnect dialog text', () => {
  const def = (id: string) => connectors.find((c) => c.id === id)!;

  it('says access is revoked only where the service has a revoke endpoint', () => {
    expect(disconnectText(def('google'))).toBe(t.connectors.disconnectBody);
    expect(disconnectText(def('spotify'))).toBe(t.connectors.disconnectBodyNoRevoke);
    expect(t.connectors.disconnectBodyNoRevoke).not.toMatch(/widerrufen/);
  });
});

// A connector without a calendar (Spotify) has no imported events: its dialog offers a plain
// "Trennen", not "Übernommene Termine behalten / löschen".
describe('disconnect dialog choices', () => {
  const def = (id: string) => connectors.find((c) => c.id === id)!;

  it('offers keep/delete only where events were imported', () => {
    expect(disconnectChoices(def('google'))).toEqual(['keep', 'delete']);
    expect(disconnectChoices(def('spotify'))).toEqual(['plain']);
  });
});
