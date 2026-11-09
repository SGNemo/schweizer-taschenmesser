import type { ModuleAutomation } from '@/core/automation/module';
import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { ExternalEvent } from '@/core/connectors/types';
import type { PlatformKind } from '@/core/platform/types';
import type { OnboardingDef } from '@/core/importer/types';
import type { SeedMeta } from '@/core/seed/types';
import type {
  ModuleFieldGroup,
  SettingsCategoryId,
  SettingsLevel,
} from '@/core/settings/registry/types';
import type { SetupStepDef } from '@/core/setup/types';
import type { IconName } from '@/ui/icons';

type LazyComponent = () => Promise<{ default: ComponentType }>;

/**
 * Preferred page width of a route (see `layout/PageContainer`): `narrow` ≈ 720 px (forms),
 * `content` ≈ 1120 px (default, single-column lists), `wide` ≈ 1600 px (calendar, dashboards,
 * card grids), `full` uses the whole area.
 */
export type PageLayout = 'narrow' | 'content' | 'wide' | 'full';
export const PAGE_LAYOUTS: readonly PageLayout[] = ['narrow', 'content', 'wide', 'full'];

/**
 * Navigation area of a module (sidebar groups, bottom navigation, area page tabs). Areas are
 * navigation only: modules never import each other because they share an area.
 */
export const AREAS = ['plan', 'money', 'household', 'knowledge', 'vault', 'system'] as const;
export type AreaId = (typeof AREAS)[number];

export interface ModuleRoute {
  /** Absolute path; must start with `/<module id>`. A trailing `/*` lets the module own sub-routes. */
  path: string;
  label: string;
  /** Show in the sidebar / bottom navigation. */
  nav?: boolean;
  /** Overrides the module's `layout` for this route. */
  layout?: PageLayout;
  component: LazyComponent;
}

export interface CollectionDef {
  /** Zod schema of the user data (without the sync envelope). */
  schema: z.ZodObject;
  /** Extra Dexie indexes (besides id, updatedAt). */
  indexes: string[];
  /**
   * Device-local data (caches such as fetched news articles): stored with the same envelope, but
   * never queued for sync and not part of the JSON backup. Repos must be created with
   * `{ local: true }` (see `createCollectionRepo`).
   */
  local?: boolean;
  /**
   * `false` keeps the collection out of the data API and the JSON import (collections owned by a
   * connector, e.g. `calendar.external`). Device-local collections are always left out.
   */
  dataApi?: false;
  /**
   * Optional hand-written example in the import format (see `core/dataapi`): plain field names,
   * money as a number in euro, references by title. Made-up data only. Without it the example is
   * generated from the schema.
   */
  example?: Record<string, unknown>;
}

export interface ModuleContext {
  /** Dexie-free hook for data migrations; implemented in core/modules/migrate.ts. */
  moduleId: string;
  forEachRecord(
    collection: string,
    fn: (record: Record<string, unknown>) => Record<string, unknown> | void,
  ): Promise<void>;
}

/**
 * Fixed module palette v3 (tokens.css `--mod-<hue>`, light + dark, contrast-checked; `tokens.test.ts`
 * keeps every hue ≥ 3:1 on the surfaces, ≥ 25° of hue away from the status colours and ≥ 25° from every
 * other hue). Ten hues in steps of 26° of HSL hue plus `slate`, the grey. The "Ruhig" colour mode and the
 * "Modulfarben" switch turn all of them into the quiet text colour.
 */
export const MODULE_HUES = [
  'lime',
  'moss',
  'fern',
  'teal',
  'ocean',
  'sky',
  'cobalt',
  'indigo',
  'violet',
  'orchid',
  'slate',
] as const;
export type ModuleHue = (typeof MODULE_HUES)[number];

/**
 * Head variants of the module frame (identity v3, `docs/design/identity-v3/02-CONCEPT.md` § 3): each has its own
 * silhouette (height, arrangement, typography), not only a colour. `hero` heads are ≈ 200 px tall, `compact` ones ≈ 96 px.
 * - `kennzahl` big figure with context line, sparkline and mini cards (money)
 * - `zeit` day number and today's hour strip (calendar, time tracking)
 * - `fortschritt` rings or bars per item (habits, drives, downloads)
 * - `cover` cover art whose colour tints the head (music)
 * - `himmel` sky backdrop with a thin temperature (weather)
 * - `regal` count figure with tiles on a shelf line (pantry, lists, places, bookmarks)
 * - `tresor` lock status on a framed head (vault; never content)
 * - `schreib` plain paper with a serif title (notes, chat, mail, browser)
 * - `fokus` one task or one fact large (todos, people, invoices)
 */
