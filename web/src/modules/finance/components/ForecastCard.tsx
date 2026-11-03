import { useState } from 'react';
import { formatMoney } from '@/core/money';
import { useAdvanced } from '@/core/settings/comfort';
import { useSettings } from '@/core/settings/settings';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Card, Segmented } from '@/ui';
import { useCurrency } from '../currency';
import { dailySeries, type ForecastHorizon } from '../forecast';
import { settings } from '../settings';
import { useForecast } from '../summary';
import type { FinanceData } from '../types';
import { today } from '@/core/time/dates';
import { MonthCurve } from './MonthCurve';
import styles from '../routes/finance.module.css';

/** "What is coming": the balance line until month end / 30 / 90 days, the lowest point and the end value as text, the list of what it is made of. */
export function ForecastCard({ data }: { data: FinanceData }) {
  const currency = useCurrency();
  const [prefs] = useSettings('module.finance', settings.schema, settings.defaults);
  const preferred = ((prefs as { forecastHorizon?: ForecastHorizon } | undefined)
    ?.forecastHorizon ?? 'month') as ForecastHorizon;
  const [chosen, setChosen] = useState<ForecastHorizon | undefined>();
  // Calm by default: the two sentences; the line, the horizon switch and the list wait behind "Details".
  const [open, setOpen] = useState(false);
  const [advanced] = useAdvanced('finance');
  const horizon = chosen ?? preferred;
  const forecast = useForecast(data, currency, horizon);
  const e = t.finance.ext.forecast;
  const money = (m: number) => formatMoney(m, currency);
  const date = (d: string) => formatDay(d, 'P');
  return (
    <Card>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle}>{e.title}</h2>
        {advanced ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            data-testid="forecast-toggle"
          >
            {open ? e.hideDetails : e.showDetails}
          </Button>
        ) : null}
      </div>
      {open && advanced ? (
        <Segmented
          label={e.horizon}
          value={horizon}
          options={[
            { value: 'month' as const, label: e.month },
            { value: '30' as const, label: e.d30 },
            { value: '90' as const, label: e.d90 },
          ]}
          onChange={setChosen}
        />
      ) : null}
      {forecast ? (
        <>
          {forecast.events.length === 0 ? (
            <p className={styles.muted}>{e.nothing}</p>
          ) : (
            <>
              <p data-testid="forecast-end">
                {e.end(money(forecast.end.balanceMinor), date(forecast.end.date))}
              </p>
              <p className={styles.muted} data-testid="forecast-lowest">
                {e.lowest(money(forecast.lowest.balanceMinor), date(forecast.lowest.date))}
              </p>
              {open ? (
                <>
                  <MonthCurve
                    points={dailySeries(forecast, today())}
                    title={e.chartLabel}
                    fromLabel={date(today())}
                    testId="forecast-curve"
                  />
                  <ul className={styles.forecastList}>
                    {forecast.events.map((ev, i) => (
                      <li key={i}>
                        <span>{date(ev.date)}</span>
                        <span>
                          {ev.label ? `${ev.label} · ` : ''}
                          {e.sources[ev.source]}
                        </span>
                        <b className={ev.amountMinor > 0 ? styles.income : undefined}>
                          {ev.amountMinor > 0 ? '+' : '−'}
                          {money(Math.abs(ev.amountMinor))}
                        </b>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
          {open && advanced ? <p className={styles.muted}>{e.note}</p> : null}
        </>
      ) : (
        <p role="status">…</p>
      )}
    </Card>
  );
}
