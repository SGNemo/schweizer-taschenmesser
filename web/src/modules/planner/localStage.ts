/**
 * Stage 1 of the planner's field (docs/design/plan/CONCEPT.md §6b): the built-in local model reads a
 * German sentence the rules (stage 0, `core/plan/instructions.ts`) could not place, with the
 * planner's own prompt and grammar (`core/ai/local/prompts/plan.ts`). Desktop with a downloaded
 * model only, and only while AI is on: `(await isAiOn()) && localStageReady()`; Android and the PWA
 * never get here (the shell reports `unavailable`), so they have stage 0 and nothing else.
 *
 * It walks the steps of `core/ai/local/stage.ts` itself – `findModelByFile`, `ensureLoaded`,
 * `formatChat`, `getPlatform().localModel.generate` – because the planner has no `aiSchema` and
 * must not go through `aiModules()`, `writableModules` or `core/ai/write`. It never calls the
 * router and never `fetch`; nothing leaves the device. Every answer is checked against the plan
 * (keys, dates, ranges) and ends in the preview like a stage-0 instruction; any trouble (not loaded,
 * invalid answer, aborted) means: the rules' reading stands.
 */
import { findModelByFile } from '@/core/ai/local/catalogue';
import { getLocalPrefs } from '@/core/ai/local/prefs';
import {
  buildPlanGrammar,
  compactPlan,
  parsePlanAnswer,
  PLAN_MAX_TOKENS,
  planSystemPrompt,
  planUserMessage,
  type PlanLine,
} from '@/core/ai/local/prompts/plan';
import { formatChat } from '@/core/ai/local/prompts/v1';
import { ensureLoaded, localStageReady, useLocalModel } from '@/core/ai/local/state';
import { isAiOn } from '@/core/ai/switch';
import { fold } from '@/core/ai/text';
import {
  parseInstruction,
  type Instruction,
  type InstructionContext,
  type InstructionItem,
  type PlanOp,
} from '@/core/plan/instructions';
import { getPlatform } from '@/core/platform';

/** 0 = the rules read the sentence, 1 = the local model did (the preview says so). */
export type SayStage = 0 | 1;
export type Said =
  | (Instruction & { stage: 0 })
  /** The model's reading, with what the rules made of the sentence (what stands when the user discards it). */
  | { kind: 'ops'; ops: PlanOp[]; stage: 1; rules: Instruction };

export interface SayContext extends InstructionContext {
  /** The compact plan the model may see (`say.ts` `planLines`). */
  lines: readonly PlanLine[];
}

/** Can the model be asked right now? Off switch first, then the shell's last reported status. */
export async function localStageAvailable(): Promise<boolean> {
  return (await isAiOn()) && localStageReady();
}

/**
 * Fills the status `localStageReady()` reads (the planner page calls it once). Only where a model
 * can exist at all (the desktop app) and only while AI is on: the web app and Android ask nothing.
 */
export async function warmLocalStage(): Promise<void> {
  if (!getPlatform().localModel.supported) return;
  if (!(await isAiOn())) return;
  await useLocalModel.getState().refresh();
}

/**
 * The model's reading of a sentence: ops for the engine, `[]` for "not an instruction", `undefined`
 * when it could not answer. Checks nothing but the plan; the caller shows the preview.
 */
export async function readWithModel(
  text: string,
  lines: readonly PlanLine[],
  today: string,
  signal?: AbortSignal,
): Promise<PlanOp[] | undefined> {
  const entry = findModelByFile(getLocalPrefs().file);
  if (!entry || signal?.aborted) return undefined;
  const plan = compactPlan(lines);
  try {
    // The first use loads the model (seconds): Escape ends the wait at once, the load may finish on its own.
    if (!(await raceAbort(ensureLoaded(), signal)) || signal?.aborted) return undefined;
    const prompt = formatChat(
      entry.template,
      planSystemPrompt(),
      planUserMessage(plan, text, today),
    );
    const result = await getPlatform().localModel.generate(
      { prompt, grammar: buildPlanGrammar(plan.length), maxTokens: PLAN_MAX_TOKENS },
      { signal },
    );
    return result.stop === 'done' ? parsePlanAnswer(result.text, plan, today) : undefined;
  } catch {
    return undefined;
  }
}

/** Words half of all ToDos share with a title never name a thing: fillers, and verbs by their ending. */
const COMMON = new Set([
  'noch',
  'bitte',
  'heute',
  'morgen',
  'dann',
  'nicht',
  'mehr',
  'alles',
  'wieder',
]);
/** Resolves to `false` as soon as the signal aborts, otherwise to the promise's value. */
function raceAbort(p: Promise<boolean>, signal?: AbortSignal): Promise<boolean> {
  if (!signal) return p;
  return new Promise((resolve) => {
    const stop = () => resolve(false);
    signal.addEventListener('abort', stop, { once: true });
    p.then(resolve, () => resolve(false)).finally(() => signal.removeEventListener('abort', stop));
  });
}

const words = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
const nameWords = (s: string): string[] =>
  words(s).filter((w) => !COMMON.has(w) && !/(?:en|ern|eln)$/.test(w));

/**
 * Is the sentence worth a model call? The rules already said it looks like an instruction (a
 * planning verb, a day word) but could not read it – or it names a thing of the plan by a word that
 * is no verb and no filler („Steuer“, „Keller“ – not „anrufen“), which a plain new ToDo rarely does.
 * The ending rule also drops plural nouns („Unterlagen“, „Rechnungen“): such a sentence without a
 * planning verb or a day word stays a ToDo, as before this stage – the safe direction. Everything
 * else stays a ToDo without waiting for a model.
 */
export function worthAsking(
  said: Instruction,
  text: string,
  items: readonly InstructionItem[],
): boolean {
  if (said.kind === 'explain' || said.kind === 'missing') return true;
  if (said.kind !== 'none') return false;
  const own = new Set(words(text));
  return items.some((i) => nameWords(i.title).some((w) => own.has(w)));
}

/**
 * The field's reading of a sentence: stage 0 first (0 tokens, also with „KI aus“); the model only for
 * what the rules could not read, only when available, and only its non-empty, valid answers – otherwise
 * the rules' result stands (a calm line, a question, or a ToDo).
 */
export async function readSentence(
  text: string,
  ctx: SayContext,
  opts: { signal?: AbortSignal; onModel?: () => void; model?: boolean } = {},
): Promise<Said> {
  const said = parseInstruction(text, ctx);
  const byRules: Said = { ...said, stage: 0 };
  if (said.kind === 'ops' || said.kind === 'ask') return byRules;
  // `model: false` = the user discarded the model's reading of this sentence: the rules' result stands.
  if (opts.model === false || !worthAsking(said, text, ctx.items)) return byRules;
  // The switch and the status are read outside the model's own try: any trouble there means stage 0 stands.
  if (!(await localStageAvailable().catch(() => false))) return byRules;
  opts.onModel?.();
  const ops = await readWithModel(text, ctx.lines, ctx.today, opts.signal);
  if (!ops || ops.length === 0) return byRules;
  return { kind: 'ops', ops, stage: 1, rules: said };
}
