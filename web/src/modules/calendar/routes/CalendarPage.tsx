import { NowStrip } from '@/core/modules/NowStrip';
import { PersonFilter, usePersonFilter } from '@/core/people/PersonFilter';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useCalendarItems } from '@/core/modules/contributions';
import { changeWithUndo } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import type { CalendarItem } from '@/core/modules/types';
import { useWeekStart } from '@/core/settings/core';
import { useAdvanced } from '@/core/settings/comfort';
import { useSettings } from '@/core/settings/settings';
import { addDaysStr, DATE_RE, eachDay, isoWeekday, today } from '@/core/time/dates';
import { useModuleStates } from '@/core/modules/activation';
import { t } from '@/strings';
import {
  AdvancedToggle,
  Button,
  Icon,
  IconButton,
  PageHeader,
  Segmented,
  SplitView,
  useOpenParam,
  useSplitView,
} from '@/ui';
import { Agenda } from '../components/Agenda';
import { AgendaView } from '../components/AgendaView';
import { CalendarsBar } from '../components/CalendarsBar';
import { YearView } from '../components/YearView';
import type { Slot } from '../dragMath';
import { holidayMap, type HolidayRegion } from '../holidays';
import { EventEditor, type EventTarget } from '../components/EventEditor';
import { ExternalDetail } from '../components/ExternalDetail';
import { NextEventLine } from '../components/NextEventLine';
import { RemindersTab } from '../components/RemindersTab';
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
import { StartDataMenu } from '@/core/importer/StartDataMenu';

const VIEW_LABEL: Record<CalendarView, string> = {
  get month() {
    return t.calendar.month;
  },
  get week() {
    return t.calendar.week;
  },
  get day() {
    return t.calendar.day;
  },
  get agenda() {
    return t.calendar.agenda;
  },
  get year() {
    return t.calendar.year;
  },
};

/** The view switcher's „Plan“ entry: a link to the planner's board, never a sixth view (CONCEPT §5). */
const PLAN_LINK = 'plan' as const;