export const HEAD_VARIANTS = [
  'kennzahl',
  'zeit',
  'fortschritt',
  'cover',
  'himmel',
  'regal',
  'tresor',
  'schreib',
  'fokus',
] as const;
export type HeadVariant = (typeof HEAD_VARIANTS)[number];
/** Height class of a head variant: three are a slim bar, the others a hero. */
export const COMPACT_HEADS: readonly HeadVariant[] = ['tresor', 'schreib', 'fokus'];
export const headHeight = (v: HeadVariant): 'hero' | 'compact' =>
  COMPACT_HEADS.includes(v) ? 'compact' : 'hero';
/**
 * Size of the signature slot in the head (identity v3.1, `layout/AreaFrame`): `S` the mark beside the title
 * (`--slot-s`, 4 rem), `M` a block of up to `--slot-m` (36 rem) beside the figure, `L` the whole content column
 * under the title. The head variant sets it; `himmel` has no slot (the sky is the backdrop).
 */
export const SLOT_SIZES = ['S', 'M', 'L'] as const;
export type SlotSize = (typeof SLOT_SIZES)[number];
export const SIGNATURE_SLOTS: Readonly<Record<HeadVariant, SlotSize | 'none'>> = {
  kennzahl: 'M',
  zeit: 'L',
  fortschritt: 'M',
  cover: 'L',
  himmel: 'none',
  regal: 'M',
  tresor: 'S',
  schreib: 'S',
  fokus: 'S',
};
/**
 * Shape of a module's widget on the overview (identity v3 § 5), bound to the head variant: `kennzahl` figure + sparkline,
 * `zeitleiste` time rail, `fortschritt` rings or bars, `cover` cover + player, `himmel` sky band, `kacheln` 2 × 2 tiles,
 * `status` lock plate + one action, `notiz` first lines in serif, `fokus` one task large, `faellig` rows with state
 * badges, `checkliste` rows with checkboxes. The bodies live in `@/ui/widgets` (`KennzahlBody`, `KachelnBody`, …).
 */
export const WIDGET_VARIANTS = [
  'kennzahl',
  'zeitleiste',
  'fortschritt',
  'cover',
  'himmel',
  'kacheln',
  'status',
  'notiz',
  'fokus',
  'faellig',
  'checkliste',
] as const;
export type WidgetVariant = (typeof WIDGET_VARIANTS)[number];
/**
 * The one thing a module or a tool is recognised by (identity v3.1): one library for both in `@/ui/identity`
 * (`Signature`, `SIGNATURE_MARKS`). Every id here has a drawing: a mark at size `S` and, for the ones with a
 * block, a decoration at `M`/`L`. The frame renders it in the head's signature slot unless the module fills
 * the slot itself (`HeroSlot area="signature"`). Decoration only: no user data, works without colour.
 * `identity.test.tsx` renders every id; `none` is for a module whose head has nothing to say (checked by
 * `check:modules`: `none` plus a `HeroSlot` in the page is a warning).
 */
export const SIGNATURES = [
  // modules
  'sky',
  'coverTone',
  'bankCard',
  'ring',
  'calendarLeaf',
  'stopwatch',
  'todayCard',
  'receipt',
  'bill',
  'cycle',
  'envelope',
  'shelf',
  'avatarRing',
  'pin',
  'pinboard',
  'notePaper',
  'bubble',
  'addressBar',
  'stamp',
  'masthead',
  'folderTab',
  'vaultDoor',
  'gauges',
  'arrowProgress',
  'weekBars',
  'dumbbell',
  'dial',
  // tools
  'display',
  'flow',
  'globe',
  'dice',
  'qrFrame',
  'idCard',
  'photoFrame',
  'pageStack',
  'viewfinder',
  'terminal',
  'splitPage',
  'pattern',
  'none',
] as const;
export type SignatureId = (typeof SIGNATURES)[number];
export const TYPE_ACCENTS = ['sans', 'thin', 'mono', 'serif'] as const;
export type TypeAccent = (typeof TYPE_ACCENTS)[number];
export const CARD_SHAPES = ['soft', 'round', 'sharp'] as const;
export type CardShape = (typeof CARD_SHAPES)[number];

