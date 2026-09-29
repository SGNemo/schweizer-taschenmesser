import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { IconName } from '@/ui/icons';

type LazyComponent = () => Promise<{ default: ComponentType }>;

export interface ModuleRoute {
  /** Absolute path; must start with `/<module id>`. A trailing `/*` lets the module own sub-routes. */
  path: string;
  label: string;
  /** Show in the sidebar / bottom navigation. */
  nav?: boolean;
  component: LazyComponent;
}

export interface CollectionDef {
  /** Zod schema of the user data (without the sync envelope). */
  schema: z.ZodObject;
  /** Extra Dexie indexes (besides id, updatedAt). */
  indexes: string[];
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
  'text' | 'num' | 'money' | 'date' | 'ts' | 'bool' | 'tags' | `enum:${string}`;

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
}

export type CalendarSource = (range: DateRange) => Promise<CalendarItem[]>;

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
  quickAdd?: QuickAddAction[];
  /** Lazy so manifests stay free of database imports. */
  calendarItems?: () => Promise<{ default: CalendarSource }>;
  notifications?: () => Promise<{ default: NotificationSource }>;
  /**
   * Background service that runs while the module is enabled (e.g. reacting to bus events).
   * The default export starts it and returns a function that stops it.
   */
  services?: () => Promise<{ default: () => (() => void) | void }>;
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
  aiSchema: ModuleAiSchema;
  settings: ModuleSettings;
  /** Enabled without user action on a fresh install. */
  defaultEnabled: boolean;
  /** Sort key for navigation and library (lower first, default 100). */
  order?: number;
  /** Only listed in the library in dev builds / when VITE_INCLUDE_EXAMPLE=true. */
  devOnly?: boolean;
  contributions?: ModuleContributions;
}
