import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { loadAiConfig, createRouterProvider } from '@/core/ai/config';
import { useLocalModel } from '@/core/ai/local/state';
import { downloadTextFile } from '@/core/backup/download';
import { availableManifests } from '@/core/modules/available';
import { activeManifests } from '@/core/modules/contributions';
import { loadModuleStates } from '@/core/modules/activation';
import type { Stored } from '@/core/db/types';
import { now } from '@/core/time/now';
import { today } from '@/core/time/dates';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import { tLegal } from '@/strings.legal';
import { Button, Checkbox, Dialog, Icon, IconButton, SelectField, TextArea, TextField } from '@/ui';
import { buildContext, contextModules } from '../context';
import {
  addQuestion,
  deleteThread,
  dropLastAnswer,
  editQuestion,
  generateReply,
  messagesOf,
  type ChatErrorCode,
} from '../engine';
import { exportMarkdown } from '../logic';
import { threadRepo } from '../repo';
import type { ChatEngine, Thread } from '../schema';
import styles from '../chat.module.css';
import { MessageView } from './MessageView';

const c = t.chat;

export function ThreadView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const thread = useLiveQuery(() => threadRepo.get(threadId), [threadId]);
  const legal = tLegal.use();
  const navigate = useNavigate();
  const messages = useLiveQuery(() => messagesOf(threadId), [threadId]);
  const [text, setText] = useState('');
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState<{ code: ChatErrorCode; detail?: string }>();
  const [preview, setPreview] = useState<{ question: string; context: string }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState<string>();
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => controller.current?.abort(), []);

  if (!thread || !messages) return null;

  async function reply() {
    const ctl = new AbortController();
    controller.current = ctl;
    setBusy(true);
    setError(undefined);
    setStreaming('');
    await useLocalModel.getState().refresh();
    const provider = await createRouterProvider(await loadAiConfig());
    const result = await generateReply(threadId, {
      provider,
      signal: ctl.signal,
      onToken: (piece) => setStreaming((s) => s + piece),
    });
    setBusy(false);
    setStreaming('');
    if (!result.ok && result.error !== 'aborted') {
      setError({ code: result.error, detail: result.detail });
    }
  }

  async function ask(question: string, context?: string) {
    await addQuestion(threadId, question, context);
    setText('');
    setAttach(false);
    await reply();
  }

  async function send() {
    const question = text.trim();
    if (!question || busy) return;
    if (attach && thread!.contextModules.length > 0) {
      const states = await loadModuleStates();
      const context = await buildContext(question, thread!.contextModules, {
        manifests: activeManifests(states),
        known: availableManifests(),
        today: today(),
      });
      // Nothing is sent before the user has seen it.
      setPreview({ question, context: context ?? '' });
      return;
    }
    await ask(question);
  }

  const last = messages[messages.length - 1];
  const awaitingReply = last?.role === 'user' && !busy;
  const lastAnswerId = last?.role === 'assistant' ? last.id : undefined;

  return (
    <section aria-label={thread.title}>
      <div className={styles.head}>
        <IconButton label={c.back} onClick={onBack}>
          <Icon name="chevronLeft" size={20} />
        </IconButton>
        {renaming !== undefined ? (
          <form
            style={{ flex: 1 }}
            onSubmit={(e) => {
              e.preventDefault();
              const title = renaming.trim();
              if (title) void threadRepo.update(threadId, { title, autoTitle: false });
              setRenaming(undefined);
            }}
          >
            <TextField
              label={c.rename}
              labelHidden
              value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
              data-autofocus
            />
          </form>
        ) : (
          <h2 className={styles.headTitle}>{thread.title}</h2>
        )}
        <IconButton label={c.rename} onClick={() => setRenaming(thread.title)}>
          <Icon name="edit" size={18} />
        </IconButton>
        <IconButton
          label={thread.pinned ? c.unpin : c.pin}
          onClick={() => void threadRepo.update(threadId, { pinned: !thread.pinned })}
        >
          <Icon name="pin" size={18} />
        </IconButton>
        <IconButton label={c.systemPrompt} onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" size={18} />
        </IconButton>
        <IconButton
          label={c.export}
          onClick={() =>
            void downloadTextFile(
              `${thread.title.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'chat'}.md`,
              exportMarkdown(thread, messages, { user: c.you, assistant: c.assistant }),
              'text/markdown',
            )
          }
        >
          <Icon name="download" size={18} />
        </IconButton>
        <IconButton
          label={thread.archived ? c.unarchive : c.archive}
          onClick={() => void threadRepo.update(threadId, { archived: !thread.archived })}
        >
          <Icon name="package" size={18} />
        </IconButton>
        <IconButton label={c.delete} onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" size={18} />
        </IconButton>
      </div>

      <div className={styles.messages} aria-live="polite">
        {messages.map((m) => (
          <MessageView
            key={m.id}
            message={m}
            busy={busy}
            isLastAnswer={m.id === lastAnswerId}
            onRegenerate={() => void dropLastAnswer(threadId).then(reply)}
            onEdit={(content) => void editQuestion(threadId, m.id, content, now()).then(reply)}
          />
        ))}
        {busy && streaming ? (
          <article className={styles.msg}>
            <div className={styles.body} style={{ whiteSpace: 'pre-wrap' }}>
              {streaming}
            </div>
          </article>
        ) : null}
        {error ? (
          <div className={styles.error} role="alert" data-testid="chat-error">
            <span>{c.errors[error.code] ?? c.errors.fallback}</span>
            <Button onClick={() => void reply()}>{c.retry}</Button>
          </div>
        ) : null}
        {awaitingReply && !error ? <Button onClick={() => void reply()}>{c.retry}</Button> : null}
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className={styles.composerRow}>
          <TextArea
            label={c.placeholder}
            placeholder={c.placeholder}
            value={text}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            data-autofocus
          />
          {busy ? (
            <Button onClick={() => controller.current?.abort()}>{c.stop}</Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!text.trim()}>
              {c.send}
            </Button>
          )}
        </div>
        {thread.contextModules.length > 0 ? (
          <Checkbox
            label={`${c.context.attach} – ${c.context.attachHint}`}
            checked={attach}
            onChange={(e) => setAttach(e.target.checked)}
          />
        ) : null}
        {thread.engine === 'router' ? (
          <div className={styles.usage} data-testid="chat-cloud-hint">
            <span>
              {legal.chat.cloudHint} {legal.chat.offHint}
            </span>{' '}
            <Button
              data-testid="chat-ai-off"
              onClick={() => void navigate(settingsPath('ki', 'ai-switch'))}
            >
              {legal.chat.offAction}
            </Button>
          </div>
        ) : null}
        <span className={styles.usage}>
          {c.usage(thread.tokensIn, thread.tokensOut, thread.costUsd)}
        </span>
      </form>

      {preview ? (
        <Dialog
          open
          onClose={() => setPreview(undefined)}
          title={c.context.previewTitle}
          footer={
            <>
              <Button onClick={() => setPreview(undefined)}>{c.cancel}</Button>
              <Button
                onClick={() => {
                  const q = preview.question;
                  setPreview(undefined);
                  void ask(q);
                }}
              >
                {c.context.previewWithout}
              </Button>
              {preview.context ? (
                <Button
                  variant="primary"
                  data-autofocus
                  onClick={() => {
                    const { question, context } = preview;
                    setPreview(undefined);
                    void ask(question, context);
                  }}
                >
                  {c.context.previewSend}
                </Button>
              ) : null}
            </>
          }
        >
          <p>
            {preview.context
              ? c.context.previewIntro(thread.engine === 'router')
              : c.context.nothing}
          </p>
          {preview.context ? (
            <pre className={styles.contextBox} data-testid="chat-context-preview">
              {preview.context}
            </pre>
          ) : null}
        </Dialog>
      ) : null}

      {settingsOpen ? (
        <ThreadSettings thread={thread} onClose={() => setSettingsOpen(false)} />
      ) : null}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={c.deleteTitle}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{c.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => void deleteThread(threadId).then(onBack)}
              data-testid="chat-delete-confirm"
            >
              {c.deleteConfirm}
            </Button>
          </>
        }
      >
        <p>{c.deleteBody}</p>
      </Dialog>
    </section>
  );
}