/**
 * How a module is recognised at a glance (DECISIONS → ui-shell "Module identity", v3.1): its hue from the
 * palette (icon plate, head tint, active navigation, chart series), the shape of its main widget, the variant
 * of its head and the signature in the head's slot. The area's pattern comes from `ModuleManifest.area`; the
 * icon is `ModuleManifest.icon`. Required fields: `validateManifest` and `npm run check:modules` enforce them,
 * and app-wide no two modules share hue + head + widget (`scripts/lib/checkIdentity.ts`). The "Ruhig" colour
 * mode and "Modulfarben: Aus" turn every hue grey and the patterns off; head variant and signature stay.
 */
export interface ModuleIdentity {
  hue: ModuleHue;
  /** Second hue of the head gradient and of the second chart series; default: derived from `hue`. Never equal to `hue`. */
  hue2?: ModuleHue;
  /** Shape of the overview widget (`WIDGET_VARIANTS`); a `WidgetDef.variant` overrides it for one widget. */
  widget: WidgetVariant;
  head: HeadVariant;
  signature: SignatureId;
  /** Typography accent for the head's figures and title only (`thin` numerals, `mono` times, `serif` titles). */
  type?: TypeAccent;
  /** Corner radius of the module's cards: `soft` 16 px (default), `round` 20 px, `sharp` 10 px. */
  shape?: CardShape;
}

export type WidgetSize = 's' | 'm' | 'l';
export const ALL_WIDGET_SIZES: readonly WidgetSize[] = ['s', 'm', 'l'];

/**
 * A preview of a module on the home screen. Every module offers at least one (enforced by
 * `registry.test.ts` and `npm run check:modules`). The component loads lazily, reads its own data
 * with `useLiveQuery`, and shows an empty state with a primary action when there is no data.
 */
/**
 * How finished a module, tool, widget or settings section is. `preview` = built and usable, but
 * hidden from the library, toolbox, palette, home catalogue and settings until "In Arbeit anzeigen"
 * (Settings → Darstellung → Mehr Felder anzeigen) is on; then it shows with an "In Arbeit" badge.
 * Only catalogues and default lists hide it: data, routes and anything the user switched on stay.
 */
export type Maturity = 'stable' | 'preview';

export interface WidgetDef {
  /** Unique within the module; the stored key is `<moduleId>:<id>`. */
  id: string;
  title: string;
  /** Sizes the user can pick in the edit mode (`defaultSize` must be one of them). */
  sizes: readonly WidgetSize[];
  defaultSize: WidgetSize;
  /** Shape of this widget when it differs from the module's `identity.widget` (a module with two widgets of two shapes). */
  variant?: WidgetVariant;
  component: LazyComponent;
  /** Where the title links to (a small arrow in the widget header), usually the module page. */
  to?: string;
  /**
   * A widget inherits the module's `maturity`; `'preview'` here tightens it for this widget only
   * (hidden from the home catalogue until "In Arbeit anzeigen" is on, see `home/maturity.ts`).
   */
  maturity?: 'preview';
}

/* ---- AI schema (compact, sent to the LLM in stage 2; never contains user data) ---- */
export type AiFieldType =
  | 'text'
  | 'num'
  | 'money'
  | 'date'
  | 'ts'
  | 'bool'
  | 'tags'
  /** Recurrence rule object (`core/recurrence`); can be set when creating, not filtered on. */
  | 'recurrence'
  | `enum:${string}`;

export interface AiCollectionSchema {
  /** Short German label, e.g. "Rechnung". */
  label: string;
  fields: Record<string, AiFieldType>;
  /** Field that places an entry on the calendar / timeline. */
  dateField?: string;
  /** Field shown as headline in results. */
  titleField: string;
  /** Fields covered by full text search. */
  searchable?: string[];
}

/** What an assistant action does to the collection it targets. */
export type AiActionKind = 'create' | 'update' | 'delete' | 'transition';

export interface AiActionExample {
  /** An invented German sentence a user could type. */
  input: string;
  /** Field values (aiSchema field names, money in cents, dates YYYY-MM-DD) the action should produce. */
  output: Record<string, unknown>;
  /** update / transition / delete: the title of the entry the sentence talks about (the entry the
   *  collection's `create` example produces). */
  target?: string;
}

