import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  /** Default warning threshold of a budget (percent of its limit). */
  warnAtPercent: z.number().int().min(10).max(99),
  /** One line per budget: where the period ends at the pace so far. */
  showForecast: z.boolean(),
  /** The charts above the cards (spent and limit, daily rate, forecast, trend, breakdown). */
  showCharts: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { warnAtPercent: 80, showForecast: true, showCharts: true },
  fields: [
    {
      key: 'warnAtPercent',
      get label() {
        return t.budgets.ext.settings.warnAtPercent;
      },
      type: 'number',
      get help() {
        return t.budgets.ext.settings.warnAtPercentHelp;
      },
    },
    {
      key: 'showForecast',
      get label() {
        return t.budgets.ext.settings.showForecast;
      },
      type: 'boolean',
      get help() {
        return t.budgets.ext.settings.showForecastHelp;
      },
    },
    {
      key: 'showCharts',
      get label() {
        return t.budgets.ext.charts.settings.showCharts;
      },
      type: 'boolean',
      get help() {
        return t.budgets.ext.charts.settings.showChartsHelp;
      },
    },
  ],
};
