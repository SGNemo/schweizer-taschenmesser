// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { ConnectorCard } from '@/pages/settings/ConnectorsSection';
import google from './index';

const READ = 'https://www.googleapis.com/auth/gmail.readonly';
const MODIFY = 'https://www.googleapis.com/auth/gmail.modify';
const SEND = 'https://www.googleapis.com/auth/gmail.send';

describe('Google features and their scopes', () => {
  it('reading is the default; managing and sending are separate, off by default, one scope each', () => {
    const byId = Object.fromEntries(google.features.map((f) => [f.id, f]));
    expect(byId.mail!.scopes).toEqual([READ]);
    expect(byId['mail-modify']).toMatchObject({ scopes: [MODIFY], defaultOn: false });
    expect(byId['mail-send']).toMatchObject({ scopes: [SEND], defaultOn: false });
    // what a fresh card asks for: no write scope in it
    const defaults = google.features.filter((f) => f.defaultOn !== false).flatMap((f) => f.scopes);
    expect(defaults).toContain(READ);
    expect(defaults).not.toContain(MODIFY);
    expect(defaults).not.toContain(SEND);
  });

  it('every write permission comes with its own explanation', () => {
    for (const id of ['mail-modify', 'mail-send']) {
      const f = google.features.find((x) => x.id === id)!;
      expect(f.label.length).toBeGreaterThan(3);
      expect(f.description.length).toBeGreaterThan(60);
    }
  });
});

describe('Settings → Verbindungen shows them as separate choices', () => {
  beforeEach(() => {
    const web = createWebPlatform();
    setPlatform({
      ...web,
      kind: 'desktop',
      isNative: true,
      oauth: { ...web.oauth, supported: true },
    } as PlatformService);
  });
  afterEach(() => setPlatform(undefined));

  it('three mail/calendar boxes; the write ones are not ticked, with their explanation', async () => {
    render(<ConnectorCard def={google} />);
    const manage = await screen.findByRole('checkbox', { name: /^E-Mails verwalten –/ });
    const send = screen.getByRole('checkbox', { name: /^E-Mails senden –/ });
    expect(manage).not.toBeChecked();
    expect(send).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^E-Mails –/ })).toBeChecked();
    expect(manage.closest('label')).toHaveTextContent(/jedes Mal erst nach deiner Bestätigung/);
    expect(send.closest('label')).toHaveTextContent(/nur wenn du „Senden“ bestätigst/);
  });
});
