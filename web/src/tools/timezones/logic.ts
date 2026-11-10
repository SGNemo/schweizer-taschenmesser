/** The Zeitzonen tool's picker list; the zone arithmetic lives in `core/time/zones.ts` (shared with the Uhr module). */

import { t } from '@/strings';

export interface Zone {
  id: string;
  label: string;
}

/** Zones offered in the picker (IANA ids; names from the catalog, in the current language). */
export const ZONES: readonly Zone[] = [
  {
    id: 'UTC',
    get label() {
      return t.tools.timezones.zones['UTC'] ?? 'UTC';
    },
  },
  {
    id: 'Europe/Berlin',
    get label() {
      return t.tools.timezones.zones['Europe/Berlin'] ?? 'Europe/Berlin';
    },
  },
  {
    id: 'Europe/London',
    get label() {
      return t.tools.timezones.zones['Europe/London'] ?? 'Europe/London';
    },
  },
  {
    id: 'Europe/Lisbon',
    get label() {
      return t.tools.timezones.zones['Europe/Lisbon'] ?? 'Europe/Lisbon';
    },
  },
  {
    id: 'Europe/Athens',
    get label() {
      return t.tools.timezones.zones['Europe/Athens'] ?? 'Europe/Athens';
    },
  },
  {
    id: 'Europe/Istanbul',
    get label() {
      return t.tools.timezones.zones['Europe/Istanbul'] ?? 'Europe/Istanbul';
    },
  },
  {
    id: 'Europe/Moscow',
    get label() {
      return t.tools.timezones.zones['Europe/Moscow'] ?? 'Europe/Moscow';
    },
  },
  {
    id: 'Africa/Lagos',
    get label() {
      return t.tools.timezones.zones['Africa/Lagos'] ?? 'Africa/Lagos';
    },
  },
  {
    id: 'Africa/Cairo',
    get label() {
      return t.tools.timezones.zones['Africa/Cairo'] ?? 'Africa/Cairo';
    },
  },
  {
    id: 'Africa/Nairobi',
    get label() {
      return t.tools.timezones.zones['Africa/Nairobi'] ?? 'Africa/Nairobi';
    },
  },
  {
    id: 'Africa/Johannesburg',
    get label() {
      return t.tools.timezones.zones['Africa/Johannesburg'] ?? 'Africa/Johannesburg';
    },
  },
  {
    id: 'Asia/Dubai',
    get label() {
      return t.tools.timezones.zones['Asia/Dubai'] ?? 'Asia/Dubai';
    },
  },
  {
    id: 'Asia/Kolkata',
    get label() {
      return t.tools.timezones.zones['Asia/Kolkata'] ?? 'Asia/Kolkata';
    },
  },
  {
    id: 'Asia/Bangkok',
    get label() {
      return t.tools.timezones.zones['Asia/Bangkok'] ?? 'Asia/Bangkok';
    },
  },
  {
    id: 'Asia/Singapore',
    get label() {
      return t.tools.timezones.zones['Asia/Singapore'] ?? 'Asia/Singapore';
    },
  },
  {
    id: 'Asia/Shanghai',
    get label() {
      return t.tools.timezones.zones['Asia/Shanghai'] ?? 'Asia/Shanghai';
    },
  },
  {
    id: 'Asia/Tokyo',
    get label() {
      return t.tools.timezones.zones['Asia/Tokyo'] ?? 'Asia/Tokyo';
    },
  },
  {
    id: 'Asia/Seoul',
    get label() {
      return t.tools.timezones.zones['Asia/Seoul'] ?? 'Asia/Seoul';
    },
  },
  {
    id: 'Australia/Sydney',
    get label() {
      return t.tools.timezones.zones['Australia/Sydney'] ?? 'Australia/Sydney';
    },
  },
  {
    id: 'Pacific/Auckland',
    get label() {
      return t.tools.timezones.zones['Pacific/Auckland'] ?? 'Pacific/Auckland';
    },
  },
  {
    id: 'Pacific/Honolulu',
    get label() {
      return t.tools.timezones.zones['Pacific/Honolulu'] ?? 'Pacific/Honolulu';
    },
  },
  {
    id: 'America/Anchorage',
    get label() {
      return t.tools.timezones.zones['America/Anchorage'] ?? 'America/Anchorage';
    },
  },
  {
    id: 'America/Los_Angeles',
    get label() {
      return t.tools.timezones.zones['America/Los_Angeles'] ?? 'America/Los_Angeles';
    },
  },
  {
    id: 'America/Denver',
    get label() {
      return t.tools.timezones.zones['America/Denver'] ?? 'America/Denver';
    },
  },
  {
    id: 'America/Chicago',
    get label() {
      return t.tools.timezones.zones['America/Chicago'] ?? 'America/Chicago';
    },
  },
  {
    id: 'America/Mexico_City',
    get label() {
      return t.tools.timezones.zones['America/Mexico_City'] ?? 'America/Mexico_City';
    },
  },
  {
    id: 'America/New_York',
    get label() {
      return t.tools.timezones.zones['America/New_York'] ?? 'America/New_York';
    },
  },
  {
    id: 'America/Sao_Paulo',
    get label() {
      return t.tools.timezones.zones['America/Sao_Paulo'] ?? 'America/Sao_Paulo';
    },
  },
  {
    id: 'America/Argentina/Buenos_Aires',
    get label() {
      return (
        t.tools.timezones.zones['America/Argentina/Buenos_Aires'] ??
        'America/Argentina/Buenos_Aires'
      );
    },
  },
];

export const zoneLabel = (id: string): string => ZONES.find((z) => z.id === id)?.label ?? id;
