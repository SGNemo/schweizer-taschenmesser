import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  setEnabled: vi.fn(async () => undefined),
  stored: undefined as undefined | { enabled: boolean },
  side: 'pc' as 'pc' | 'phone',
}));
vi.mock('@/core/platform', () => ({
  getPlatform: () => ({ exchange: { side: fake.side, setEnabled: fake.setEnabled } }),
}));
vi.mock('@/core/modules/activation', () => ({
  loadStoredModuleState: async () => fake.stored,
}));

import off from '../servicesOff';

// E3 (launch review 2026-11): the module stored as off reaches the PC's native switch.
describe('exchange servicesOff', () => {
  beforeEach(() => {
    fake.setEnabled.mockClear();
    fake.side = 'pc';
  });

  it('switches the PC side off when the module is stored as off', async () => {
    fake.stored = { enabled: false };
    await off();
    expect(fake.setEnabled).toHaveBeenCalledWith(false);
  });

  it('leaves it alone in safe mode (stored on) and on the phone', async () => {
    fake.stored = { enabled: true };
    await off();
    fake.stored = { enabled: false };
    fake.side = 'phone';
    await off();
    expect(fake.setEnabled).not.toHaveBeenCalled();
  });
});
