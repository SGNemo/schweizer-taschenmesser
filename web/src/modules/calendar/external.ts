/**
 * Sink for events synced by connectors (`ExternalCalendarSink`). Ids are derived from source,
 * calendar and external id, so a second device that syncs the same calendar (or the same event
 * arriving through sync) writes the same record instead of a duplicate.
 */
import { notDeleted } from '@/core/db/repo';
import type { ExternalCalendarSink } from '@/core/modules/types';
import { externalRepo } from './repo';
import type { ExternalEventRecord } from './schema';

async function recordId(source: string, calendarId: string, extId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${source}\u0000${calendarId}\u0000${extId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
  return `ext-${source}-${hex}`;
}

/** Same key for the same appointment whatever its origin: day, time and simplified title. */
export function eventKey(e: { startDate: string; startTime?: string; title: string }): string {
  const title = e.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return `${e.startDate}|${e.startTime ?? ''}|${title}`;
}

const sink: ExternalCalendarSink = {
  async apply({ source, calendarId, color, upsert, removeExtIds, replaceAll }) {
    // Tombstones included: an event that disappeared and came back reuses its record.
    const all = (await externalRepo.table.toArray()).filter(
      (e) => e.source === source && e.calendarId === calendarId,
    );
    const stored = all.filter(notDeleted);
    const byExt = new Map(all.map((e) => [e.extId, e]));
    let added = 0;
    let updated = 0;
    let removed = 0;

    const keep = new Set<string>();
    for (const ev of upsert) {
      keep.add(ev.extId);
      const data: ExternalEventRecord = {
        source,
        calendarId,
        extId: ev.extId,
        etag: ev.etag,
        title: ev.title,
        allDay: ev.allDay,
        startDate: ev.startDate,
        startTime: ev.allDay ? undefined : ev.startTime,
        endDate: ev.endDate,
        endTime: ev.allDay ? undefined : ev.endTime,
        location: ev.location,
        note: ev.note,
        recurrence: ev.recurrence,
        color: ev.color ?? color,
        url: ev.url,
        kind: ev.kind,
      };
      const current = byExt.get(ev.extId);
      if (current) {
        const revived = current.deletedAt !== null;
        // An unchanged etag means an unchanged event: skip the write (and the sync traffic).
        if (!revived && ev.etag && current.etag === ev.etag) continue;
        if (revived) await externalRepo.restore(current.id);
        await externalRepo.upsert(current.id, data);
        if (revived) added += 1;
        else updated += 1;
      } else {
        await externalRepo.create(data, { id: await recordId(source, calendarId, ev.extId) });
        added += 1;
      }
    }

    const gone = new Set(removeExtIds);
    if (replaceAll) for (const e of stored) if (!keep.has(e.extId)) gone.add(e.extId);
    for (const extId of gone) {
      const current = byExt.get(extId);
      if (!current || current.deletedAt !== null) continue;
      await externalRepo.remove(current.id);
      removed += 1;
    }
    return { added, updated, removed };
  },

  async clear(source, calendarId) {
    const stored = (await externalRepo.table.filter(notDeleted).toArray()).filter(
      (e) => e.source === source && (calendarId === undefined || e.calendarId === calendarId),
    );
    for (const e of stored) await externalRepo.remove(e.id);
    return stored.length;
  },

  async count(source) {
    return (await externalRepo.table.filter(notDeleted).toArray()).filter(
      (e) => e.source === source,
    ).length;
  },

  async knownKeys() {
    return new Set((await externalRepo.table.filter(notDeleted).toArray()).map(eventKey));
  },
};

export default sink;
