import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import { mailAttachment, mailThread, mailWebUrl } from '@/core/mail/service';
import type { MailLinkType } from '@/core/mail/prefill';
import type {
  MailAttachment,
  MailAccountRef,
  MailErrorCode,
  MailLabel,
  MailMessage,
  ThreadChange,
} from '@/core/mail/types';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Icon, Skeleton } from '@/ui';
import { MAX_MAIL_BYTES } from '@/core/mail/compose';
import { DEMO_ACCOUNT, loadThreadBodies, saveBody } from '../cache';
import { fullWhen, personName, subjectOf } from '../format';
import { formatAddress } from '@/core/mail/address';
import { attachmentFileName } from '@/core/mail/fileName';
import { forwardFields, replyFields, type ComposeFields } from '@/core/mail/reply';
import { hasFeature, mailDrafts } from '@/core/mail/service';
import { mailText } from '@/core/mail/prefill';
import { emptyCompose, type ComposeState } from '../composeState';
import { LinkDialog } from './LinkDialog';
import { useModuleStates } from '@/core/modules/activation';
import { fromOf, planMail, plannedThreads } from '../planMail';
import { LocalSummary } from './LocalSummary';
import { ThreadActions, ThreadLabels } from './ThreadActions';
import { useMailKeys } from '../useMailKeys';
import { applyChange } from '../mailActions';
import { LinkMenu } from './LinkMenu';
import { LinkedEntries } from './LinkedEntries';
import { MailFrame } from './MailFrame';
import { MailError } from './MailError';
import styles from './mail.module.css';

const INLINE_LIMIT = 300_000;
const INLINE_MAX = 8;

function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

