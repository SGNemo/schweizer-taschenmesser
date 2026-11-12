// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { HeroContext, type HeroTargets } from '@/core/shell/heroContext';
import { MapsHead } from '../components/MapsHead';

afterEach(cleanup);

/** A minimal head: the figure and signature slots as real elements the page portals into. */
function Head({ children }: { children: ReactNode }) {
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const [signature, setSignature] = useState<HTMLElement | null>(null);
  const targets: HeroTargets = {
    notice: null,
    backdrop: null,
    title: null,
    actions: null,
    tabs: null,
    extra: null,
    figure,
    signature,
  };
  return (
    <HeroContext.Provider value={targets}>
      <div data-testid="figure" ref={setFigure} />
      <div data-testid="signature" ref={setSignature} />
      {children}
    </HeroContext.Provider>
  );
}

describe('MapsHead (Identity 4.0, package 0b-4b)', () => {
  it('shows the count with the last place; the signature slot stays empty (no plate, no tiles)', () => {
    render(
      <Head>
        <MapsHead count={5} last="Wochenmarkt" />
      </Head>,
    );
    expect(screen.getByTestId('figure')).toHaveTextContent('5');
    expect(screen.getByText('Zuletzt gespeichert: Wochenmarkt')).toBeVisible();
    expect(screen.getByTestId('signature')).toBeEmptyDOMElement();
  });
  it('says so calmly when nothing is saved', () => {
    render(
      <Head>
        <MapsHead count={0} />
      </Head>,
    );
    expect(screen.getByText('Noch kein Ort gespeichert.')).toBeVisible();
    expect(screen.getByTestId('signature')).toBeEmptyDOMElement();
  });
});
