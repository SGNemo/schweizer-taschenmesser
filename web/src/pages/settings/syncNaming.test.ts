import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { tSettingsConnect } from '@/strings.settingsConnect';

describe('one word per thing in Sync & Backup (D12)', () => {
  it('the server step names the token like its field', () => {
    expect(tSettingsConnect.get().sync.stepServerHint).toContain(t.sync.token);
  });
});
