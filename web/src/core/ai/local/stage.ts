import { getPlatform } from '@/core/platform';
import { writableModules } from '../prompt';
import type { LocalStage } from '../write/stages';
import { parseAnswer } from './answer';
import { findModelByFile } from './catalogue';
import { buildGrammar } from './grammar';
import { getLocalPrefs } from './prefs';
import { formatChat, systemPrompt, userMessage } from './prompts/v1';
import { ensureLoaded, localStageReady } from './state';

/** Longest answer the grammar allows is a few hundred tokens; 8 ops × ~50 tokens. */
const MAX_TOKENS = 480;

/**
 * Stage 1 of the AI entry pipeline: the built-in model reads the sentence, forced by a grammar into
 * the same proposal format as the other stages. 0 tokens, nothing leaves the device. Any trouble
 * (not loaded, invalid answer, aborted) is `undefined`: the pipeline goes on to the next stage.
 */
export function createLocalStage(): LocalStage {
  return {
    available: localStageReady,
    async propose(text, ctx) {
      const entry = findModelByFile(getLocalPrefs().file);
      const writable = writableModules(ctx.manifests);
      if (!entry || writable.length === 0) return undefined;
      try {
        if (!(await ensureLoaded())) return undefined;
        const prompt = formatChat(
          entry.template,
          systemPrompt(writable),
          userMessage(text, ctx.today),
        );
        const result = await getPlatform().localModel.generate(
          { prompt, grammar: buildGrammar(writable), maxTokens: MAX_TOKENS },
          { signal: ctx.signal },
        );
        return result.stop === 'done' ? parseAnswer(result.text) : undefined;
      } catch {
        return undefined;
      }
    },
  };
}
