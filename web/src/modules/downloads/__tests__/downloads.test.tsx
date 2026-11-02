// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import type { DownloadJob } from '@/core/platform/downloads';
import manifest from '../manifest';
import { formatBytes, isActive, percent } from '../lib/format';
import { useJobs } from '../store';
import RunningWidget from '../widgets/RunningWidget';

const job = (over: Partial<DownloadJob>): DownloadJob => ({
  id: 1,
  url: 'https://x.example.org/a.iso',
  fileName: 'a.iso',
  dir: 'C:\\Beispiel',
  state: 'running',
  done: 50,
  total: 100,
  limitBps: 0,
  speedBps: 2048,
  error: null,
  sha256: null,
  expectedHash: null,
  hashCheck: null,
  ...over,
});

const view = () =>
  render(
    <MemoryRouter>
      <RunningWidget />
    </MemoryRouter>,
  );

describe('downloads module', () => {
  beforeEach(() => useJobs.setState({ jobs: [] }));

  it('has a valid desktop-only manifest without data', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.platforms).toEqual(['desktop']);
    expect(manifest.dataApi).toBe(false);
    expect(manifest.aiSchema).toBeUndefined();
  });

  it('formats sizes and progress', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(percent(50, 200)).toBe(25);
    expect(percent(5, null)).toBe(0);
    expect(percent(500, 200)).toBe(100);
    expect(
      isActive('running') && isActive('paused') && !isActive('done') && !isActive('failed'),
    ).toBe(true);
  });

  it('widget: empty state offers to add a download', async () => {
    view();
    expect(await screen.findByRole('link', { name: /Download hinzufügen/ })).toBeInTheDocument();
  });

  it('widget: shows running and waiting jobs with context, not finished ones', async () => {
    useJobs.setState({
      jobs: [
        job({}),
        job({ id: 2, fileName: 'b.zip', state: 'paused' }),
        job({ id: 3, fileName: 'c.pdf', state: 'done' }),
      ],
    });
    view();
    expect(await screen.findByText('a.iso')).toBeInTheDocument();
    expect(screen.getByText('b.zip')).toBeInTheDocument();
    expect(screen.queryByText('c.pdf')).toBeNull();
    expect(screen.getByText('1 laufen · 1 warten oder sind pausiert')).toBeInTheDocument();
  });
});
