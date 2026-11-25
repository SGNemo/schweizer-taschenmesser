import type { ReactNode } from 'react';
import { dateTimeFormat, numberFormat } from '@/core/i18n/format';
import { solarSpan, type CardEvent } from '@/core/sky/events';
import { tWeatherPage } from '@/strings.weatherPage';
import { Icon } from '@/ui';
import { EventGlyph, type EventGlyphName } from '@/ui/weather-scene';
import styles from './MoonCard.module.css';

/**
 * The last block of "Mond & Himmel" (handoff/03-events "Page"): one event – name and time, the local facts, an optional
 * third line (rises late / sets early / the bright moon / the sun sets first), then for a solar eclipse always the
 * safety sentence, and the cloud sentence when clouds will probably hide it. No list, no countdown, no reminder.
 */
export function SkyNext({ event, tz }: { event: CardEvent; tz: string | undefined }) {
  const tp = tWeatherPage.use();
  const ev = tp.ev;
  const time = dateTimeFormat({ hour: '2-digit', minute: '2-digit', timeZone: tz });
  const date = dateTimeFormat({ weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
  const t = (ms: number) => time.format(ms);
  const pct = (x: number) => numberFormat({ maximumFractionDigits: 0 }).format(Math.round(x * 100));

  let glyph: EventGlyphName;
  let head: ReactNode;
  const facts: string[] = [];
  let note: string | undefined;
  let safety = false;
  let clouds = false;
  switch (event.kind) {
    case 'solar': {
      const e = event.eclipse;
      const name =
        e.kind === 'total'
          ? ev.solarTotal
          : e.kind === 'annular'
            ? ev.solarAnnular
            : ev.solarPartial;
      glyph = 'eclipse';
      head =
        event.when === 'running'
          ? ev.running(name, t(e.sunSet ?? e.end))
          : event.when === 'today'
            ? ev.today(name, t(solarSpan(e).from), t(e.end))
            : ev.ahead(name, date.format(e.begin), t(solarSpan(e).from), t(e.end));
      // The maximum is named only when the sun is up then; the coverage is the largest seen while it is up.
      if (e.altPeak > 0) facts.push(ev.peak(t(e.peak)));
      facts.push(ev.solarCover(pct(e.visibleObscuration)));
      if (e.sunSet !== undefined) note = ev.sunLow(t(e.sunSet));
      safety = true;
      clouds = event.clouds;
      break;
    }
    case 'lunar': {
      const e = event.eclipse;
      const r = e.row;
      const name = r.kind === 'total' ? ev.lunarTotal : ev.lunarPartial;
      glyph = 'lunar';
      // A lunar eclipse of today is "Heute Nacht" (mockups/10-karte.html (b)): the moon is full, so it is night side.
      head =
        event.when === 'running'
          ? ev.running(name, t(r.u4))
          : event.when === 'today'
            ? ev.tonight(name, t(r.u1), t(r.u4))
            : ev.ahead(name, date.format(r.u1), t(r.u1), t(r.u4));
      if (r.u2 !== undefined && r.u3 !== undefined) facts.push(ev.lunarTotalSpan(t(r.u2), t(r.u3)));
      else facts.push(ev.peak(t(r.peak)), ev.lunarCover(String(r.pct)));
      note =
        e.risesLate !== undefined
          ? ev.risesLate(t(e.risesLate))
          : e.setsEarly !== undefined
            ? ev.setsEarly(t(e.setsEarly))
            : r.kind === 'total'
              ? ev.lunarRed
              : undefined;
      clouds = event.clouds;
      break;
    }
    case 'meteors': {
      const name = ev.shower[event.night.shower.id];
      glyph = 'meteor';
      head = (event.night.shower.best === 'evening' ? ev.meteorsEvening : ev.meteors)(name);
      if (event.moonBright) note = ev.moonBright;
      clouds = event.clouds;
      break;
    }
    case 'rainbow':
      glyph = 'rainbow';
      head = ev.rainbow;
      break;
    case 'season':
      glyph = 'solstice';
      head = ev[event.season];
      break;
    case 'starNight':
      glyph = 'stars';
      head = ev.starNight;
      break;
  }
  const strong = event.kind === 'solar' || event.kind === 'lunar';
  return (
    <div className={styles.next} data-testid="weather-sky-next" data-kind={event.kind}>
      <h4 className={styles.caps}>{ev.next}</h4>
      <div className={styles.ev}>
        <EventGlyph name={glyph} />
        <span>{strong ? <strong>{head}</strong> : head}</span>
        {facts.length > 0 ? <span className={styles.muted}>{facts.join(' · ')}</span> : null}
        {note ? <span className={styles.muted}>{note}</span> : null}
      </div>
      {clouds ? (
        <div className={styles.ev}>
          <Icon name="cloud" size={16} />
          <span className={styles.muted}>{ev.clouds}</span>
        </div>
      ) : null}
      {/* A solar eclipse always ends with the safety sentence (handoff/03-events). */}
      {safety ? (
        <div className={styles.ev}>
          <span aria-hidden="true" />
          <span className={styles.safe} data-testid="weather-sky-safety">
            {ev.solarSafety}
          </span>
        </div>
      ) : null}
    </div>
  );
}
