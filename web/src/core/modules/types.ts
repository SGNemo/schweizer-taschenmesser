import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { ExternalEvent } from '@/core/connectors/types';
import type { PlatformKind } from '@/core/platform/types';
import type { OnboardingDef } from '@/core/importer/types';
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

export interface WidgetDef {
  id: string;
  title: string;
  size: 's' | 'm' | 'l';
  component: LazyComponent;
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

export interface ModuleAiSchema {
  description: string;
  collections: Record<string, AiCollectionSchema>;
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
}

export type NotificationSource = (range: {
  from: number;
  to: number;
}) => Promise<DueNotification[]>;

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
   * Ids of modules this one builds on (e.g. budgets read finance). Only informs the setup
   * assistant and the library; it never blocks enabling or disabling.
   */
  requires?: string[];
  /** Only listed in the library in dev builds / when VITE_INCLUDE_EXAMPLE=true. */
  devOnly?: boolean;
  contributions?: ModuleContributions;
  /** Optional steps for the setup assistant; ids must start with `<module id>.`. */
  setupSteps?: SetupStepDef[];
}
