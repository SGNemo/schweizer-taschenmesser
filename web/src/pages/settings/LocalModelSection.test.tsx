// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_MODELS, type CatalogueModel } from '@/core/ai/local/catalogue';
import { getLocalPrefs } from '@/core/ai/local/prefs';
import { useLocalModel } from '@/core/ai/local/state';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import type * as BuildInfo from '@/core/update/buildInfo';
import { t } from '@/strings';
import { LocalModelSection } from './LocalModelSection';

// The Dev-Preview flavour: a desktop build without the model must say "Testversion", not "built without".
vi.mock('@/core/update/buildInfo', async (original) => ({
  ...(await original<typeof BuildInfo>()),
  BUILD_CHANNEL: 'dev',
}));

const l = t.ai.local;
const pinned: CatalogueModel = {
  ...LOCAL_MODELS[0]!,
  id: 'test-model',
  label: 'Testmodell',
  file: 'test-model-q4.gguf',
  revision: 'a'.repeat(40),
  sha256: 'b'.repeat(64),
  bytes: 2 * 1024 ** 3,
};
const unpinned: CatalogueModel = { ...pinned, id: 'unpinned', file: 'x.gguf', sha256: null };

function install(options: Parameters<typeof createFakeLocalModel>[0] = {}) {
  const fake = createFakeLocalModel(options);
  setPlatform({ ...createWebPlatform(), localModel: fake });
  return fake;
}

beforeEach(() => {
  localStorage.clear();
  useLocalModel.setState({
    status: undefined,
    busy: undefined,
    progress: undefined,
    error: undefined,
  });
});
afterEach(() => setPlatform(undefined));

describe('LocalModelSection', () => {
  it('says so in the browser, without a link to another download', async () => {
    render(<LocalModelSection models={[pinned]} />);
    expect(await screen.findByTestId('local-unavailable')).toHaveTextContent(
      l.unavailable.browser!,
    );
    expect(screen.queryByTestId('local-get-stable')).toBeNull();
  });

  it('tells the Dev-Preview without the model where to get it', async () => {
    const fake = createFakeLocalModel();
    const openUrl = vi.fn(async () => undefined);
    const web = createWebPlatform();
    setPlatform({
      ...web,
      kind: 'desktop',
      app: { ...web.app, openUrl },
      localModel: {
        ...fake,
        status: async () => ({ unavailable: 'build', models: [], devices: [] }),
      },
    });
    const user = userEvent.setup();
    render(<LocalModelSection models={[pinned]} />);
    expect(await screen.findByTestId('local-unavailable')).toHaveTextContent(
      l.unavailable.testBuild!,
    );
    await user.click(screen.getByTestId('local-get-stable'));
    expect(openUrl).toHaveBeenCalledWith(expect.stringMatching(/\/releases\/latest$/));
  });

  it('offers two or three models with their size as the next step', async () => {
    install();
    const models = [
      pinned,
      { ...pinned, id: 'b', file: 'b.gguf' },
      { ...pinned, id: 'c', file: 'c.gguf' },
      { ...pinned, id: 'd', file: 'd.gguf' },
      { ...pinned, id: 'light', file: 'l.gguf', profile: 'light' as const },
    ];
    render(<LocalModelSection models={models} />);
    const next = await screen.findByTestId('local-suggestions');
    expect(within(next).getAllByRole('listitem')).toHaveLength(3);
    expect(next).toHaveTextContent(l.size('2,00'));
    expect(screen.getByText(l.next.pick)).toBeInTheDocument();
  });

  it('a new download replaces a chosen model whose file is gone', async () => {
    install();
    const { writeLocalPrefs } = await import('@/core/ai/local/prefs');
    writeLocalPrefs({ file: 'cancelled-earlier.gguf' });
    const user = userEvent.setup();
    render(<LocalModelSection models={[pinned]} />);
    await user.click(await screen.findByTestId('local-next-download-test-model'));
    await user.click(screen.getByTestId('local-consent-confirm'));
    expect(await screen.findByText(l.next.ready)).toBeInTheDocument();
    expect(getLocalPrefs().file).toBe(pinned.file);
  });

  it('turns the next step into a test question once the model is there', async () => {
    install({ models: [{ file: pinned.file, bytes: pinned.bytes }] });
    localStorage.clear();
    const { writeLocalPrefs } = await import('@/core/ai/local/prefs');
    writeLocalPrefs({ file: pinned.file });
    render(<LocalModelSection models={[pinned]} />);
    expect(await screen.findByText(l.next.ready)).toBeInTheDocument();
    expect(screen.getByTestId('local-next-test')).toHaveTextContent(l.next.ask);
    expect(screen.queryByTestId('local-suggestions')).toBeNull();
  });

  it('locks the download of a model without a pinned checksum', async () => {
    install();
    render(<LocalModelSection models={[unpinned]} />);
    expect(await screen.findByTestId('local-download-unpinned')).toBeDisabled();
    expect(screen.getByText(l.noChecksum)).toBeInTheDocument();
  });

  it('downloads only after consent that shows size, source and checksum', async () => {
    const fake = install();
    const user = userEvent.setup();
    render(<LocalModelSection models={[pinned]} />);
    await user.click(await screen.findByTestId('local-download-test-model'));
    const facts = await screen.findByTestId('local-consent');
    expect(facts).toHaveTextContent(`huggingface.co/${pinned.repo}`);
    expect(facts).toHaveTextContent(pinned.sha256!);
    expect(fake.downloads).toEqual([]); // nothing before the click
    await user.click(screen.getByTestId('local-consent-confirm'));
    await waitFor(() => expect(fake.downloads).toEqual([pinned.file]));
    expect(await screen.findByRole('button', { name: l.remove })).toBeInTheDocument();
  });

  it('uses a downloaded model, loads and unloads it', async () => {
    install({ models: [{ file: pinned.file, bytes: pinned.bytes }] });
    const user = userEvent.setup();
    render(<LocalModelSection models={[pinned]} />);
    await user.click(await screen.findByRole('button', { name: l.use }));
    expect(getLocalPrefs().file).toBe(pinned.file);
    await user.click(await screen.findByTestId('local-load'));
    await user.click(await screen.findByRole('button', { name: l.unload }));
    expect(await screen.findByText(l.notLoaded)).toBeInTheDocument();
  });

  it('shows a failed download as a short German message and keeps nothing', async () => {
    install({ downloadError: 'checksum' });
    const user = userEvent.setup();
    render(<LocalModelSection models={[pinned]} />);
    await user.click(await screen.findByTestId('local-download-test-model'));
    await user.click(await screen.findByTestId('local-consent-confirm'));
    expect(await screen.findByTestId('local-error')).toHaveTextContent(l.errors.checksum!);
    expect(screen.queryByRole('button', { name: l.remove })).toBeNull();
  });
});
