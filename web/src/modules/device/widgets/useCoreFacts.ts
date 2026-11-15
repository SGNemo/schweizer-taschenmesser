import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { percentOf, uptimeParts } from '../system';
import { usePhoneBattery } from '../useLive';

/**
 * The widget's core numbers in one line: memory and uptime on the PC, the battery on the phone. The PC is read once
 * when the widget mounts and again when the window shows after being hidden – never polled (the page does the live
 * part). Nothing else is read; the browser has no line.
 */
export function useCoreFacts(): string | null {
  const platform = getPlatform();
  const pc = platform.kind === 'desktop' && platform.system.supported;
  const phone = platform.kind === 'android';
  const battery = usePhoneBattery(phone);
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (!pc) return;
    let alive = true;
    const read = () => {
      if (document.hidden) return;
      platform.system.info().then(
        (info) => {
          if (!alive) return;
          const up = uptimeParts(info.uptimeSecs);
          setLine(
            [
              t.device.widget.memory(percentOf(info.memory.usedBytes, info.memory.totalBytes)),
              t.device.widget.uptime(t.device.live.uptimeValue(up.days, up.hours, up.minutes)),
            ].join(' · '),
          );
        },
        () => undefined,
      );
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', read);
    };
    // One platform per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc]);
  if (phone)
    return battery
      ? [t.device.widget.battery(battery.percent), battery.charging ? t.device.widget.charging : '']
          .filter(Boolean)
          .join(' · ')
      : null;
  return line;
}
