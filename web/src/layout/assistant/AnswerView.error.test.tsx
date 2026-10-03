// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { loadModuleStates } from '@/core/modules/activation';
import { AnswerView } from './AnswerView';

beforeEach(async () => {
  await db.table('_modules').clear();
});

describe('AnswerView errors', () => {
  it('offers to switch on the module the question needs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AnswerView
          response={{ ok: false, error: 'inactive-module', detail: 'lists' }}
          onDone={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ai-error')).toHaveTextContent('eingeschaltet sein');
    await user.click(screen.getByRole('button', { name: 'Modul „Listen“ einschalten' }));
    expect(await screen.findByText(/Eingeschaltet\. Stelle deine Frage/)).toBeInTheDocument();
    expect((await loadModuleStates()).lists).toBe(true);
    expect(screen.queryByRole('button', { name: /einschalten/ })).toBeNull();
  });

  it('shows plain errors without a button', () => {
    render(
      <MemoryRouter>
        <AnswerView response={{ ok: false, error: 'rate-limit' }} onDone={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
