/**
 * Stage 0: German rule parser for writes (create / update / delete / transition). Free, local,
 * deterministic. Which module and action a sentence means comes from the manifests'
 * `aiSchema.actions[*].parse` hints, so a new module needs no change here. Amounts, dates, times,
 * recurrences and URLs come from the quick-capture extractors. Anything it cannot place with
 * confidence returns `undefined` and the next stage takes over.
 */
import type { TaschenmesserDB } from '@/core/db/db';
import type { AiActionDef, AiRole, ModuleManifest } from '@/core/modules/types';
import { extractFacts, type ExtractedFacts } from '@/quickCapture/parser/extract';
import { fold } from '../../text';
import { aiModules, type AiModule } from '../../scope';
import { findTarget } from '../targets';
import type { ProposedOp, WriteProposal } from '../types';
import {
  CREATE_VERBS,
  DELETE_VERBS,
  EDGE_FILLERS,
  MARK_VERBS,
  POLITE,
  SEARCH_STARTS,
  UPDATE_VERBS,
} from './lexicon';

export interface RuleContext {
  manifests: readonly ModuleManifest[];
  database: TaschenmesserDB;
  now: Date;
  /** 'YYYY-MM-DD' */
  today: string;
  /** The module the user is in: default target for a sentence without a module word. */
  preferModule?: string;
}

const MAX_SEGMENTS = 8;

interface Word {
  raw: string;
  /** folded, letters/digits/hyphen only */
  n: string;
}

const toWords = (s: string): Word[] =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, n: fold(raw).replace(/[^a-z0-9-]/g, '') }));

const startsWithAny = (w: Word, list: readonly string[]): boolean =>
  w.n.length > 0 && list.some((v) => w.n.startsWith(v));

interface ActionRef {
  manifest: AiModule;
  id: string;
  def: AiActionDef;
}

function actionsOf(manifests: readonly ModuleManifest[], kind: AiActionDef['kind']): ActionRef[] {
  return aiModules(manifests).flatMap((manifest) =>
    Object.entries(manifest.aiSchema.actions ?? {})
      .filter(([, def]) => def.kind === kind)
      .map(([id, def]) => ({ manifest, id, def })),
  );
}

const fk = (list: readonly string[]): string[] => list.map(fold);

/** Words that name the collection an action works on ("rechnung", "abo"). */
function nounsOf(ref: ActionRef): string[] {
  const { manifest, def } = ref;
  const create = Object.values(manifest.aiSchema.actions ?? {}).filter(
    (a) => a.kind === 'create' && a.collection === def.collection,
  );
  const nouns = create.flatMap((a) => fk(a.parse?.keywords ?? []));
  nouns.push(fold(manifest.aiSchema.collections[def.collection]!.label));
  return [...new Set(nouns)];
}

/** Longest keyword the word starts with (0 = no match). */
const keywordHit = (w: Word, keywords: readonly string[]): number =>
  w.n.length === 0
    ? 0
    : Math.max(0, ...keywords.filter((k) => w.n.startsWith(k)).map((k) => k.length));

/** "Stadtwerke-Rechnung" → ["Stadtwerke", "Rechnung"]; other words stay whole. */
const splitCompound = (w: Word, nouns: readonly string[]): Word[] => {
  if (!w.raw.includes('-')) return [w];
  const parts = w.raw.split('-').filter(Boolean);
  if (!parts.some((p) => keywordHit({ raw: p, n: fold(p) }, nouns) > 0)) return [w];
  return parts.map((p) => ({ raw: p, n: fold(p).replace(/[^a-z0-9-]/g, '') }));
};

