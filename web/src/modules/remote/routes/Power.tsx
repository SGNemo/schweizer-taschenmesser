import { useLang } from '@/core/i18n/lang';
import type { RemotePowerVerb } from '@/core/remote/session';
import { t } from '@/strings';
import { Button, Dialog, Icon, type IconName } from '@/ui';
import { remoteSession, useRemotePower } from '../session';
import { POWER_KEY, powerText } from '../view';
import styles from '../remote.module.css';

const ICON: Record<RemotePowerVerb, IconName> = {
  'shut-down': 'power',
  restart: 'reset',
  sleep: 'moon',
  hibernate: 'disk',
  'sign-out': 'signOut',
};
/** The three everyday actions; hibernate and sign-out sit below them, quieter. */
const MAIN: readonly RemotePowerVerb[] = ['shut-down', 'restart', 'sleep'];

/**
 * "PC ausschalten …": the choice only. Choosing sends at once – the phone's own unlock prompt is
 * the confirmation, and the PC counts down 10 s where it can be cancelled. What follows is
 * `PowerStatus`, on the page.
 */
export function PowerSheet({
  open,
  onClose,
  hibernate,
}: {
  open: boolean;
  onClose: () => void;
  hibernate: boolean;
}) {
  const lang = useLang();
  const p = t.remote.power;
  const choose = (action: RemotePowerVerb) => {
    onClose();
    void remoteSession.powerAct(action, false, lang);
  };
  const quiet: RemotePowerVerb[] = hibernate ? ['hibernate', 'sign-out'] : ['sign-out'];
  return (
    <Dialog open={open} onClose={onClose} title={p.title}>
      <div className={styles.power}>
        <p className={styles.note}>{p.note}</p>
        <div className={styles.powerMain} role="group" aria-label={p.title}>
          {MAIN.map((action) => (
            <Button
              key={action}
              className={styles.powerKey}
              onClick={() => choose(action)}
              data-testid={`remote-power-${action}`}
            >
              <Icon name={ICON[action]} size={24} />
              <span>{p.action[POWER_KEY[action]]}</span>
            </Button>
          ))}
        </div>
        <div className={styles.powerMore} role="group" aria-label={p.more}>
          {quiet.map((action) => (
            <Button
              key={action}
              variant="ghost"
              onClick={() => choose(action)}
              data-testid={`remote-power-${action}`}
            >
              <Icon name={ICON[action]} />
              <span>{p.action[POWER_KEY[action]]}</span>
            </Button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Where power stands, as one still line with at most the one step it needs: while the PC counts
 * down only "Abbrechen"; Nemo busy at the PC: "Trotzdem …" or "Warten"; a final line can be hidden.
 */
export function PowerStatus() {
  const { phase } = useRemotePower();
  const lang = useLang();
  const text = powerText(phase);
  if (text === undefined) return null;
  const p = t.remote.power;
  const icon: IconName =
    phase.kind === 'counting' || phase.kind === 'asking'
      ? 'timer'
      : phase.kind === 'done' || phase.kind === 'working'
        ? 'power'
        : phase.kind === 'cancelled'
          ? 'ok'
          : phase.kind === 'unlock'
            ? 'lock'
            : 'alert';
  return (
    <section className={styles.state} data-testid="remote-power">
      <p className={styles.powerLine} role="status">
        <Icon name={icon} />
        <span>{text}</span>
      </p>
      {phase.kind === 'counting' ? (
        <div className={styles.powerSteps}>
          <Button
            onClick={() => void remoteSession.powerAct('cancel')}
            data-testid="remote-power-cancel"
          >
            {p.cancel}
          </Button>
        </div>
      ) : phase.kind === 'working' ? (
        <div className={styles.powerSteps}>
          <Button
            onClick={() => void remoteSession.powerAct(phase.action, true, lang)}
            data-testid="remote-power-despite"
          >
            {p.despite[POWER_KEY[phase.action]]}
          </Button>
          <Button variant="ghost" onClick={() => remoteSession.powerDismiss()}>
            {p.wait}
          </Button>
        </div>
      ) : phase.kind === 'asking' ? null : (
        <div className={styles.powerSteps}>
          <Button variant="ghost" onClick={() => remoteSession.powerDismiss()}>
            {p.dismiss}
          </Button>
        </div>
      )}
    </section>
  );
}
