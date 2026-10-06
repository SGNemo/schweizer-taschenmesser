import { useCallback, useEffect, useRef, useState } from 'react';
import { ask, type AskResponse } from '@/core/ai/assistant';
import { createRouterProvider, loadAiConfig } from '@/core/ai/config';
import { isAiOn } from '@/core/ai/switch';
import { searchEntries } from '@/core/ai/search/fulltext';
import type { ResultRow } from '@/core/ai/query/types';
import { db } from '@/core/db/db';
import { activeManifests } from '@/core/modules/contributions';
import { loadModuleStates, useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { createLocalStage } from '@/core/ai/local/stage';
import { localModelActive, localStageReady, useLocalModel } from '@/core/ai/local/state';
import { cloudAllowed, loadAiWriteSettings } from '@/core/ai/write/settings';
import { today } from '@/core/time/dates';

export type AnswerState =
  | { phase: 'idle' }
  | { phase: 'loading'; question: string }
  | { phase: 'done'; question: string; response: AskResponse };

/** Runs the assistant pipeline for the palette; a new question cancels the previous one. */
export function useAssistant() {
  const [state, setState] = useState<AnswerState>({ phase: 'idle' });
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => controller.current?.abort(), []);

  const submit = useCallback(
    async (question: string, forceModel = false, preferModule?: string) => {
      controller.current?.abort();
      const ctl = new AbortController();
      controller.current = ctl;
      if (!(await isAiOn())) {
        setState({ phase: 'idle' });
        return;
      }
      setState({ phase: 'loading', question });
      const [config, states, writeSettings] = await Promise.all([
        loadAiConfig(),
        loadModuleStates(),
        loadAiWriteSettings(),
        // What the shell has decides whether stage 1 is asked at all.
        useLocalModel.getState().refresh(),
      ]);
      const response = await ask(question, {
        manifests: activeManifests(states),
        known: availableManifests(),
        today: today(),
        provider: await createRouterProvider(config),
        database: db,
        forceModel,
        signal: ctl.signal,
        preferModule,
        write: {
          enabled: writeSettings.enabled,
          modulesOff: writeSettings.modulesOff,
          cloud: cloudAllowed(writeSettings, localModelActive()),
          askMissing: writeSettings.askMissing,
          local: localStageReady() ? createLocalStage() : undefined,
        },
      });
      if (!ctl.signal.aborted) setState({ phase: 'done', question, response });
    },
    [],
  );

  const reset = useCallback(() => {
    controller.current?.abort();
    setState({ phase: 'idle' });
  }, []);

  return { state, submit, reset };
}

const DEBOUNCE_MS = 150;

/** Live full text hits while typing (debounced). */
export function useSearchHits(query: string, limit = 5): ResultRow[] {
  const states = useModuleStates();
  const [hits, setHits] = useState<{ query: string; rows: ResultRow[] }>({ query: '', rows: [] });
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2 || !states) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchEntries(
        q,
        { manifests: activeManifests(states), database: db },
        limit,
        false,
      ).then((rows) => !cancelled && setHits({ query: q, rows }));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, states, limit]);

  return hits.query === q ? hits.rows : [];
}
