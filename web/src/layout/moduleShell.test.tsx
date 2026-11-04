// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PageHeader } from '@/ui';
import { COMPACT_HEADS, HEAD_VARIANTS, headHeight } from '@/core/modules/types';
import { HeroSlot } from '@/ui/identity';
import { AreaFrame } from './AreaFrame';

function page(path: string, content = <PageHeader title="Finanzen" />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AreaFrame>{content}</AreaFrame>
    </MemoryRouter>,
  );
}

describe('module frame (hero)', () => {
  it('carries the manifest identity as data attributes (hue, head variant, height, area, signature)', async () => {
    page('/finance');
    const frame = await screen.findByTestId('module-frame');
    expect(frame).toHaveAttribute('data-hue', 'teal');
    expect(frame).toHaveAttribute('data-head', 'kennzahl');
    expect(frame).toHaveAttribute('data-size', 'hero');
    expect(frame).toHaveAttribute('data-area', 'money');
    expect(frame).toHaveAttribute('data-signature', 'bankCard');
    expect(frame).not.toHaveAttribute('data-surface');
  });

  it('the frame names the head variant and its height class (modules that are on by default)', async () => {
    for (const [path, head, size] of [
      ['/todos', 'fokus', 'compact'],
      ['/calendar', 'zeit', 'hero'],
      ['/weather', 'himmel', 'hero'],
    ] as const) {
      const { unmount } = page(path);
      const frame = await screen.findByTestId('module-frame');
      expect(frame, path).toHaveAttribute('data-head', head);
      expect(frame, path).toHaveAttribute('data-size', size);
      unmount();
    }
  });

  it('three head variants are a slim bar, the others a hero', () => {
    expect(COMPACT_HEADS).toEqual(['tresor', 'schreib', 'fokus']);
    for (const v of HEAD_VARIANTS)
      expect(headHeight(v)).toBe(COMPACT_HEADS.includes(v) ? 'compact' : 'hero');
  });

  it('the other modules of the area are a sub-navigation under the head, not tabs inside it', async () => {
    page('/finance');
    const frame = await screen.findByTestId('module-frame');
    const nav = await screen.findByRole('navigation', { name: 'Geld: Module' });
    expect(frame.contains(nav)).toBe(false);
    expect(within(nav).getByRole('link', { name: 'Finanzen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getAllByRole('link').length).toBeGreaterThan(1);
  });

  it('the page title (h1) renders inside the head, exactly once', async () => {
    page('/finance');
    const frame = await screen.findByTestId('module-frame');
    const h1 = await within(frame).findByRole('heading', { level: 1, name: 'Finanzen' });
    expect(h1).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('views and actions of PageHeader stay below the head, in the page', async () => {
    page(
      '/finance',
      <PageHeader title="Finanzen" views={<button type="button">Ansicht</button>}>
        <button type="button">Neu</button>
      </PageHeader>,
    );
    const frame = await screen.findByTestId('module-frame');
    await within(frame).findByRole('heading', { level: 1 });
    expect(within(frame).queryByRole('button', { name: 'Ansicht' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ansicht' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Neu' })).toBeVisible();
  });

  it('HeroSlot content lands in the head, beside the title', async () => {
    page(
      '/finance',
      <>
        <PageHeader title="Finanzen" />
        <HeroSlot>
          <span data-testid="signature">Karte</span>
        </HeroSlot>
      </>,
    );
    const frame = await screen.findByTestId('module-frame');
    expect(await within(frame).findByTestId('signature')).toBeVisible();
  });

  it('the calendar module shows today as a day block with the hours of the day', async () => {
    page('/calendar', <PageHeader title="Kalender" />);
    const frame = await screen.findByTestId('module-frame');
    expect(await within(frame).findByTestId('day-block')).toBeVisible();
    expect(await within(frame).findByTestId('hour-strip')).toBeVisible();
  });

  it('outside a module page the title stays where it is (no head around it)', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AreaFrame>
          <PageHeader title="Einstellungen" />
        </AreaFrame>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('module-frame')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  });

  it('PageHeader without any shell (dialogs, tests) renders its h1 in place', () => {
    render(<PageHeader title="Allein" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Allein' })).toBeVisible();
    act(() => undefined);
  });
});
