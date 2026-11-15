import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
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
import { forwardFields, replyFields } from '@/core/mail/reply';
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
  const [preview, setPreview] = useState<{ name: string; src: string } | undefined>();
  if (message.attachments.length === 0) return null;
  async function view(id: string, name: string, mime: string) {
    setBusy(id);
    try {
      setPreview({ name, src: dataUrl(await mailAttachment(account, message.id, id), mime) });
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
      const outcome = await getPlatform().saveFile({ fileName, data, mime });
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
          </li>
        ))}
      </ul>
      <Dialog
        open={preview !== undefined}
        onClose={() => setPreview(undefined)}
        title={preview?.name ?? ''}
        size="roomy"
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
 * mail or cannot be fetched stays out, and the toast names it.
 */
async function forwardWithAttachments(
  message: MailMessage,
  account: MailAccountRef,
): Promise<[ComposeState, string]> {
  const [state, title] = composeOf('forward', message, account);
  const skipped: string[] = [];
  let total = state.text.length;
  for (const a of message.attachments) {
    if (total + a.size > MAX_MAIL_BYTES) {
      skipped.push(a.filename);
      continue;
    }
    try {
      const data = await mailAttachment(account, message.id, a.id);
      total += data.length;
      state.attachments.push({ filename: a.filename, mime: a.mime, data });
    } catch {
      skipped.push(a.filename);
    }
  }
  if (skipped.length)
    useUiStore.getState().toast(t.mail.write.compose.forwardSkipped(skipped.join(', ')));
  return [state, title];
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
  if (kind === 'forward')
    return [
      emptyCompose(
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
    emptyCompose(
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
      }),
      t.mail.write.compose.titleDraft,
    );
  }

  const [cid, setCid] = useState<Record<string, string>>({});
  const [forwarding, setForwarding] = useState(false);
  async function forward() {
    if (message.attachments.length === 0)
      return onCompose(...composeOf('forward', message, account));
    setForwarding(true);
    useUiStore.getState().toast(t.mail.write.compose.forwardLoading);
    try {
      onCompose(...(await forwardWithAttachments(message, account)));
    } finally {
      setForwarding(false);
    }
  }
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
                  <Button disabled={forwarding} onClick={() => void forward()}>
                    {t.mail.write.forward}
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
  const newestAny = messages?.at(-1);
  const canCompose = hasFeature(account, 'mail-send') || hasFeature(account, 'mail-modify');
  useMailKeys(shortcuts && canCompose && !!newest, {
    reply: () => newest && onCompose(...composeOf('reply', newest, account)),
    replyAll: () =>
      newest &&
      newest.to.length + newest.cc.length > 1 &&
      onCompose(...composeOf('replyAll', newest, account)),
    forward: () => {
      if (newest) void forwardWithAttachments(newest, account).then((r) => onCompose(...r));
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
        {newestAny?.unsubscribeUrl ? <Unsubscribe url={newestAny.unsubscribeUrl} /> : null}
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
