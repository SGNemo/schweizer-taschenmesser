/**
 * "Woran war ich?": the last place the user was, kept device-local in `_meta`. The shell records the
 * route and its title; when the app is left it adds `awayAt`. After a longer break the home screen
 * offers a way back. Never synced, never in a backup.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db } from '@/core/db/db';
import { isFocusPath } from './path';

export const CONTEXT_KEY = 'focus.context';
/** How long the app must have been left before the card is offered. */
export const AWAY_MS = 20 * 60_000;

const contextSchema = z.object({
  path: z.string(),
  title: z.string(),
  /** When the app was left (hidden or closed); absent while the user is working. */
  awayAt: z.number().optional(),
  /** The `awayAt` the user already answered ("Nein, danke" or "Weiter dort"). */
  dismissedAt: z.number().optional(),
});
export type ResumeContext = z.infer<typeof contextSchema>;

const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

export async function getContext(): Promise<ResumeContext | undefined> {
  const parsed = contextSchema.safeParse((await meta().get(CONTEXT_KEY))?.value);
  return parsed.success ? parsed.data : undefined;
}

const put = (value: ResumeContext) => meta().put({ key: CONTEXT_KEY, value });

/** Only real places are remembered: not the home screen, not a focus screen. */
export const isRememberable = (path: string): boolean =>
  path !== '/' && !isFocusPath(path.split('?')[0]!);

export async function recordContext(path: string, title: string): Promise<void> {
  if (!isRememberable(path)) return;
  await put({ path, title: title.trim() || path });
}

export async function markAway(at: number): Promise<void> {
  const ctx = await getContext();
  if (ctx && ctx.awayAt === undefined) await put({ ...ctx, awayAt: at });
}

export async function dismissContext(): Promise<void> {
  const ctx = await getContext();
  if (ctx?.awayAt !== undefined) await put({ ...ctx, dismissedAt: ctx.awayAt });
}

/** The app was left long enough ago and the user has not answered yet. */
export function isAway(ctx: ResumeContext | undefined, at: number): boolean {
  return Boolean(
    ctx && ctx.awayAt !== undefined && ctx.dismissedAt !== ctx.awayAt && at - ctx.awayAt >= AWAY_MS,
  );
}

/** True when there is a place to go back to and the app was left long enough ago. */
export function shouldOfferResume(ctx: ResumeContext | undefined, at: number): boolean {
  return isAway(ctx, at) && isRememberable(ctx!.path);
}

/** Live context; `null` = none, `undefined` while loading. */
export const useResumeContext = (): ResumeContext | null | undefined =>
  useLiveQuery(async () => (await getContext()) ?? null, []);
