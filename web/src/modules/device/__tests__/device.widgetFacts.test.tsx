// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createFakeSystem } from '@/core/platform/fakeSystem';
import type { PlatformKind, PlatformService } from '@/core/platform/types';
import { createWebPlatform } from '@/core/platform/web';
import { WidgetSizeContext } from '@/ui/widgets/size';
import DeviceWidget from '../widgets/DeviceWidget';

const system = createFakeSystem();

function platform(kind: PlatformKind): PlatformService {
  const web = createWebPlatform();
  return { ...web, kind, system: kind === 'desktop' ? system : web.system };
}

async function view(kind: PlatformKind) {
  setPlatform(platform(kind));
  const out = render(
    <MemoryRouter>
      <WidgetSizeContext.Provider value="s">
        <DeviceWidget />
      </WidgetSizeContext.Provider>
    </MemoryRouter>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return out;
}

afterEach(() => {
  setPlatform(undefined);
  vi.restoreAllMocks();
});

describe('device widget – core numbers', () => {
  it('PC: memory and uptime from one reading, no polling; never an address or a name', async () => {
    const info = vi.spyOn(system, 'info');
    const out = await view('desktop');
    expect(screen.getByTestId('device-widget-facts')).toHaveTextContent(
      'Arbeitsspeicher 59 % · läuft seit 3 Tagen, 5 Std.',
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(out.container.textContent).not.toMatch(/192\.168|Beispiel-WLAN|Lautsprecher/);
  });

  it('phone: the battery level and whether it charges', async () => {
    Object.defineProperty(navigator, 'getBattery', {
      configurable: true,
      value: async () => ({
        level: 0.77,
        charging: true,
        addEventListener() {},
        removeEventListener() {},
      }),
    });
    try {
      await view('android');
      expect(screen.getByTestId('device-widget-facts')).toHaveTextContent('Akku 77 % · lädt');
    } finally {
      delete (navigator as { getBattery?: unknown }).getBattery;
    }
  });

  it('browser: no line', async () => {
    await view('web');
    expect(screen.queryByTestId('device-widget-facts')).toBeNull();
  });
});
