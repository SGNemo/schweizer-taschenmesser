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

describe('MapsHead (identity v3.1 G11)', () => {
  it('shows the count with the last place and one tile per category beside the pin plate', () => {
    render(
      <Head>
        <MapsHead
          count={5}
          last="Wochenmarkt"
          tiles={[
            { key: 'food', value: '3', label: 'Essen' },
            { key: 'shop', value: '2', label: 'Einkaufen' },
          ]}
        />
      </Head>,
    );
    expect(screen.getByTestId('figure')).toHaveTextContent('5');
    expect(screen.getByText('Zuletzt gespeichert: Wochenmarkt')).toBeVisible();
    const slot = screen.getByTestId('signature');
    expect(slot.querySelector('[data-signature="pin"]')).toHaveAttribute('aria-hidden', 'true');
    expect(slot.querySelectorAll('[data-body="kacheln"] li')).toHaveLength(2);
    expect(slot).toHaveTextContent('Einkaufen');
  });
  it('says so calmly when nothing is saved', () => {
    render(
      <Head>
        <MapsHead count={0} tiles={[]} />
      </Head>,
    );
    expect(screen.getByText('Noch kein Ort gespeichert.')).toBeVisible();
    expect(screen.getByTestId('signature').querySelector('[data-body="kacheln"]')).toBeNull();
  });
});
