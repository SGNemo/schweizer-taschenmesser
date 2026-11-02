import { useEffect, useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import { mailAttachment, mailThread, mailWebUrl } from '@/core/mail/service';
import type { MailAccountRef, MailErrorCode, MailMessage } from '@/core/mail/types';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Icon, Skeleton } from '@/ui';
import { DEMO_ACCOUNT, loadThreadBodies, saveBody } from '../cache';
import { fullWhen, personName, subjectOf } from '../format';
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
  if (message.attachments.length === 0) return null;
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
    </section>
  );
}

function MessageCard({
  account,
  message,
  open,
  onToggle,
  autoLoadImages,
}: {
  account: MailAccountRef;
  message: MailMessage;
  open: boolean;
  onToggle: () => void;
  autoLoadImages: boolean;
}) {
  const [cid, setCid] = useState<Record<string, string>>({});

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
  onBack,
}: {
  account: MailAccountRef;
  threadId: string;
  cacheBodies: boolean;
  autoLoadImages: boolean;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<MailMessage[] | undefined>();
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
  const web = mailWebUrl(account, threadId);
  return (
    <div className={styles.thread}>
      <div className={styles.row}>
        <Button onClick={onBack}>
          <Icon name="chevronLeft" /> {t.mail.view.back}
        </Button>
        {web && account.key !== DEMO_ACCOUNT ? (
          <Button onClick={() => void getPlatform().app.openUrl(web)}>
            {t.mail.view.openInGmail}
          </Button>
        ) : null}
      </div>
      {messages === undefined ? <Skeleton height="6rem" /> : <h2>{subject}</h2>}
      {error ? <MailError code={error} /> : null}
      {messages?.length === 0 && !error ? (
        <p className={styles.hint}>{t.mail.view.loadFailed}</p>
      ) : null}
      {messages?.map((m) => (
        <MessageCard
          key={m.id}
          account={account}
          message={m}
          open={openIds.includes(m.id) || messages.length === 1}
          autoLoadImages={autoLoadImages}
          onToggle={() =>
            setOpenIds((ids) =>
              ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id],
            )
          }
        />
      ))}
      <p className={styles.hint}>{t.mail.view.readOnly}</p>
    </div>
  );
}
