// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PinHead } from '../components/PinHead';

afterEach(cleanup);

describe('PinHead', () => {
  it('names the last saved place as text', () => {
    render(<PinHead last="Wochenmarkt" />);
    expect(screen.getByText('Zuletzt gespeichert: Wochenmarkt')).toBeVisible();
  });
  it('says so calmly when nothing is saved', () => {
    render(<PinHead />);
    expect(screen.getByText('Noch kein Ort gespeichert.')).toBeVisible();
  });
});
