import { useLang } from '@/core/i18n/lang';
import { t } from '@/strings';
import { Button, Dialog, Icon, type IconName } from '@/ui';
import { remoteSession, useRemotePrograms } from '../session';
import { programText } from '../view';
import styles from '../remote.module.css';

/**
 * "Programm starten …": the names the PC sent, nothing else. Choosing one sends it at once – it
 * needs mouse and keyboard, so a phone on Medien goes that level's way first (its unlock, if the
 * PC asks for one; no prompt of its own). What follows is `ProgramStatus`, on the page. The list
 * is the PC owner's: an empty one says where it is made.
 */
export function ProgramSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lang = useLang();
  const { list } = useRemotePrograms();
  const p = t.remote.programs;
  const choose = (slot: number) => {
    onClose();
    void remoteSession.programStart(slot, lang);
  };
  return (
    <Dialog open={open} onClose={onClose} title={p.title}>
      <div className={styles.power}>
        {list && list.length > 0 ? (
          <>
            <p className={styles.note}>{p.note}</p>
            <div className={styles.programs} role="group" aria-label={p.title}>
              {list.map((name, slot) => (
                <Button
                  // (slot order is the PC's: a name may stand twice)
                  key={slot}
                  variant="ghost"
                  className={styles.program}
                  onClick={() => choose(slot)}
                  data-testid="remote-program"
                >
                  <Icon name="external" />
                  <span>{name}</span>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className={styles.note} data-testid="remote-programs-empty">
            {p.empty}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** Where a program start stands, as one still line; a final line can be hidden. */
export function ProgramStatus() {
  const { phase } = useRemotePrograms();
  const text = programText(phase);
  if (text === undefined) return null;
  const icon: IconName =
    phase.kind === 'starting'
      ? 'timer'
      : phase.kind === 'started'
        ? 'ok'
        : phase.kind === 'refused' && phase.reason === 'unlock'
          ? 'lock'
          : 'alert';
  return (
    <section className={styles.state} data-testid="remote-program-status">
      <p className={styles.powerLine} role="status">
        <Icon name={icon} />
        <span>{text}</span>
      </p>
      {phase.kind === 'starting' ? null : (
        <div className={styles.powerSteps}>
          <Button variant="ghost" onClick={() => remoteSession.programDismiss()}>
            {t.remote.programs.dismiss}
          </Button>
        </div>
      )}
    </section>
  );
}