/** Engine, own instruction and the modules this chat may read. */
function ThreadSettings({ thread, onClose }: { thread: Stored<Thread>; onClose: () => void }) {
  const states = useLiveQuery(() => loadModuleStates(), []);
  const modules = states ? contextModules(activeManifests(states)) : [];
  const [prompt, setPrompt] = useState(thread.systemPrompt ?? '');
  return (
    <Dialog
      open
      onClose={() => {
        void threadRepo.update(thread.id, { systemPrompt: prompt.trim() || undefined });
        onClose();
      }}
      title={c.systemPrompt}
    >
      <div className={styles.facts}>
        <SelectField
          label={c.engine}
          value={thread.engine}
          hint={thread.engine === 'local' ? c.engineHintLocal : c.engineHintRouter}
          onChange={(e) =>
            void threadRepo.update(thread.id, { engine: e.target.value as ChatEngine })
          }
        >
          <option value="router">{c.engineRouter}</option>
          <option value="local">{c.engineLocal}</option>
        </SelectField>
        <TextArea
          label={c.systemPrompt}
          hint={c.systemPromptHint}
          value={prompt}
          rows={3}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <fieldset className={styles.modules}>
          <legend>{c.context.title}</legend>
          <p className={styles.usage}>{c.context.hint}</p>
          {modules.map((m) => (
            <Checkbox
              key={m.id}
              label={m.name}
              checked={thread.contextModules.includes(m.id)}
              onChange={(e) =>
                void threadRepo.update(thread.id, {
                  contextModules: e.target.checked
                    ? [...thread.contextModules, m.id]
                    : thread.contextModules.filter((id) => id !== m.id),
                })
              }
            />
          ))}
        </fieldset>
      </div>
    </Dialog>
  );
}
