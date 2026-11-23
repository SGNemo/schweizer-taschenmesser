// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { lockScreenContent } from '@/core/notifications/lockScreen';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { t } from '@/strings';
import { NotificationsSection } from './NotificationsSection';

// NS6 (launch review 2026-11): the phone hides a reminder's text on the lock screen unless the
// user turns this switch on; it is off by default and only exists in the Android app.
afterEach(() => {
  setPlatform(undefined);
  localStorage.clear();
});

describe('notifications: content on the lock screen', () => {
  it('Android: off by default, the switch turns it on for this device', async () => {
    setPlatform({ ...createWebPlatform(), kind: 'android', isNative: true });
    render(<NotificationsSection />);
    const toggle = screen.getByRole('switch', { name: t.notifications.lockScreen });
    expect(toggle).not.toBeChecked();
    expect(lockScreenContent()).toBe(false);
    await userEvent.click(toggle);
    expect(lockScreenContent()).toBe(true);
    expect(screen.getByRole('switch', { name: t.notifications.lockScreen })).toBeChecked();
  });

  it('not offered on the desktop or in the browser', () => {
    setPlatform(createWebPlatform());
    render(<NotificationsSection />);
    expect(screen.queryByRole('switch', { name: t.notifications.lockScreen })).toBeNull();
  });
});
