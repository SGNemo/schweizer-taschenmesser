import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useCalendarItems } from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { useWeekStart } from '@/core/settings/core';
import { useSettings } from '@/core/settings/settings';
import { DATE_RE, eachDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Icon, IconButton, Segmented, SplitView, useSplitView } from '@/ui';
import { Agenda } from '../components/Agenda';
import { EventEditor, type EventTarget } from '../components/EventEditor';
import { ExternalDetail } from '../components/ExternalDetail';
import { DayView, MonthView, WeekView } from '../components/Views';
import { eventRepo } from '../repo';
import { settings } from '../settings';
import {
  eventIdOf,
  isView,
  rangeFor,
  shiftDate,
  viewTitle,
  VIEWS,
  type CalendarView,
} from '../views';
import styles from './calendar.module.css';
import { StartDataButton } from '@/core/importer/StartDataButton';

const VIEW_LABEL: Record<CalendarView, string> = {
  month: t.calendar.month,
  week: t.calendar.week,
  day: t.calendar.day,
};

export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [prefs] = useSettings('module.calendar', settings.schema, settings.defaults);
  const [target, setTarget] = useState<EventTarget>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const split = useSplitView();
  const weekStart = useWeekStart();

  const rawView = params.get('view');
  const view: CalendarView | null = isView(rawView)
    ? rawView
    : prefs
      ? ((prefs as { defaultView?: string }).defaultView as CalendarView)
      : null;
  const rawDate = params.get('date');
  const date = rawDate && DATE_RE.test(rawDate) ? rawDate : today();
  const range = rangeFor(view ?? 'month', date, weekStart);
  const items = useCalendarItems(range);

  function go(next: { view?: CalendarView; date?: string }) {
    const p = new URLSearchParams(params);
    p.set('view', next.view ?? view ?? 'month');
    p.set('date', next.date ?? date);
    setParams(p, { replace: true });
  }

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL.
  const draft: EventTarget = { draft: { startDate: date } };
  const openTarget = target ?? (params.get('new') ? draft : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) {
      const p = new URLSearchParams(params);
      p.delete('new');
      setParams(p, { replace: true });
    }
  };

  async function openItem(item: CalendarItem) {
    if (item.source === 'calendar' && item.external) {
      setExternalId(eventIdOf(item.id));
    } else if (item.source === 'calendar') {
      const ev = await eventRepo.get(eventIdOf(item.id));
      if (ev) setTarget(ev);
    } else if (item.to) void navigate(item.to);
  }

  if (!view) return null;
  const list = items ?? [];

  return (
    <>
      <div className={styles.header}>
        <h1>{t.calendar.title}</h1>
        {items && list.length === 0 ? <StartDataButton moduleId="calendar" /> : null}
        <Button variant="primary" onClick={() => setTarget({ draft: { startDate: date } })}>
          <Icon name="plus" size={18} />
          {t.calendar.newEvent}
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.navBtns}>
          <IconButton
            label={t.calendar.prev}
            onClick={() => go({ date: shiftDate(view, date, -1) })}
          >
            <span aria-hidden="true">‹</span>
          </IconButton>
          <Button onClick={() => go({ date: today() })}>{t.calendar.today}</Button>
          <IconButton
            label={t.calendar.next}
            onClick={() => go({ date: shiftDate(view, date, 1) })}
          >
            <span aria-hidden="true">›</span>
          </IconButton>
        </div>
        <h2 className={styles.title} aria-live="polite">
          {viewTitle(view, date, weekStart)}
        </h2>
        <Segmented
          label={t.calendar.view}
          value={view}
          options={VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
          onChange={(v) => go({ view: v })}
        />
      </div>

      <div className={styles.body}>
        <SplitView
          enabled={split}
          asideLabel={t.calendar.agenda}
          aside={<Agenda date={date} onOpenItem={(i) => void openItem(i)} />}
        >
          {view === 'month' ? (
            <MonthView
              date={date}
              items={list}
              onPickDay={(d) => go({ view: 'day', date: d })}
              onOpenItem={(i) => void openItem(i)}
            />
          ) : view === 'week' ? (
            <WeekView
              days={eachDay(range.from, range.to)}
              items={list}
              onPickDay={(d) => go({ view: 'day', date: d })}
              onOpenItem={(i) => void openItem(i)}
            />
          ) : (
            <DayView
              date={date}
              items={list}
              onOpenItem={(i) => void openItem(i)}
              onAdd={(d) => setTarget({ draft: { startDate: d } })}
            />
          )}
        </SplitView>
      </div>

      <EventEditor target={openTarget} onClose={closeEditor} />
      <ExternalDetail id={externalId} onClose={() => setExternalId(null)} />
    </>
  );
}
