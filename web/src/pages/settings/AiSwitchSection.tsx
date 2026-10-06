import { useState } from 'react';
import { switchAiOff, switchAiOn, useAiOffScope } from '@/core/ai/switch';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Segmented, SettingRow, SettingsGroup } from '@/ui';

type Scope = 'device' | 'all';

/** Master switch "KI abschalten": on top of Settings → KI; when AI is off it is the only section left. */
export function AiSwitchSection() {
  const o = t.ai.off;
  const off = useAiOffScope();
  const toast = useUiStore((s) => s.toast);
  const [scope, setScope] = useState<Scope>('device');
  const [confirm, setConfirm] = useState(false);

  if (off) {
    return (
      <SettingsGroup id="ai-switch" title={o.isOff}>
        <SettingRow
          id="ai-switch--off"
          label={o.isOff}
          description={off === 'all' ? o.isOffAll : o.isOffDevice}
        >
          <Button
            variant="primary"
            data-testid="ai-on"
            onClick={() => void switchAiOn().then(() => toast(o.toastOn))}
          >
            {o.on}
          </Button>
        </SettingRow>
        <p>{o.onHint}</p>
      </SettingsGroup>
    );
  }
  return (
    <SettingsGroup id="ai-switch" title={o.title}>
      <SettingRow id="ai-switch--scope" label={o.scope} description={o.scopeHint}>
        <Segmented<Scope>
          label={o.scope}
          value={scope}
          options={(['device', 'all'] as const).map((v) => ({
            value: v,
            label: o.scopeOptions[v],
          }))}
          onChange={setScope}
        />
      </SettingRow>
      <SettingRow id="ai-switch--off" label={o.switchLabel} description={o.hint}>
        <Button variant="danger" data-testid="ai-off" onClick={() => setConfirm(true)}>
          {o.confirm}
        </Button>
      </SettingRow>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={o.confirmTitle}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{t.actions.cancel}</Button>
            <Button
              variant="danger"
              data-testid="ai-off-confirm"
              onClick={() =>
                void switchAiOff(scope).then(() => {
                  setConfirm(false);
                  toast(o.toastOff);
                })
              }
            >
              {o.confirm}
            </Button>
          </>
        }
      >
        <p>{o.confirmText}</p>
      </Dialog>
    </SettingsGroup>
  );
}