export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [prefs] = useSettings('module.calendar', settings.schema, settings.defaults);
  const [target, setTarget] = useState<EventTarget>(null);
  useOpenParam((id) => eventRepo.get(id), setTarget);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [occurrence, setOccurrence] = useState<string | null>(null);
  const split = useSplitView();
  const [advanced] = useAdvanced('calendar');
  const weekStart = useWeekStart();
  const plannerOn = useModuleStates()?.planner === true;

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
  const region = ((prefs as { holidayRegion?: HolidayRegion } | null)?.holidayRegion ??
    'off') as HolidayRegion;
  const holidays = holidayMap(range.from, range.to, region);
  const forPerson = usePersonFilter();

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
      setOccurrence(item.date);
      if (ev) setTarget(ev);
    } else if (item.to) void navigate(item.to);
  }

  async function moveItem(item: CalendarItem, slot: Slot) {
    const id = eventIdOf(item.id);
    const ev = await eventRepo.get(id);
    if (!ev) return;
    // A series is changed in the editor, where "only this one" is a deliberate choice.
    if (ev.recurrence) {
      useUiStore.getState().toast(t.calendar.dragRecurring);
      return;
    }
    await changeWithUndo(
      () =>
        eventRepo.update(id, {
          startDate: slot.date,
          startTime: slot.startTime,
          ...(slot.endTime ? { endTime: slot.endTime } : {}),
          // A one-day timed event keeps no end date.
          endDate: undefined,
        }),
      t.calendar.movedToast,
    );
  }

  if (!view) return null;
  const list = (items ?? []).filter((i) => !forPerson || i.personId === forPerson);
  const tab = params.get('tab') === 'reminders' ? 'reminders' : 'calendar';
  const pickTab = (next: string) => {
    const p = new URLSearchParams();
    if (next === 'reminders') p.set('tab', 'reminders');
    setParams(p, { replace: true });
  };

  if (tab === 'reminders') {
    return (
      <>
        <PageHeader
          title={t.calendar.title}
          views={
            <Segmented
              label={t.calendar.tabsLabel}
              value={'reminders'}
              options={[
                { value: 'calendar', label: t.calendar.tabCalendar },
                { value: 'reminders', label: t.calendar.tabReminders },
              ]}
              onChange={pickTab}
            />
          }
        >
          <AdvancedToggle moduleId="calendar" />
          <StartDataMenu moduleId="calendar" />
        </PageHeader>

        <RemindersTab
          newRequested={params.get('new') === '1'}
          onNewHandled={() => {
            const p = new URLSearchParams(params);
            p.delete('new');
            setParams(p, { replace: true });
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t.calendar.title}
        views={
          <Segmented
            label={t.calendar.tabsLabel}
            value={'calendar'}
            options={[
              { value: 'calendar', label: t.calendar.tabCalendar },
              { value: 'reminders', label: t.calendar.tabReminders },
            ]}
            onChange={pickTab}
          />
        }
      >
        <AdvancedToggle moduleId="calendar" />
        <Button variant="primary" onClick={() => setTarget({ draft: { startDate: date } })}>
          <Icon name="plus" size={18} />
          {t.calendar.newEvent}
        </Button>
        <StartDataMenu moduleId="calendar" />
      </PageHeader>
      <NextEventLine onAdd={() => setTarget({ draft: { startDate: date } })} />
      <NowStrip modules={['calendar']} />

      <CalendarsBar advanced={advanced} />
      <PersonFilter usedIds={(items ?? []).flatMap((i) => (i.personId ? [i.personId] : []))} />
      <div className={styles.toolbar}>
        <div className={styles.navBtns}>
          <IconButton
            label={t.calendar.prev}
            onClick={() => go({ date: shiftDate(view, date, -1) })}
          >
            <span aria-hidden="true">‹</span>
          </IconButton>
          <Button variant="ghost" onClick={() => go({ date: today() })}>
            {t.calendar.today}
          </Button>
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
        <Segmented<CalendarView | typeof PLAN_LINK>
          label={t.calendar.view}
          value={view}
          options={[
            ...VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v] })),
            ...(plannerOn ? [{ value: PLAN_LINK, label: t.calendar.planLink }] : []),
          ]}
          onChange={(v) => {
            if (v !== PLAN_LINK) return go({ view: v });
            const monday = addDaysStr(date, 1 - isoWeekday(date));
            void navigate(`/planner?week=${monday}`);
          }}
        />
      </div>

      <div className={styles.body}>
        <SplitView
          enabled={split && view !== 'agenda'}
          asideLabel={t.calendar.agenda}
          aside={<Agenda date={date} onOpenItem={(i) => void openItem(i)} />}
        >
          {view === 'year' ? (
            <YearView
              date={date}
              items={list}
              holidays={holidays}
              onPickDay={(d) => go({ view: 'day', date: d })}
            />
          ) : view === 'agenda' ? (
            <AgendaView items={list} holidays={holidays} onOpenItem={(i) => void openItem(i)} />
          ) : view === 'month' ? (
            <MonthView
              date={date}
              items={list}
              holidays={holidays}
              onPickDay={(d) => go({ view: 'day', date: d })}
              onOpenItem={(i) => void openItem(i)}
            />
          ) : view === 'week' ? (
            <WeekView
              days={eachDay(range.from, range.to)}
              items={list}
              onMoveItem={(i, slot) => void moveItem(i, slot)}
              onCreateSlot={(d, startTime, endTime) =>
                setTarget({ draft: { startDate: d, startTime, endTime } })
              }
              holidays={holidays}
              onPickDay={(d) => go({ view: 'day', date: d })}
              onOpenItem={(i) => void openItem(i)}
            />
          ) : (
            <DayView
              date={date}
              items={list}
              onMoveItem={(i, slot) => void moveItem(i, slot)}
              onCreateSlot={(d, startTime, endTime) =>
                setTarget({ draft: { startDate: d, startTime, endTime } })
              }
              onOpenItem={(i) => void openItem(i)}
              onAdd={(d) => setTarget({ draft: { startDate: d } })}
            />
          )}
        </SplitView>
      </div>

      <EventEditor
        target={openTarget}
        onClose={closeEditor}
        onDuplicated={setTarget}
        occurrence={occurrence}
      />
      <ExternalDetail id={externalId} onClose={() => setExternalId(null)} />
    </>
  );
}
