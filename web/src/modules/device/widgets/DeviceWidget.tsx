import { useDeviceLines } from '@/core/status/lines';
import { needingLook, summaryText } from '@/core/status/summary';
import { t } from '@/strings';
import { StatusWidget } from '@/ui';

/**
 * How this device is doing, in one sentence (catalogue type: status). It shows the words of the states only, never
 * an address, a device name or a path; the widget's header leads to the page.
 */
export default function DeviceWidget() {
  const { sync, backup, updates, storage } = useDeviceLines();
  const counted = [sync, backup, updates, storage];
  const look = needingLook(counted).length > 0;
  return (
    <StatusWidget
      icon={look ? 'alert' : 'ok'}
      state={summaryText(counted)}
      hint={t.device.widget.hint(backup.status, sync.status)}
      tone={look ? 'warning' : 'neutral'}
    />
  );
}
