import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { t } from '@/strings';
import { changeWithUndo, deleteWithUndo } from '@/core/undo/withToast';
import type { Stored } from '@/core/db/types';
import { Button, categoryColor, Dialog, Form, FormActions, TextField } from '@/ui';
import { calendarRepo } from '../repo';
import type { CalendarList } from '../schema';
import styles from '../routes/calendar.module.css';

/** All named calendars, in the order the user keeps them. */
export function useCalendars(): Stored<CalendarList>[] | undefined {
  return useLiveQuery(
    async () => (await calendarRepo.active().toArray()).sort((a, b) => a.order - b.order),
    [],
  );
}

/**
 * Chips to show or hide each named calendar (name + dot, never colour alone) and the dialog that
 * manages them. Nothing is drawn until the first calendar exists; "Kalender verwalten" is in the
 * advanced toolbar.
 */
export function CalendarsBar({ advanced }: { advanced: boolean }) {
  const calendars = useCalendars();
  const [dialog, setDialog] = useState<'list' | { edit: Stored<CalendarList> | null } | null>(null);
  if (!calendars) return null;
  return (
    <>
      {calendars.length > 0 ? (
        <div className={styles.calBar} role="group" aria-label={t.calendar.calendars.group}>
          {calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.calChip}
              aria-pressed={c.visible}
              onClick={() =>
                void changeWithUndo(() => calendarRepo.update(c.id, { visible: !c.visible }))
              }
            >
              <span
                className={styles.calDot}
                style={{ background: categoryColor(c.tone) }}
                aria-hidden="true"
              />
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
      {advanced || calendars.length > 0 ? (
        <Button variant="ghost" onClick={() => setDialog('list')}>
          {t.calendar.calendars.manage}
        </Button>
      ) : null}
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog && dialog !== 'list'
            ? dialog.edit
              ? t.calendar.calendars.edit
              : t.calendar.calendars.add
            : t.calendar.calendars.manage
        }
      >
        {dialog === 'list' ? (
          <div className={styles.calManage}>
            {calendars.length === 0 ? <p>{t.calendar.calendars.empty}</p> : null}
            <ul className={styles.calList}>
              {calendars.map((c) => (
                <li key={c.id}>
                  <span
                    className={styles.calDot}
                    style={{ background: categoryColor(c.tone) }}
                    aria-hidden="true"
                  />
                  <span>
                    {c.name} ·{' '}
                    {c.visible ? t.calendar.calendars.shown : t.calendar.calendars.hidden}
                  </span>
                  <Button variant="ghost" onClick={() => setDialog({ edit: c })}>
                    {t.actions.edit}
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={() => setDialog({ edit: null })}>
              {t.calendar.calendars.add}
            </Button>
          </div>
        ) : dialog ? (
          <CalendarForm
            key={dialog.edit?.id ?? 'new'}
            calendar={dialog.edit}
            count={calendars.length}
            onDone={() => setDialog('list')}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function CalendarForm({
  calendar,
  count,
  onDone,
}: {
  calendar: Stored<CalendarList> | null;
  count: number;
  onDone: () => void;
}) {
  const [name, setName] = useState(calendar?.name ?? '');
  const [tone, setTone] = useState(calendar?.tone ?? count % 6);
  async function save() {
    const clean = name.trim();
    if (!clean) return;
    if (calendar) await calendarRepo.update(calendar.id, { name: clean, tone });
    else await calendarRepo.create({ name: clean, tone, visible: true, order: count });
    onDone();
  }
  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.calendar.calendars.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-autofocus
      />
      <div role="group" aria-label={t.calendar.calendars.colour} className={styles.calSwatches}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className={styles.calSwatch}
            aria-pressed={tone === i}
            aria-label={t.calendar.calendars.colourN(i + 1)}
            title={t.calendar.calendars.colourN(i + 1)}
            onClick={() => setTone(i)}
          >
            <span className={styles.calDot} style={{ background: categoryColor(i) }} />
          </button>
        ))}
      </div>
      {calendar ? <p className={styles.muted}>{t.calendar.calendars.deleteHint}</p> : null}
      <FormActions>
        {calendar ? (
          <Button
            variant="danger"
            onClick={async () => {
              await deleteWithUndo(() => calendarRepo.remove(calendar.id));
              onDone();
            }}
          >
            {t.actions.delete}
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onDone}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
