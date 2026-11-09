import { getLang } from '@/core/i18n/lang';
import { resolvePlace } from '@/core/time/placeSearch';
import { listPlaces } from './repo';

/**
 * A place from the assistant: the zone comes from the offline city search when only a name was given ("Tokio" →
 * Asia/Tokyo), and the place goes to the end of the list. An unknown name leaves the zone open (the preview says so).
 */
export default async function defaults(
  collection: string,
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (collection !== 'place') return {};
  const out: Record<string, unknown> = {};
  // Only when no zone came: a given one is kept as it is (defaults never replace a field; a bad zone is refused).
  if (data.zone === undefined && typeof data.label === 'string') {
    const hit = resolvePlace(data.label, getLang());
    if (hit) out.zone = hit.zone;
  }
  out.order = (await listPlaces()).reduce((max, p) => Math.max(max, p.order + 1), 0);
  return out;
}
