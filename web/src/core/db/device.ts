import type { TaschenmesserDB } from './db';
import { createClock, type HlcClock } from './hlc';
import { randomDeviceId } from './util';

export interface DeviceContext {
  deviceId: string;
  clock: HlcClock;
}

const contexts = new WeakMap<TaschenmesserDB, Promise<DeviceContext>>();

/** Loads (or creates) the persistent device id and returns a clock bound to it. */
export function getDeviceContext(database: TaschenmesserDB): Promise<DeviceContext> {
  let ctx = contexts.get(database);
  if (!ctx) {
    ctx = (async () => {
      const meta = database.table<{ key: string; value: string }, string>('_meta');
      let row = await meta.get('deviceId');
      if (!row) {
        // add() is a no-op race-safe: a concurrent tab that won leaves its id in place.
        await meta.add({ key: 'deviceId', value: randomDeviceId() }).catch(() => undefined);
        row = await meta.get('deviceId');
      }
      const deviceId = row!.value;
      return { deviceId, clock: createClock(deviceId) };
    })();
    contexts.set(database, ctx);
  }
  return ctx;
}
