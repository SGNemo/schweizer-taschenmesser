// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { useSyncStatus } from '@/core/sync/status';
import { WidgetSizeContext } from '@/ui/widgets/size';
import DeviceWidget from '../widgets/DeviceWidget';

async function view(size: 's' | 'l' = 's') {
  const out = render(
    <MemoryRouter>
      <WidgetSizeContext.Provider value={size}>
        <DeviceWidget />
      </WidgetSizeContext.Provider>
    </MemoryRouter>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return out;
}

afterEach(() => useSyncStatus.setState({ phase: 'off', server: undefined }));

describe('device widget (catalogue type: status)', () => {
  it('says "Nichts Dringendes" while nothing needs a look; it has no link of its own (the header leads to the page)', async () => {
    await view();
    expect(screen.getByText('Nichts Dringendes')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('names the one thing that needs a look, in words; size l adds the context line', async () => {
    useSyncStatus.setState({ phase: 'error', server: 'sync.canary-server.example' });
    const out = await view('l');
    expect(screen.getByText('Sync: Fehler beim Abgleich')).toBeInTheDocument();
    expect(screen.getByText(/^Kein Backup · Sync: Fehler beim Abgleich$/)).toBeInTheDocument();
    expect(out.container.innerHTML).not.toContain('canary-server');
  });
});