/**
 * One thing the assistant may do in a module (`create`, `update`, `delete`, or a `transition` such as
 * "mark paid"). Nothing runs without the user's confirmation in the preview; the module only
 * describes the shape. Modules without `actions` stay read-only for the assistant.
 */
export interface AiActionDef {
  kind: AiActionKind;
  /** Key of `aiSchema.collections` (and `dataSchema.collections`). */
  collection: string;
  /** Short German label, e.g. "Rechnung anlegen". */
  label: string;
  /** One short German sentence (sent to the model, keep it tiny). */
  description: string;
  /** Fields the action may set (subset of the aiSchema collection's fields); `create`/`update` only. */
  fields?: string[];
  /** Fields that must be present before the preview can be confirmed (subset of `fields`). */
  required?: string[];
  /** `update` only: text fields whose new value is added after the stored text instead of replacing it (subset of `fields`). */
  append?: string[];
  /** `transition`: the patch applied to the target, e.g. `{ status: 'paid' }`. */
  set?: Record<string, unknown>;
  /** At least one; they are run through validation → preview → undo by the registry test. */
  examples: AiActionExample[];
  /** Hints for the free rule parser (stage 0, no tokens). Plain data; the parser lives in core. */
  parse?: AiActionParseHints;
}

/** Which part of a sentence fills which field. Each role maps to a field of `AiActionDef.fields`; `estimate` = an effort in minutes („2 Std“). */
export type AiRole =
  | 'title'
  | 'amount'
  | 'date'
  | 'startDate'
  | 'recurrence'
  | 'time'
  | 'note'
  | 'url'
  | 'quantity'
  | 'estimate';

export interface AiActionParseHints {
  /**
   * Lowercase German words (or stems) that point at this action: for `create` the module's noun
   * ("rechnung"), for a `transition` the state ("bezahlt"). Matched on word starts after folding
   * umlauts, so "rechnungen" also matches "rechnung".
   */
  keywords: string[];
  /** Field per role; defaults are derived from the field types when omitted. */
  roles?: Partial<Record<AiRole, string>>;
  /**
   * Values applied when the sentence says nothing (aiSchema field names, e.g. `{ kind: 'expense' }`);
   * the string `'@today'` means the current date.
   */
  defaults?: Record<string, unknown>;
  /** Enum fields chosen by words in the sentence: field → value → words (e.g. `kind → income → ['gehalt']`). */
  values?: Record<string, Record<string, string[]>>;
  /** "Milch, Eier und Brot" becomes three entries. */
  splitItems?: boolean;
  /**
   * This action is the default for a sentence without any module word that carries the signal:
   * a clock time with a date (`dateTime`), an amount (`amount`), a link (`url`) or just a date (`date`).
   */
  fallback?: 'url' | 'dateTime' | 'amount' | 'date';
  /** A date without a year means the most recent one ("am 28.9." in October is last month), e.g. bookings. */
  pastDates?: boolean;
}

/** Runs a `transition`/`update` through module logic (e.g. "paid" also tells finance via the bus). */
export interface AiActionHandler {
  apply(id: string, patch: Record<string, unknown>): Promise<void>;
  /** Undo counterpart; without it the previous values are written back directly. */
  revert?(id: string, before: Record<string, unknown>): Promise<void>;
}

export interface ModuleAiSchema {
  description: string;
  collections: Record<string, AiCollectionSchema>;
  /** Write actions, key = short English id (`create`, `markPaid`, …). Optional; see `AiActionDef`. */
  actions?: Record<string, AiActionDef>;
  /**
   * Named read-only calculations the module answers locally (see `contributions.aiComputed`),
   * name → short German description, e.g. `balance: 'Kontostand'`.
   */
  computed?: Record<string, string>;
}

/** Answer of a computed view: labelled, already formatted lines. */
export interface AiComputedResult {
  title: string;
  lines: { label: string; value: string }[];
}

/* ---- Settings ---- */
export interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: { value: string; label: string }[];
  help?: string;
  /** Block on the module's settings page; default `general`. */
  group?: ModuleFieldGroup;
  /** `advanced` fields sit behind the page's "Erweitert" fold; default `basic`. */
  level?: SettingsLevel;
}

export interface ModuleSettings {
  schema: z.ZodObject;
  defaults: Record<string, unknown>;
  fields: SettingField[];
  /** Settings category of this module's section; default `module` (own sub-section under "Module"). */
  category?: SettingsCategoryId;
  /** Sort order inside the category; default 100. */
  order?: number;
  /** Extra search terms (German). */
  keywords?: string[];
}