function trimEdges(words: Word[]): Word[] {
  let from = 0;
  let to = words.length;
  while (from < to && EDGE_FILLERS.has(words[from]!.n)) from++;
  while (to > from && EDGE_FILLERS.has(words[to - 1]!.n)) to--;
  return words.slice(from, to);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const joinWords = (words: Word[]): string =>
  cap(
    trimEdges(words)
      .map((w) => w.raw)
      .join(' ')
      .replace(/^[\s,;:–-]+|[\s,;:–-]+$/gu, '')
      .trim(),
  );

function fieldFor(ref: ActionRef, role: AiRole, startDateHint = false): string | undefined {
  const { manifest, def } = ref;
  const fields = def.fields ?? [];
  const schema = manifest.aiSchema.collections[def.collection]!;
  const explicit = def.parse?.roles?.[role];
  if (explicit) return explicit;
  const first = (pred: (f: string, type: string) => boolean): string | undefined =>
    fields.find((f) => pred(f, schema.fields[f] ?? ''));
  switch (role) {
    case 'title':
      return fields.includes(schema.titleField) ? schema.titleField : undefined;
    case 'amount':
      return first((_, t) => t === 'money');
    case 'date': {
      if (startDateHint && fields.includes('startDate')) return 'startDate';
      const df = schema.dateField;
      if (df && fields.includes(df) && schema.fields[df] === 'date') return df;
      return first((_, t) => t === 'date');
    }
    case 'startDate':
      return fields.includes('startDate') ? 'startDate' : undefined;
    case 'time':
      return first((f) => f === 'startTime' || f === 'time');
    case 'recurrence':
      return first((_, t) => t === 'recurrence');
    case 'note':
      return first((f) => f === 'note' || f === 'body');
    case 'url':
      return first((f) => f === 'url');
    case 'quantity':
      return first((f) => f === 'count' || f === 'quantity');
  }
}

const QUANTITY_RE = /(?<![\d.,])(\d{1,3})\s?(?:x|stk\.?|stuck|stück|stueck|mal)(?![\p{L}])/iu;
const LEADING_QUANTITY_RE = /^\s*(\d{1,3})\s?x\s+/iu;

/** Copies extracted facts into the fields of the action (by role). */
function fillData(
  ref: ActionRef,
  facts: ExtractedFacts,
  extra: { title?: string; quantity?: string; startDateHint: boolean },
): Record<string, unknown> {
  const { def, manifest } = ref;
  const schema = manifest.aiSchema.collections[def.collection]!;
  const data: Record<string, unknown> = {};
  const put = (role: AiRole, value: unknown, startDateHint = false): void => {
    if (value === undefined || value === '') return;
    const field = fieldFor(ref, role, startDateHint);
    if (field && data[field] === undefined) data[field] = value;
  };
  put('title', extra.title);
  put('amount', facts.amountMinor);
  put('date', facts.date, extra.startDateHint);
  put('time', facts.time);
  put('recurrence', facts.recurrence);
  put('url', facts.url);
  const quantityField = fieldFor(ref, 'quantity');
  put(
    'quantity',
    extra.quantity !== undefined && schema.fields[quantityField ?? ''] === 'num'
      ? Number(extra.quantity)
      : extra.quantity,
  );
  const kindType = schema.fields.kind;
  if (facts.kind && kindType?.startsWith('enum:') && def.fields?.includes('kind')) {
    if (kindType.slice(5).split('|').includes(facts.kind)) data.kind = facts.kind;
  }
  return data;
}

function applyDefaults(ref: ActionRef, data: Record<string, unknown>, today: string): void {
  for (const [field, value] of Object.entries(ref.def.parse?.defaults ?? {})) {
    if (data[field] === undefined) data[field] = value === '@today' ? today : value;
  }
}

/** Enum fields chosen by words ("Kühlschrank" → place = fridge). Returns the words used. */
function applyValueWords(
  ref: ActionRef,
  words: Word[],
  data: Record<string, unknown>,
): Set<string> {
  const used = new Set<string>();
  for (const [field, byValue] of Object.entries(ref.def.parse?.values ?? {})) {
    for (const [value, list] of Object.entries(byValue)) {
      const keys = fk(list);
      const hit = words.find((w) => keywordHit(w, keys) > 0);
      if (hit) {
        data[field] = value;
        used.add(hit.n);
        break;
      }
    }
  }
  return used;
}

const asciiAb = /^(?:ab|seit|von|beginnend)$/;

/** The document says "ab 1.11." – a start date, not a due date. */
const hasStartCue = (rest: string): boolean => toWords(rest).some((w) => asciiAb.test(w.n));

async function segmentToOp(
  segment: string,
  ctx: RuleContext,
): Promise<{ ops: ProposedOp[]; confidence: number } | undefined> {
  const words = toWords(segment);
  while (words.length > 0 && POLITE.includes(words[0]!.n)) words.shift();
  if (words.length === 0) return undefined;
  if (startsWithAny(words[0]!, SEARCH_STARTS)) return undefined;

  const isDelete = words.some((w) => startsWithAny(w, DELETE_VERBS));
  const isUpdate = !isDelete && words.some((w) => startsWithAny(w, UPDATE_VERBS));
  const hasCreateVerb = words.some((w) => startsWithAny(w, CREATE_VERBS));
  const now = ctx.now;

  const dropVerbs = (list: Word[], verbs: readonly string[]): Word[] =>
    list.filter((w) => !startsWithAny(w, verbs));

  /* ---------------- delete ---------------- */
  if (isDelete) {
    return forTarget(
      dropVerbs(words, DELETE_VERBS),
      actionsOf(ctx.manifests, 'delete'),
      ctx,
      (ref, target) => ({
        module: ref.manifest.id,
        action: ref.id,
        target: { title: target },
      }),
    );
  }

  /* ---------------- update ---------------- */
  if (isUpdate) {
    const body = dropVerbs(words, UPDATE_VERBS);
    const joined = body.map((w) => w.raw).join(' ');
    const m = /^(.*?)\s+(?:auf|zu|in|nach|um)\s+(.+)$/iu.exec(joined);
    if (!m) return undefined;
    const left = toWords(m[1]!);
    const facts = extractFacts(m[2]!, { now, bareAmount: true });
    const valueRest = joinWords(toWords(facts.rest));
    return forTarget(left, actionsOf(ctx.manifests, 'update'), ctx, (ref, target) => {
      const data = fillData(ref, facts, { title: valueRest || undefined, startDateHint: false });
      // Only a rename when no other fact was given.
      if (valueRest && Object.keys(data).length > 1) delete data[fieldFor(ref, 'title') ?? ''];
      return Object.keys(data).length === 0
        ? undefined
        : { module: ref.manifest.id, action: ref.id, target: { title: target }, data };
    });
  }

  /* ---------------- transition ("… bezahlt", "… erledigt") ---------------- */
  const transitions = actionsOf(ctx.manifests, 'transition').filter((ref) =>
    words.some((w) => keywordHit(w, fk(ref.def.parse?.keywords ?? [])) > 0),
  );
  const facts0 = extractFacts(segment, { now });
  if (transitions.length > 0 && facts0.amountMinor === undefined) {
    const stateWords = new Set(transitions.flatMap((ref) => fk(ref.def.parse?.keywords ?? [])));
    const rest = words.filter(
      (w) => keywordHit(w, [...stateWords]) === 0 && !startsWithAny(w, MARK_VERBS),
    );
    const found = await forTarget(
      rest,
      transitions,
      ctx,
      (ref, target) => ({
        module: ref.manifest.id,
        action: ref.id,
        target: { title: target },
      }),
      { requireMatch: true },
    );
    if (found) return found;
  }

  /* ---------------- create ---------------- */
  const creates = actionsOf(ctx.manifests, 'create');
  let best: { ref: ActionRef; hit: number } | undefined;
  let tie = false;
  for (const ref of creates) {
    const keys = fk(ref.def.parse?.keywords ?? []);
    const hit = Math.max(0, ...words.map((w) => keywordHit(w, keys)));
    if (hit === 0) continue;
    if (!best || hit > best.hit) {
      best = { ref, hit };
      tie = false;
    } else if (hit === best.hit && ref.manifest.id !== best.ref.manifest.id) tie = true;
  }
  const preferred =
    !best && ctx.preferModule ? creates.find((r) => r.manifest.id === ctx.preferModule) : undefined;
  if (preferred) best = { ref: preferred, hit: 0 };
  if (!best || tie) return undefined;
  const ref = best.ref;

  const keys = fk(ref.def.parse?.keywords ?? []);
  const nounWords = nounsOf(ref);
  // "Stadtwerke-Rechnung" → two words, then the noun goes.
  let rest = words.flatMap((w) => splitCompound(w, nounWords));
  rest = rest.filter(
    (w) =>
      keywordHit(w, keys) === 0 &&
      keywordHit(w, nounWords) === 0 &&
      !startsWithAny(w, CREATE_VERBS),
  );
  let text = rest.map((w) => w.raw).join(' ');
  let quantity: string | undefined;
  if (ref.def.fields?.some((f) => f === 'count' || f === 'quantity')) {
    const q = QUANTITY_RE.exec(text) ?? LEADING_QUANTITY_RE.exec(text);
    if (q) {
      quantity = q[1];
      text = text.replace(q[0], ' ');
    }
  }
  const facts = extractFacts(text, { now, bareAmount: Boolean(fieldFor(ref, 'amount')) });
  const restWords = toWords(facts.rest);
  const startHint = hasStartCue(facts.rest);
  const data0: Record<string, unknown> = {};
  const used = applyValueWords(ref, words, data0);
  let titleWords = restWords.filter((w) => !used.has(w.n));
  if (titleWords.every((w) => EDGE_FILLERS.has(w.n))) titleWords = restWords; // keep something
  let titles = [joinWords(titleWords)];
  if (ref.def.parse?.splitItems) {
    titles = titleWords
      .map((w) => w.raw)
      .join(' ')
      .split(/\s*(?:,|\+|\bund\b|&)\s*/iu)
      .map((t) => joinWords(toWords(t)))
      .filter(Boolean);
  }
  titles = titles.filter(Boolean);
  const titleField = fieldFor(ref, 'title');
  const noTitleNeeded = !titleField || !(ref.def.required ?? []).includes(titleField);
  if (titles.length === 0 && !noTitleNeeded) return undefined;
  if (titles.length === 0) titles = [''];

  // A bare noun with nothing else is a search ("Rechnungen"), a noun with a title is not.
  const hasFacts =
    facts.amountMinor !== undefined ||
    facts.date !== undefined ||
    facts.time !== undefined ||
    facts.recurrence !== undefined ||
    facts.url !== undefined;
  const firstIsNoun = keywordHit(words[0]!, keys) > 0 || keywordHit(words[0]!, nounWords) > 0;
  const signal =
    hasCreateVerb || hasFacts || firstIsNoun || ref.def.parse?.splitItems || Boolean(preferred);
  if (!signal) return undefined;
  // "Rechnung Stadtwerke" is a search; "Notiz Idee für den Garten" or "Milch auf die Einkaufsliste"
  // is not: a leading noun needs more than one more word, a trailing noun is a clear target.
  const content = words.filter(
    (w) => !EDGE_FILLERS.has(w.n) && keywordHit(w, keys) === 0 && keywordHit(w, nounWords) === 0,
  ).length;
  if (!hasCreateVerb && !hasFacts && firstIsNoun && content <= 1) return undefined;

  const ops = titles.map((title) => {
    const data = fillData(ref, facts, { title, quantity, startDateHint: startHint });
    Object.assign(data, data0);
    applyDefaults(ref, data, ctx.today);
    return { module: ref.manifest.id, action: ref.id, data };
  });
  return { ops, confidence: 0.9 };
}

/**
 * Update/delete/transition: finds the entry a sentence talks about. Nouns narrow the collections;
 * without a noun every collection with that action is searched. `requireMatch` = fall through when
 * no entry matches (transitions: "bezahlt" may also be a new booking).
 */
async function forTarget(
  words: Word[],
  refs: ActionRef[],
  ctx: RuleContext,
  build: (ref: ActionRef, target: string) => ProposedOp | undefined,
  opts: { requireMatch?: boolean } = {},
): Promise<{ ops: ProposedOp[]; confidence: number } | undefined> {
  if (refs.length === 0) return undefined;
  const withNouns = refs.map((ref) => ({ ref, nouns: nounsOf(ref) }));
  const flat = words.flatMap((w) =>
    splitCompound(
      w,
      withNouns.flatMap((x) => x.nouns),
    ),
  );
  const narrowed = withNouns.filter((x) => flat.some((w) => keywordHit(w, x.nouns) > 0));
  const pool = narrowed.length > 0 ? narrowed : withNouns;
  const allNouns = pool.flatMap((x) => x.nouns);
  const target = joinWords(flat.filter((w) => keywordHit(w, allNouns) === 0));
  if (!target) return undefined;

  const hits: { ref: ActionRef; exact: boolean }[] = [];
  for (const { ref } of pool) {
    const schema = ref.manifest.aiSchema.collections[ref.def.collection]!;
    const found = await findTarget(
      ctx.database,
      ref.manifest.id,
      ref.def.collection,
      schema.titleField,
      target,
    );
    if (found.match || found.candidates.length > 0) hits.push({ ref, exact: Boolean(found.match) });
  }
  if (hits.length === 1) {
    const op = build(hits[0]!.ref, target);
    return op ? { ops: [op], confidence: hits[0]!.exact ? 0.9 : 0.7 } : undefined;
  }
  if (hits.length > 1) return undefined; // the same name in several modules: let a stronger stage look
  if (opts.requireMatch || narrowed.length !== 1) return undefined;
  // Named collection but no such entry: the preview will say so – for free.
  const op = build(narrowed[0]!.ref, target);
  return op ? { ops: [op], confidence: 0.7 } : undefined;
}

/** Splits one input into sentences: lines and semicolons. */
export const splitSegments = (text: string): string[] =>
  text
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SEGMENTS);

export async function parseWrite(
  text: string,
  ctx: RuleContext,
): Promise<WriteProposal | undefined> {
  const segments = splitSegments(text);
  if (segments.length === 0) return undefined;
  const ops: ProposedOp[] = [];
  let confidence = 1;
  for (const segment of segments) {
    const r = await segmentToOp(segment, ctx);
    if (!r) return undefined;
    ops.push(...r.ops);
    confidence = Math.min(confidence, r.confidence);
  }
  return { ops, stage: 'rule', confidence };
}
