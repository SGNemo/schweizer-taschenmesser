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

/** A minimal head: the figure, signature and strip slots as real elements the page portals into. */
function Head({ children }: { children: ReactNode }) {
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  const [signature, setSignature] = useState<HTMLElement | null>(null);
  const [extra, setExtra] = useState<HTMLElement | null>(null);
  const targets: HeroTargets = {
    notice: null,
    backdrop: null,
    title: null,
    actions: null,
    tabs: null,
    extra,
    figure,
    signature,
  };
  return (
    <HeroContext.Provider value={targets}>
      <div data-testid="figure" ref={setFigure} />
      <div data-testid="signature" ref={setSignature} />
      <div data-testid="extra" ref={setExtra} />
      {children}
    </HeroContext.Provider>
  );
}

describe('Dieser PC head (Identity 4.0)', () => {
  it('shows one figure, the used space of the system drive, named by the drive; nothing under the head', () => {
    const drives = [drive('D:\\', 2000, 1300), drive('C:\\', 476.8, 38.2, true)];
    render(
      <Head>
        <DiskHead drives={drives} />
      </Head>,
    );
    const figure = screen.getByTestId('figure');
    expect(figure).toHaveTextContent('C:\\ (System)');
    expect(screen.getByTestId('disk-head-used')).toHaveTextContent('438,6');
    // The ring strip and the context line are gone: the drive cards say total, free space, state and last scan.
    expect(screen.getByTestId('signature')).toBeEmptyDOMElement();
    expect(screen.getByTestId('extra')).toBeEmptyDOMElement();
  });

  it('draws nothing before the first reading', () => {
    render(
      <Head>
        <DiskHead drives={null} />
      </Head>,
    );
    expect(screen.getByTestId('figure')).toBeEmptyDOMElement();
    expect(screen.getByTestId('signature')).toBeEmptyDOMElement();
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