/* ---- Contributions (registry-mediated, so modules never import each other) ---- */
export interface QuickAddAction {
  id: string;
  label: string;
  /** Route to open; the page reads `?new=1` to open its create form. */
  to: string;
}

/** Inclusive date range, 'YYYY-MM-DD'. */
export interface DateRange {
  from: string;
  to: string;
}

/** One entry on the calendar / timeline, contributed by any module. */
export interface CalendarItem {
  /** Unique within its source. */
  id: string;
  /** Module id that contributed the item. */
  source: string;
  kind: string;
  title: string;
  date: string;
  /** 'HH:mm'; absent for all-day items. */
  time?: string;
  endTime?: string;
  /** Last day of an entry that spans several days; set on its first day only. */
  endDate?: string;
  /** True on the days after the first of a multi-day entry. */
  continued?: boolean;
  allDay: boolean;
  done?: boolean;
  /** Route to open when the item is activated. */
  to?: string;
  /** Colour of an external calendar ('#rrggbb'). */
  color?: string;
  location?: string;
  /** Link that opens the item in the service it came from. */
  url?: string;
  /** The person or client the entry is for (id of a People record), if the source knows one. */
  personId?: string;
  /** True for events copied from an outside service (read-only). */
  external?: boolean;
}

export type CalendarSource = (range: DateRange) => Promise<CalendarItem[]>;

/**
 * Where connectors put external calendar events. The calendar module implements it, so connectors
 * never touch the database or import a module.
 */
export interface ExternalCalendarSink {
  /**
   * Applies one sync of one source calendar. `replaceAll` = `upsert` is the complete window: stored
   * events of that calendar that are not in it are removed.
   */
  apply(args: {
    source: string;
    calendarId: string;
    color?: string;
    upsert: ExternalEvent[];
    removeExtIds: string[];
    replaceAll: boolean;
  }): Promise<{ added: number; updated: number; removed: number }>;
  /** Removes what a source (or one of its calendars) created; returns the number of events. */
  clear(source: string, calendarId?: string): Promise<number>;
  /** How many events a source has stored (for the settings card). */
  count(source: string): Promise<number>;
  /** Keys (date|time|normalised title) of all stored events – for de-duplicating suggestions. */
  knownKeys(): Promise<Set<string>>;
}

/** A notification that should fire at `at` (epoch ms). `key` must be stable per occurrence. */
export interface DueNotification {
  key: string;
  at: number;
  title: string;
  body?: string;
  url?: string;
  /** The reminder's own title when `title` is reworded (a repeat: "Noch offen: …"); "Später" keeps this one. */
  baseTitle?: string;
  /**
   * An automatic extra (staged lead, follow-up, morning digest): the quiet hours move it to their
   * end. Notifications the user set explicitly (an event's own lead, "Später") are never moved.
   */
  soft?: boolean;
  /** The reminder is answered with "Genommen" (intake) instead of "Erledigt"; the same answer, no statistics. */
  taken?: boolean;
  /** Set on the hourly summary: the reminders folded into it, so the centre can list them by title. */
  members?: DueNotification[];
  /**
   * Set by the calm policy while "Stumm" is on: shown without sound or vibration. Modules never set
   * it themselves.
   */
  quiet?: boolean;
  /**
   * Never leaves this device: not uploaded for Web Push (the sync server would see title and text).
   * For notifications about third-party content such as new mail.
   */
  local?: true;
}

export type NotificationSource = (range: {
  from: number;
  to: number;
}) => Promise<DueNotification[]>;

/**
 * One entry of the home screen's "Jetzt wichtig" strip. `danger` is only for overdue / exceeded /
 * expired things, `accent` for "act today", `warning` for "running out soon / almost full".
 */
export interface AttentionItem {
  id: string;
  tone: 'danger' | 'accent' | 'warning';
  icon: IconName;
  title: string;
  /** Short context, e.g. "seit 3 Tagen" or "897,89 €". */
  detail?: string;
  to: string;
  /** Lower comes first within a tone. */
  rank?: number;
}

/** Collects what needs attention now; modules may only read their own data. */
export type AttentionSource = (ctx: { today: string }) => Promise<AttentionItem[]>;

