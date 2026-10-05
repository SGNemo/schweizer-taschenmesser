// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_MODELS, type CatalogueModel } from '@/core/ai/local/catalogue';
import { getLocalPrefs } from '@/core/ai/local/prefs';
import { useLocalModel } from '@/core/ai/local/state';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import { t } from '@/strings';
import { LocalModelSection } from './LocalModelSection';

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
  it('says so when the platform has no local model', async () => {
    render(<LocalModelSection models={[pinned]} />);
    expect(await screen.findByTestId('local-unavailable')).toHaveTextContent(
      l.unavailable.platform!,
    );
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
