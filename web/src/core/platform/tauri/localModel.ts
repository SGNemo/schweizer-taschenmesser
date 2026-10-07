import { Channel, invoke } from '@tauri-apps/api/core';
import type {
  LocalGenerateResult,
  LocalModelInfo,
  LocalModelService,
  LocalModelStatus,
} from '../localModel';
import { noLocalModel } from '../localModel';

type ProgressEvent = { event: 'progress'; data: { done: number; total: number } };
type TokenEvent = { event: 'piece'; data: { text: string } };

/** Rust errors arrive as plain strings (`checksum`, `network`, …); keep them as the message. */
const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

/** Bridge to `src-tauri/src/local_llm.rs`. Only the desktop shell has the commands. */
export function createLocalModel(supported: boolean): LocalModelService {
  if (!supported) return noLocalModel;
  return {
    supported: true,
    status: () => invoke<LocalModelStatus>('llm_status'),
    async download(spec, onProgress, signal) {
      const channel = new Channel<ProgressEvent>();
      channel.onmessage = (m) => onProgress(m.data.done, m.data.total);
      const cancel = () => void invoke('llm_download_cancel');
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        await invoke('llm_download', { spec, onEvent: channel });
      } catch (e) {
        throw asError(e);
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
    },
    remove: (file) =>
      invoke<void>('llm_remove', { file }).catch((e: unknown) => Promise.reject(asError(e))),
    load: (file, options) =>
      invoke<LocalModelInfo>('llm_load', {
        file,
        gpu: options.gpu,
        context: options.context,
      }).catch((e: unknown) => Promise.reject(asError(e))),
    unload: () => invoke<void>('llm_unload'),
    async generate(request, options) {
      const channel = new Channel<TokenEvent>();
      channel.onmessage = (m) => options?.onToken?.(m.data.text);
      const cancel = () => void invoke('llm_cancel');
      options?.signal?.addEventListener('abort', cancel, { once: true });
      try {
        return await invoke<LocalGenerateResult>('llm_generate', {
          prompt: request.prompt,
          grammar: request.grammar ?? null,
          maxTokens: request.maxTokens,
          onToken: channel,
        });
      } catch (e) {
        throw asError(e);
      } finally {
        options?.signal?.removeEventListener('abort', cancel);
      }
    },
  };
}