/**
 * One open thing a module offers the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4).
 * The source keeps what it has (title, done, priority, due, estimate); the planner stores only its own
 * planning facts. Dates are 'YYYY-MM-DD', durations whole minutes.
 */
export interface PlannableItem {
  /** Unique within its source; the planner's item key is `<moduleId>:<id>`. */
  id: string;
  /** What kind of thing it is (`task`, `invoice`, …), for the row's icon and wording. */
  kind: string;
  title: string;
  /** Route that opens the thing, usually `/<module>?open=<id>`. */
  to: string;
  durationMin?: number;
  priority?: 0 | 1 | 2 | 3;
  /** `hard` = must be done by then (invoice, cancellation); a ToDo's own date is soft. */
  due?: { date: string; hard: boolean };
  /** Not before this day. */
  earliest?: string;
  /** The day the source carries (a ToDo's `plannedFor`); the planner reads it as the earliest day. */
  plannedFor?: string;
  /** The planner's ownership mark on the source (a ToDo's `planMark`): `plannedFor` is planner-own only if `planMark.date === plannedFor`. */
  planMark?: { date: string; order: number; prior?: string };
  done?: boolean;
  personId?: string;
  link?: { kind: 'note' | 'mail' | 'invoice' | 'event'; id: string; label: string };
  /** A short line the row shows after the minutes (e.g. „Mahnung · 92,40 € bis 13.10.“); never in the title. */
  detail?: string;
  /** When the thing was created (epoch ms): the engine's tie-break "older first". */
  createdAt?: number;
}

/**
 * Is a source's date the planner's own? Only while the mark carries the same day; every other combination
 * (no mark, a mark for another day, a mixed field-level merge) reads as the user's date – the safe direction,
 * because sync merges each field on its own. The one rule, used by the planner and by every source.
 */
export const isPlannerOwned = (x: Pick<PlannableItem, 'plannedFor' | 'planMark'>): boolean =>
  x.plannedFor !== undefined && x.planMark?.date === x.plannedFor;

/** The planner's view of a module's open things plus the write-back of the same contract (typed, no module import). */
export interface PlannableSource {
  /** Open, plannable things only (no done, no „Irgendwann“, no subtasks). */
  list(ctx: { today: string; until: string }): Promise<PlannableItem[]>;
  /**
   * The planner assigned the thing to `date` (first session) at `order` inside that day, or took it out
   * (`date` undefined). A ToDo writes `plannedFor` + `planMark`; no `order` clears the mark.
   */
  onAssign?(id: string, date: string | undefined, order?: number): Promise<void>;
  /**
   * The planner lets go of the thing for good (the module is switched off): the source hands the user's
   * own date back (`planMark.prior`, also one in the past) or clears it, and drops the mark.
   */
  onRelease?(id: string): Promise<void>;
  /** Ticked off from the plan. */
  onDone?(id: string): Promise<void>;
  /** The estimate was edited in the plan. */
  onEstimate?(id: string, minutes: number): Promise<void>;
}

/**
 * One large figure for the cockpit's "Großanzeige" (`home/CockpitStats`): a formatted value with a
 * label and a context line, e.g. the balance. Always formatted by the module; never raw numbers.
 */
export interface HeadlineFigure {
  label: string;
  value: string;
  /** Context line under the number ("2 Konten · Giro 1.203,10 €"). */
  detail?: string;
  /** Route to open when the figure is activated (default: the module page). */
  to?: string;
}
export type HeadlineSource = (ctx: { today: string }) => Promise<HeadlineFigure | undefined>;

