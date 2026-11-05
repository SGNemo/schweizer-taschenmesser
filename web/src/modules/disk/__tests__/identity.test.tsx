// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { DriveInfo } from '@/core/platform/disk';
import { HeroContext, type HeroTargets } from '@/core/shell/heroContext';
import { t } from '@/strings';
import { FortschrittBody } from '@/ui';
import { DiskHead } from '../components/DiskHead';
import { headDrive } from '../logic/drives';

const GB = 1024 ** 3;
const drive = (root: string, totalGb: number, freeGb: number, isSystem = false): DriveInfo => ({
  root,
  label: isSystem ? 'System' : '',
  fileSystem: 'NTFS',
  kind: 'fixed',
  media: 'ssd',
  totalBytes: totalGb * GB,
  freeBytes: freeGb * GB,
  bus: 'nvme',
  model: '',
  isSystem,
  health: { status: 'ok', temperatureC: null, gap: null },
});

/** A minimal head: the figure and signature slots as real elements the page portals into. */
function Head({ children }: { children: ReactNode }) {
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const [signature, setSignature] = useState<HTMLElement | null>(null);
  const targets: HeroTargets = {
    notice: null,
    backdrop: null,
    title: null,
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

describe('Dieser PC head (identity v3.1 G01)', () => {
  it('speaks of the system drive, says "fast voll" on a warning badge and keeps every ring in the hue', () => {
    const drives = [drive('D:\\', 2000, 1300), drive('C:\\', 476.8, 38.2, true)];
    render(
      <Head>
        <DiskHead drives={drives} />
      </Head>,
    );
    const figure = screen.getByTestId('figure');
    expect(figure).toHaveTextContent('C:\\ (System)');
    expect(screen.getByTestId('disk-head-used')).toHaveTextContent('438,6');
    const context = screen.getByTestId('disk-head-context');
    expect(context).toHaveTextContent(t.disk.free('38,2 GB'));
    expect(context).toHaveTextContent(t.disk.head.state.full!);
    expect(context).toHaveTextContent(t.disk.head.neverScanned);
    const rings = screen.getByTestId('disk-head-rings');
    expect(rings.querySelectorAll('li')).toHaveLength(2);
    // the state is a word, never the ring colour
    for (const r of rings.querySelectorAll('[data-level]'))
      expect(r.getAttribute('data-level')).toBe('ok');
  });

  it('draws the library gauges shape before the first reading', () => {
    render(
      <Head>
        <DiskHead drives={null} />
      </Head>,
    );
    expect(screen.getByTestId('figure')).toBeEmptyDOMElement();
    expect(
      screen.getByTestId('signature').querySelector('[data-signature="gauges"]'),
    ).not.toBeNull();
  });

  it('picks the system drive, else the first one', () => {
    expect(headDrive([drive('D:\\', 1, 1), drive('C:\\', 1, 1, true)])?.root).toBe('C:\\');
    expect(headDrive([drive('D:\\', 1, 1)])?.root).toBe('D:\\');
    expect(headDrive([])).toBeUndefined();
  });
});

describe('widget rings', () => {
  it('a nearly full drive keeps its ring in the module hue; the state is in the text', () => {
    const { container } = render(
      <FortschrittBody
        kind="rings"
        entries={[
          {
            key: 'C',
            title: 'C:\\',
            value: 92,
            max: 100,
            detail: `38,2 GB frei · ${t.disk.head.state.full}`,
          },
        ]}
      />,
    );
    expect(container.querySelector('[data-level]')?.getAttribute('data-level')).toBe('ok');
    expect(container).toHaveTextContent(t.disk.head.state.full!);
  });
});
