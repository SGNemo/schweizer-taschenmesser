import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { ExternalEvent } from '@/core/connectors/types';
import type { PlatformKind } from '@/core/platform/types';
import type { OnboardingDef } from '@/core/importer/types';
import type { SeedMeta } from '@/core/seed/types';
import type { SettingsCategoryId } from '@/core/settings/registry/types';
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

export type WidgetSize = 's' | 'm' | 'l';
export const ALL_WIDGET_SIZES: readonly WidgetSize[] = ['s', 'm', 'l'];

/**
 * A preview of a module on the home screen. Every module offers at least one (enforced by
 * `registry.test.ts` and `npm run check:modules`). The component loads lazily, reads its own data
 * with `useLiveQuery`, and shows an empty state with a primary action when there is no data.
 */
export interface WidgetDef {
  /** Unique within the module; the stored key is `<moduleId>:<id>`. */
  id: string;
  title: string;
  /** Sizes the user can pick in the edit mode (`defaultSize` must be one of them). */
  sizes: readonly WidgetSize[];
  defaultSize: WidgetSize;
  component: LazyComponent;
  /** Where the title links to (a small arrow in the widget header), usually the module page. */
  to?: string;
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
  /** `transition`: the patch applied to the target, e.g. `{ status: 'paid' }`. */
  set?: Record<string, unknown>;
  /** At least one; they are run through validation → preview → undo by the registry test. */
  examples: AiActionExample[];
  /** Hints for the free rule parser (stage 0, no tokens). Plain data; the parser lives in core. */
  parse?: AiActionParseHints;
}

/** Which part of a sentence fills which field. Each role maps to a field of `AiActionDef.fields`. */
export type AiRole =
  'title' | 'amount' | 'date' | 'startDate' | 'recurrence' | 'time' | 'note' | 'url' | 'quantity';

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
  allDay: boolean;
  done?: boolean;
  /** Route to open when the item is activated. */
  to?: string;
  /** Colour of an external calendar ('#rrggbb'). */
  color?: string;
  location?: string;
  /** Link that opens the item in the service it came from. */
  url?: string;
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
  /**
   * An automatic extra (staged lead, follow-up, morning digest): the quiet hours move it to their
   * end. Notifications the user set explicitly (an event's own lead, "Später") are never moved.
   */
  soft?: boolean;
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
  /** The calendar module only: receives events synced by connectors. */
  externalCalendar?: () => Promise<{ default: ExternalCalendarSink }>;
  /**
   * Background service that runs while the module is enabled (e.g. reacting to bus events).
   * The default export starts it and returns a function that stops it.
   */
  services?: () => Promise<{ default: () => (() => void) | void }>;
  /** Values the assistant cannot know when creating an entry (e.g. the default list or account). */
  aiCreateDefaults?: () => Promise<{
    default: (collection: string) => Promise<Record<string, unknown>>;
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
   * Test data contract (required): version and dependencies of `seed.ts`, which generates the
   * module's demo data for the Dev-Preview build, E2E tests and screenshots. See `core/seed/`.
   */
  seed: SeedMeta;
  contributions?: ModuleContributions;
  /** Optional steps for the setup assistant; ids must start with `<module id>.`. */
  setupSteps?: SetupStepDef[];
}