export interface ModuleContributions {
  /**
   * Start-data importers of the module ("Startdaten einrichten"). **Required** so new modules think
   * about it; use `noOnboarding` when there is nothing to import.
   */
  onboarding?: OnboardingDef;
  quickAdd?: QuickAddAction[];
  /** Lazy so manifests stay free of database imports. */
  calendarItems?: () => Promise<{ default: CalendarSource }>;
  notifications?: () => Promise<{ default: NotificationSource }>;
  /** Items for "Jetzt wichtig" on the home screen (overdue, due today, exceeded, expiring). */
  attention?: () => Promise<{ default: AttentionSource }>;
  /** Open things the planner may distribute over the days, with the write-back callbacks (lazy like `calendarItems`). */
  plannable?: () => Promise<{ default: PlannableSource }>;
  /** One large figure for the cockpit's "Großanzeige" (balance, …); the module formats it. */
  headline?: () => Promise<{ default: HeadlineSource }>;
  /** The calendar module only: receives events synced by connectors. */
  externalCalendar?: () => Promise<{ default: ExternalCalendarSink }>;
  /**
   * Background service that runs while the module is enabled (e.g. reacting to bus events).
   * The default export starts it and returns a function that stops it.
   */
  services?: () => Promise<{ default: () => (() => void) | void }>;
  /** Values the assistant cannot know when creating an entry (e.g. the default list or account). */
  aiCreateDefaults?: () => Promise<{
    /** `data` = the values already known; defaults may depend on them (a reminder needs a notification). */
    default: (
      collection: string,
      data?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
  }>;
  /** Module logic for actions with side effects, key = action id of `aiSchema.actions`. */
  aiActionHandlers?: () => Promise<{ default: Record<string, AiActionHandler> }>;
  /** Implements the views declared in `aiSchema.computed`. */
  aiComputed?: () => Promise<{
    default: (name: string, ctx: { today: string }) => Promise<AiComputedResult | undefined>;
  }>;
}

export interface ModuleManifest {
  /** Lowercase alphanumeric, used as route prefix and Dexie table prefix. */
  id: string;
  name: string;
  icon: IconName;
  /** Hue from the module palette, head variant, widget shape and signature (required). */
  identity: ModuleIdentity;
  /** Integer; bump when `migrations` gains an entry. */
  version: number;
  description: string;
  routes: ModuleRoute[];
  dataSchema: { collections: Record<string, CollectionDef> };
  /** Key = target version; runs once when the stored version is lower. */
  migrations: Record<number, (ctx: ModuleContext) => Promise<void>>;
  widgets: WidgetDef[];
  /**
   * Compact description for the assistant. **Optional on purpose:** a module without one does not
   * exist for the AI – not in the prompt, the full-text search, the parser or the executor
   * (`core/ai/scope.ts`). Modules holding secrets (`accounts`) must leave it out.
   */
  aiSchema?: ModuleAiSchema;
  settings: ModuleSettings;
  /** Preferred page width of the module's routes; default `content`. */
  layout?: PageLayout;
  /**
   * `false` = the module does not exist for the data API / JSON import. Required for modules that
   * hold secrets (`accounts`, which is also blocked by id in `core/dataapi/scope.ts`).
   */
  dataApi?: false;
  /**
   * Platforms the module exists on (library, navigation, dashboard, services). Omitted = all.
   * Filtered by `availableManifests()` in the registry.
   */
  platforms?: PlatformKind[];
  /** Enabled without user action on a fresh install. */
  defaultEnabled: boolean;
  /** Sort key for navigation and library (lower first, default 100). */
  order?: number;
  /**
   * Navigation area the module belongs to (`AREAS`); an area without an enabled module is hidden.
   * Required, except for `retired` modules, which must not have one.
   */
  area?: AreaId;
  /**
   * Retired module: no routes, navigation, widgets, quick capture, `aiSchema`, contributions or
   * import-API access, and not in the library, but its collections stay in the schema so sync,
   * backup and older devices keep working (tables go in a later package). Needs `seed.none: 'retired'`.
   */
  retired?: true;
  /**
   * Ids of modules this one builds on (e.g. budgets read finance). Only informs the setup
   * assistant and the library; it never blocks enabling or disabling.
   */
  requires?: string[];
  /** Only listed in the library in dev builds / when VITE_INCLUDE_EXAMPLE=true. */
  devOnly?: boolean;
  /**
   * Required. `preview` hides the module from the library, palette and setup catalogues until
   * "In Arbeit anzeigen" is on (`core/modules/available.ts` `isVisible`); a module the user has
   * already switched on stays on and reachable. `npm run check:modules` fails without it.
   */
  maturity: Maturity;
  /**
   * Test data contract (required): version and dependencies of `seed.ts`, which generates the
   * module's demo data for the Dev-Preview build, E2E tests and screenshots. See `core/seed/`.
   */
  seed: SeedMeta;
  contributions?: ModuleContributions;
  /**
   * Events, state checks and allowed actions for rules ("Wenn X, dann Y", `core/automation`). Lazy;
   * optional. Needs `aiSchema` for `actions`. The vault never has one.
   */
  automation?: () => Promise<{ default: ModuleAutomation }>;
  /** Optional steps for the setup assistant; ids must start with `<module id>.`. */
  setupSteps?: SetupStepDef[];
}
