// @vitest-environment jsdom
/**
 * `PlanPanelHost` (planner hub 2, package 4a, hand-off 04 „Tests“): lazy, a boundary that keeps the sheet alive and
 * logs the module id and the error's name only, never for `accounts`, X5 while the module is off, the default panel
 * for a module without one.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearErrorLog, errorLog } from '@/core/diagnostics/errorLog';
import type { ModuleManifest, PlanPanelProps } from './types';

const state = vi.hoisted(() => ({
  manifests: [] as Partial<ModuleManifest>[],
  states: {} as Record<string, boolean> | undefined,
  loads: 0,
}));
vi.mock('./available', () => ({ availableManifests: () => state.manifests }));
vi.mock('./activation', () => ({ useModuleStates: () => state.states }));

const { PlanPageFoot, PlanPanelFoot, PlanPanelHost } = await import('./PlanPanelHost');

function Fine({ id }: PlanPanelProps) {
  return (
    <>
      <p>Panel für {id}</p>
      <PlanPanelFoot />
    </>
  );
}
function Throws(): never {
  const e = new Error('Geheimer Titel: Steuer 2026');
  e.name = 'TypeError';
  throw e;
}

const fine = () => {
  state.loads += 1;
  return Promise.resolve({ default: Fine });
};
const throws = () => Promise.resolve({ default: Throws as never });

const host = (moduleId: string) =>
  render(
    <MemoryRouter>
      <PlanPanelHost
        moduleId={moduleId}
        id="x1"
        to={`/${moduleId}?open=x1`}
        detail="Mahnung · bis Fr"
      />
      <p>Der Tag lebt</p>
    </MemoryRouter>,
  );

beforeEach(() => {
  state.loads = 0;
  state.states = { todos: true, broken: true, notes: true, accounts: true, off: false };
  state.manifests = [
    { id: 'todos', contributions: { planPanel: fine } },
    { id: 'broken', contributions: { planPanel: throws } },
    { id: 'notes', contributions: {} },
    { id: 'accounts', contributions: { planPanel: fine } },
    { id: 'off', contributions: { planPanel: fine } },
  ];
  clearErrorLog();
});
afterEach(() => vi.restoreAllMocks());

describe('PlanPanelHost', () => {
  it('mounts the module panel lazily, with „Ganz öffnen“ last', async () => {
    host('todos');
    expect(await screen.findByText('Panel für x1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeInTheDocument();
    expect(state.loads).toBe(1);
  });

  it('a throwing panel shows X7, the sheet lives, the log holds the module id and the error name only', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    host('broken');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Das hat nicht geklappt. Es ist nichts verändert.',
    );
    expect(screen.getByText('Der Tag lebt')).toBeInTheDocument();
    const entries = errorLog().filter((e) => e.source.startsWith('plan-panel'));
    expect(entries).toEqual([
      expect.objectContaining({ source: 'plan-panel-broken', message: 'TypeError' }),
    ]);
    expect(JSON.stringify(errorLog())).not.toContain('Steuer');
  });

  it('never mounts anything for `accounts` – not even the default panel', () => {
    const { container } = host('accounts');
    expect(container.textContent).toBe('Der Tag lebt');
    expect(state.loads).toBe(0);
  });

  it('a module that is off shows X5 and loads no code', () => {
    host('off');
    expect(screen.getByText('Auf diesem Gerät nicht verfügbar.')).toBeInTheDocument();
    expect(state.loads).toBe(0);
  });

  it('a module not in this build shows X5', () => {
    host('mail');
    expect(screen.getByText('Auf diesem Gerät nicht verfügbar.')).toBeInTheDocument();
  });

  it('a module without a panel gets the default: its detail and „Ganz öffnen“', () => {
    host('notes');
    expect(screen.getByText('Mahnung · bis Fr')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeInTheDocument();
  });
});

describe('PlanPageFoot', () => {
  it('mounts the strips of modules that are on, never for `accounts`', async () => {
    const strip = (text: string) => () => Promise.resolve({ default: () => <p>{text}</p> });
    state.manifests = [
      { id: 'mail', contributions: { planPageFoot: strip('Wird gesendet') } },
      { id: 'accounts', contributions: { planPageFoot: strip('Tresor') } },
      { id: 'off', contributions: { planPageFoot: strip('Aus') } },
    ];
    state.states = { mail: true, accounts: true, off: false };
    render(<PlanPageFoot />);
    expect(await screen.findByText('Wird gesendet')).toBeInTheDocument();
    expect(screen.queryByText('Tresor')).toBeNull();
    expect(screen.queryByText('Aus')).toBeNull();
  });
});