const size = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function Attachments({ account, message }: { account: MailAccountRef; message: MailMessage }) {
  const toast = useUiStore((st) => st.toast);
  const [busy, setBusy] = useState<string | undefined>();
  const [preview, setPreview] = useState<{ id: string; name: string; src: string } | undefined>();
  // The object URL lives as long as the preview is open.
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview.src) : undefined), [preview]);
  if (message.attachments.length === 0) return null;
  async function view(id: string, name: string, mime: string) {
    setBusy(id);
    try {
      const data = await mailAttachment(account, message.id, id);
      if (data.length > PREVIEW_MAX) throw new Error('too large');
      setPreview({
        id,
        name,
        src: URL.createObjectURL(new Blob([new Uint8Array(data)], { type: mime })),
      });
    } catch {
      toast(t.mail.view.previewFailed);
    } finally {
      setBusy(undefined);
    }
  }
  async function download(id: string, fileName: string, mime: string) {
    setBusy(id);
    try {
      const data = await mailAttachment(account, message.id, id);
      const outcome = await getPlatform().saveFile({
        fileName: attachmentFileName(fileName),
        data,
        mime,
      });
      if (outcome === 'saved') toast(t.mail.view.saved);
    } catch {
      toast(t.mail.view.downloadFailed);
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <section>
      <p className={styles.meta}>{t.mail.view.attachments}</p>
      <ul className={styles.attachments}>
        {message.attachments.map((a) => (
          <li key={a.id} className={styles.attachment}>
            <span>
              {a.filename} <span className={styles.meta}>({size(a.size)})</span>
            </span>
            <span className={styles.row}>
              {canPreview(a) ? (
                <Button
                  variant="ghost"
                  disabled={busy !== undefined}
                  aria-label={t.mail.view.preview(a.filename)}
                  onClick={() => void view(a.id, a.filename, a.mime)}
                >
                  {t.mail.view.previewLabel}
                </Button>
              ) : null}
              <Button
                disabled={busy !== undefined}
                aria-label={t.mail.view.download(a.filename)}
                onClick={() => void download(a.id, a.filename, a.mime)}
              >
                <Icon name="download" /> {t.mail.view.downloadLabel}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <Dialog
        open={preview !== undefined}
        onClose={() => setPreview(undefined)}
        title={preview?.name ?? ''}
        size="roomy"
        footer={
          preview ? (
            <Button
              onClick={() => {
                const a = message.attachments.find((x) => x.id === preview.id);
                if (a) void download(a.id, a.filename, a.mime);
              }}
            >
              <Icon name="download" /> {t.mail.view.downloadLabel}
            </Button>
          ) : undefined
        }
      >
        {preview ? <img className={styles.preview} src={preview.src} alt={preview.name} /> : null}
      </Dialog>
    </section>
  );
}

/**
 * Images the app can show itself (a data URL inside the app's own CSP, never in the mail frame). SVG stays
 * out: it can carry script and links; PDF cannot be framed (the app allows no frames), it is saved instead.
 */
const PREVIEW_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const PREVIEW_MAX = 8 * 1_048_576;
const canPreview = (a: MailAttachment) => PREVIEW_MIMES.has(a.mime) && a.size <= PREVIEW_MAX;

/**
 * Forward with the original attachments: they are fetched and put into the compose window, where each one
 * is listed and can be removed before the review step (nothing travels unseen). What is too large for one
 * mail or cannot be fetched stays out, and the compose window names it.
 */
async function forwardWithAttachments(
  message: MailMessage,
  account: MailAccountRef,
): Promise<[ComposeState, string]> {
  const [state, title] = composeOf('forward', message, account);
  // Decided up front from the sizes the mail names, so the fetches can run side by side.
  let budget = MAX_MAIL_BYTES - state.text.length;
  // One that does not fit is left out; smaller ones after it still go.
  const fits = message.attachments.filter((a) => {
    if (a.size > budget) return false;
    budget -= a.size;
    return true;
  });
  const fetched = await Promise.all(
    fits.map((a) =>
      mailAttachment(account, message.id, a.id).then(
        (data) => ({ filename: a.filename, mime: a.mime, data }),
        () => undefined,
      ),
    ),
  );
  state.attachments = fetched.filter((x) => x !== undefined);
  const fitIds = new Set(fits.map((a) => a.id));
  const keptIds = new Set(fits.filter((_, i) => fetched[i] !== undefined).map((a) => a.id));
  const names = (list: MailAttachment[]) => list.map((a) => a.filename).join(', ');
  const left = message.attachments.filter((a) => !fitIds.has(a.id));
  // Too large on its own vs. no room left beside the others: different advice for each.
  const tooLarge = left.filter((a) => a.size > MAX_MAIL_BYTES - state.text.length);
  const together = left.filter((a) => !tooLarge.includes(a));
  const failed = fits.filter((a) => !keptIds.has(a.id));
  // A lasting line in the compose window, not only a toast that the window could cover.
  const notes = [
    tooLarge.length ? t.mail.write.compose.forwardTooLarge(names(tooLarge)) : '',
    together.length ? t.mail.write.compose.forwardTogether(names(together)) : '',
    failed.length ? t.mail.write.compose.forwardFailed(names(failed)) : '',
  ].filter(Boolean);
  if (notes.length) state.forwardNote = notes.join(' ');
  return [state, title];
}

/**
 * One forward at a time per thread view: the button and the F key share it, a second press while the
 * attachments load does nothing, and a result that arrives after the view is gone is dropped.
 */
function useForward(account: MailAccountRef, onCompose: (s: ComposeState, title: string) => void) {
  const [busy, setBusy] = useState<string | undefined>();
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const forward = (message: MailMessage) => {
    if (running.current) return;
    if (message.attachments.length === 0)
      return onCompose(...composeOf('forward', message, account));
    running.current = true;
    setBusy(message.id);
    // Also for the F key, whose card may be folded: the wait is said once.
    useUiStore.getState().toast(t.mail.write.compose.forwardLoading);
    void forwardWithAttachments(message, account)
      .then((r) => {
        if (alive.current) onCompose(...r);
      })
      .finally(() => {
        running.current = false;
        if (alive.current) setBusy(undefined);
      });
  };
  return { forward, busy };
}

/**
 * „Newsletter abbestellen …“: only for an https unsubscribe page, and only after a confirmation that names
 * the site; Nemo opens the page in the browser and sends nothing itself.
 */
function Unsubscribe({ url }: { url: string }) {
  const [asking, setAsking] = useState(false);
  const host = new URL(url).hostname;
  return (
    <>
      <Button variant="ghost" onClick={() => setAsking(true)}>
        {t.mail.view.unsubscribe}
      </Button>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={t.mail.view.unsubscribeTitle}
        footer={<Button onClick={() => setAsking(false)}>{t.actions.cancel}</Button>}
      >
        <div className={styles.panel}>
          <p>{t.mail.view.unsubscribeBody(host)}</p>
          <Button
            variant="primary"
            data-autofocus
            onClick={() => {
              setAsking(false);
              void getPlatform().app.openUrl(url);
            }}
          >
            {t.mail.view.unsubscribeOpen}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** Reply, reply all or forward to one message: the compose window's prefill and title. */
function composeOf(
  kind: 'reply' | 'replyAll' | 'forward',
  message: MailMessage,
  account: MailAccountRef,
): [ComposeState, string] {
  const body = (message.text ?? mailText(message, 3000)).slice(0, 3000);
  // The quote or forward header the window starts with: snippets go above it and never take it along.
  const withPrefill = (f: ComposeFields): ComposeState =>
    emptyCompose({ ...f, prefill: f.text.replace(/^\n+/, '') });
  if (kind === 'forward')
    return [
      withPrefill(
        forwardFields(message, {
          header: t.mail.write.compose.forwardHeader(
            formatAddress(message.from),
            fullWhen(message.date),
            message.subject,
          ),
          body,
        }),
      ),
      t.mail.write.compose.titleForward,
    ];
  return [
    withPrefill(
      replyFields(message, {
        all: kind === 'replyAll',
        me: account.email,
        quoteHeader: t.mail.write.compose.quoteHeader(
          fullWhen(message.date),
          personName(message.from),
        ),
        body,
      }),
    ),
    t.mail.write.compose.titleReply,
  ];
}

function MessageCard({
  account,
  threadId,
  link,
  message,
  open,
  onToggle,
  autoLoadImages,
  onCompose,
  onForward,
  forwarding,
  forwardBlocked,
  localAi,
  startLink,
}: {
  account: MailAccountRef;
  threadId: string;
  link?: string;
  localAi: boolean;
  /** Opens „Aus dieser Mail anlegen“ with this type at once (an unsure invoice row of the list). */
  startLink?: MailLinkType;
  message: MailMessage;
  open: boolean;
  onToggle: () => void;
  autoLoadImages: boolean;
  onCompose: (state: ComposeState, title: string) => void;
  onForward: (message: MailMessage) => void;
  /** This message's forward is loading (its button says so). */
  forwarding: boolean;
  /** Any forward of the thread is loading: one at a time. */
  forwardBlocked: boolean;
}) {
  const canCompose = hasFeature(account, 'mail-send') || hasFeature(account, 'mail-modify');
  const isDraft = message.labelIds.includes('DRAFT');

  async function editDraft() {
    let draftId: string | undefined;
    try {
      draftId = (await mailDrafts(account)).find((d) => d.messageId === message.id)?.id;
    } catch {
      // without the id the draft is saved as a new one; the old one stays in Gmail
    }
    onCompose(
      emptyCompose({
        to: message.to.map(formatAddress).join(', '),
        cc: message.cc.map(formatAddress).join(', '),
        subject: message.subject,
        text: message.text ?? mailText(message),
        threadId: message.threadId,
        draftId,
        // A reopened draft may hold a quote in any layout (Gmail web, mobile, HTML): never a snippet source.
        fromDraft: true,
      }),
      t.mail.write.compose.titleDraft,
    );
  }

  const [cid, setCid] = useState<Record<string, string>>({});

  const [linkType, setLinkType] = useState<MailLinkType | undefined>(startLink);

  useEffect(() => {
    if (!open || account.key === DEMO_ACCOUNT || message.inline.length === 0) return;
    let alive = true;
    void (async () => {
      const out: Record<string, string> = {};
      for (const part of message.inline.slice(0, INLINE_MAX)) {
        if (part.size > INLINE_LIMIT) continue;
        try {
          out[part.contentId] = dataUrl(
            await mailAttachment(account, message.id, part.attachmentId),
            part.mime,
          );
        } catch {
          // an inline image that cannot be fetched is simply missing
        }
      }
      if (alive) setCid(out);
    })();
    return () => {
      alive = false;
    };
  }, [open, account, message]);

  const who = personName(message.from);
  return (
    <article className={styles.message}>
      <button
        type="button"
        className={styles.messageHead}
        aria-expanded={open}
        aria-label={open ? undefined : t.mail.view.expand(who)}
        onClick={onToggle}
      >
        <span className={styles.who}>{who}</span>
        <span className={styles.meta}>{fullWhen(message.date)}</span>
      </button>
      {open ? (
        <div className={styles.body}>
          <p className={styles.meta}>
            {t.mail.view.from}:{' '}
            {message.from.name
              ? `${message.from.name} <${message.from.email}>`
              : message.from.email}
            <br />
            {t.mail.view.to}: {message.to.map(personName).join(', ')}
            {message.cc.length > 0 ? (
              <>
                <br />
                {t.mail.view.cc}: {message.cc.map(personName).join(', ')}
              </>
            ) : null}
          </p>
          <MailFrame
            subject={subjectOf(message.subject)}
            html={message.html}
            text={message.text}
            cid={cid}
            autoLoadImages={autoLoadImages}
          />
          <Attachments account={account} message={message} />
          {localAi ? <LocalSummary message={message} /> : null}
          {canCompose ? (
            <div className={styles.row} data-testid="mail-reply">
              {isDraft ? (
                <Button onClick={() => void editDraft()}>{t.mail.write.editDraft}</Button>
              ) : (
                <>
                  <Button onClick={() => onCompose(...composeOf('reply', message, account))}>
                    {t.mail.write.reply}
                  </Button>
                  {message.to.length + message.cc.length > 1 ? (
                    <Button onClick={() => onCompose(...composeOf('replyAll', message, account))}>
                      {t.mail.write.replyAll}
                    </Button>
                  ) : null}
                  <Button disabled={forwardBlocked} onClick={() => onForward(message)}>
                    {forwarding ? t.mail.write.compose.forwardLoading : t.mail.write.forward}
                  </Button>
                </>
              )}
            </div>
          ) : null}
          <LinkMenu onPick={setLinkType} />
          <LinkDialog
            account={account}
            threadId={threadId}
            message={message}
            link={link}
            localAi={localAi}
            type={linkType}
            onClose={() => setLinkType(undefined)}
          />
        </div>
      ) : null}
    </article>
  );
}

/** One thread: its messages, the newest open. */
export function ThreadView({
  account,
  threadId,
  cacheBodies,
  autoLoadImages,
  labels,
  confirmMoves,
  localAi = false,
  shortcuts = false,
  onChanged,
  onCompose,
  onBack,
  startInvoice = false,
}: {
  account: MailAccountRef;
  threadId: string;
  cacheBodies: boolean;
  autoLoadImages: boolean;
  labels: MailLabel[];
  confirmMoves: boolean;
  /** The local model may read mail (module setting, off by default). */
  localAi?: boolean;
  /** Gmail-style keys (module setting): r/a/f here, the moves in `ThreadActions`. */
  shortcuts?: boolean;
  /** A change at the service went through: the list should reload. */
  onChanged: () => void;
  onCompose: (state: ComposeState, title: string) => void;
  onBack: () => void;
  /** The list asked for the invoice sheet of the newest message (its values were unsure). */
  startInvoice?: boolean;
}) {
  const [messages, setMessages] = useState<MailMessage[] | undefined>();
  // The thread's labels after a change here (undefined: as loaded).
  const [labelsNow, setLabelsNow] = useState<string[] | undefined>();
  const [error, setError] = useState<MailErrorCode | undefined>();
  const [openIds, setOpenIds] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      let list: MailMessage[];
      if (account.key === DEMO_ACCOUNT) list = await loadThreadBodies(account.key, threadId);
      else {
        try {
          list = (await mailThread(account, threadId)).messages;
          if (cacheBodies) for (const m of list) await saveBody(account.key, m);
        } catch (e) {
          if (!alive) return;
          setError(
            e instanceof ConnectorError &&
              (e.code === 'expired' || e.code === 'denied' || e.code === 'rate-limited')
              ? e.code
              : 'network',
          );
          list = await loadThreadBodies(account.key, threadId); // saved copies, if any
        }
      }
      if (!alive) return;
      setMessages(list);
      setOpenIds(list.length ? [list[list.length - 1]!.id] : []);
    })();
    return () => {
      alive = false;
    };
  }, [account, threadId, cacheBodies]);

  const subject = messages?.[0] ? subjectOf(messages[0].subject) : '';
  // r/a/f answer the newest message that is not a draft, like its buttons.
  const newest = messages?.filter((m) => !m.labelIds.includes('DRAFT')).at(-1);
  // The newest message that names an unsubscribe page; never in spam (opening it there confirms the address).
  const newsletter = messages
    ?.filter(
      (m) =>
        m.unsubscribeUrl && !m.labelIds.some((l) => l === 'DRAFT' || l === 'SPAM' || l === 'TRASH'),
    )
    .at(-1);
  const { forward, busy: forwarding } = useForward(account, onCompose);
  const canCompose = hasFeature(account, 'mail-send') || hasFeature(account, 'mail-modify');
  useMailKeys(shortcuts && canCompose && !!newest, {
    reply: () => newest && onCompose(...composeOf('reply', newest, account)),
    replyAll: () =>
      newest &&
      newest.to.length + newest.cc.length > 1 &&
      onCompose(...composeOf('replyAll', newest, account)),
    forward: () => {
      if (newest) forward(newest);
    },
  });
  const loaded = [...new Set(messages?.flatMap((m) => m.labelIds) ?? [])];
  const labelIds = labelsNow ?? loaded;
  // Functional: two changes in flight (a star and a label) both land on the newest state.
  const onLabels = (change: ThreadChange) =>
    setLabelsNow((prev) => applyChange(prev ?? loaded, change));
  const web = mailWebUrl(account, threadId);
  const states = useModuleStates();
  const planned = useLiveQuery(() => plannedThreads(account.key), [account.key]);
  // What entries store: the same thread without the account's address (U17); „In Gmail öffnen“ keeps it.
  const stored = mailWebUrl(account, threadId, { forStorage: true });
  return (
    <div
      className={styles.thread}
      data-shortcut-scope={shortcuts && hasFeature(account, 'mail-modify') ? 'mail' : undefined}
    >
      <div className={styles.row}>
        <Button onClick={onBack}>
          <Icon name="chevronLeft" /> {t.mail.view.back}
        </Button>
        {web && account.key !== DEMO_ACCOUNT ? (
          <Button onClick={() => void getPlatform().app.openUrl(web)}>
            {t.mail.view.openInGmail}
          </Button>
        ) : null}
        {states?.todos && messages?.length ? (
          planned?.has(threadId) ? (
            <span className={styles.planMark} data-testid="mail-in-plan">
              {states.planner ? t.mail.plan.thread : t.mail.plan.todo.thread}
            </span>
          ) : (
            <Button
              data-testid="mail-plan-thread"
              onClick={() =>
                void planMail(
                  account,
                  {
                    id: threadId,
                    from: fromOf(account, messages),
                    subject: messages[0]!.subject,
                  },
                  onChanged,
                )
              }
            >
              {states.planner ? t.mail.plan.action : t.mail.plan.asTodo}
            </Button>
          )
        ) : null}
      </div>
      {messages ? (
        <ThreadActions
          account={account}
          threadId={threadId}
          labelIds={labelIds}
          inTrash={!!messages.length && messages.every((m) => m.labelIds.includes('TRASH'))}
          inSpam={!!messages.length && messages.every((m) => m.labelIds.includes('SPAM'))}
          labels={labels}
          confirmMoves={confirmMoves}
          shortcuts={shortcuts}
          onLabels={onLabels}
          onChanged={onChanged}
          onLeave={onBack}
        />
      ) : null}
      {messages === undefined ? <Skeleton height="6rem" /> : <h2>{subject}</h2>}
      {/* Beside the subject, not in the toolbar: it belongs to this newsletter, and the bar keeps three buttons. */}
      {newsletter?.unsubscribeUrl ? (
        <div className={styles.row}>
          <Unsubscribe url={newsletter.unsubscribeUrl} />
        </div>
      ) : null}
      {messages ? (
        <ThreadLabels
          account={account}
          threadId={threadId}
          labelIds={labelIds}
          labels={labels}
          onLabels={onLabels}
          onChanged={onChanged}
        />
      ) : null}
      {error ? <MailError code={error} /> : null}
      {messages?.length === 0 && !error ? (
        <p className={styles.hint}>{t.mail.view.loadFailed}</p>
      ) : null}
      {messages?.map((m) => (
        <MessageCard
          key={m.id}
          account={account}
          threadId={threadId}
          link={stored}
          message={m}
          open={openIds.includes(m.id) || messages.length === 1}
          autoLoadImages={autoLoadImages}
          onCompose={onCompose}
          onForward={forward}
          forwarding={forwarding === m.id}
          forwardBlocked={forwarding !== undefined}
          localAi={localAi}
          startLink={
            startInvoice && m.id === messages[messages.length - 1]!.id ? 'invoice' : undefined
          }
          onToggle={() =>
            setOpenIds((ids) =>
              ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id],
            )
          }
        />
      ))}
      <LinkedEntries accountKey={account.key} threadId={threadId} />
      {hasFeature(account, 'mail-modify') ? null : (
        <p className={styles.hint}>{t.mail.view.readOnly}</p>
      )}
    </div>
  );
}
