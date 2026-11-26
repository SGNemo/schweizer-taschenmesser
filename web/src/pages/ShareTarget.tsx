import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { enableModule, useModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { ADDRESS_TOKENS, trimTrailing, webAddress } from '@/core/net/webAddress';
import { secondStage } from '@/quickCapture/targets';
import type { CaptureType } from '@/quickCapture/parser';
import type { SavedCapture } from '@/quickCapture/targets/types';
import { CaptureForm } from '@/quickCapture/ui/CaptureForm';
import { announceSaved } from '@/quickCapture/ui/announceSaved';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Card, Checkbox, EmptyState, Icon, patternStyles, type IconName } from '@/ui';
import styles from './Page.module.css';

/**
 * After „Speichern“ as `plan` (package 1, COPY S8 / S9 / S14): „Abgelegt.“ with „Ansehen“, „Rückgängig“ and „Fertig“.
 * The page follows the saved ToDo live: once it is gone – this „Rückgängig“ or the capture toast's – it says S14 and
 * offers only „Fertig“. Nothing closes by itself. Focus lands on „Fertig“; after this card's own „Rückgängig“ on the page
 * head. „Ansehen“ and „Fertig“ replace the share page in the history, so going back never offers the same share again.
 */
function SavedCard({
  saved,
  alive,
  onUndone,
}: {
  saved: SavedCapture;
  alive: boolean;
  onUndone: () => void;
}) {
  const navigate = useNavigate();
  const actions = useRef<HTMLDivElement>(null);
  const undoing = useRef(false);
  useEffect(() => {
    actions.current?.querySelector<HTMLButtonElement>('[data-share-done]')?.focus();
  }, []);
  useEffect(() => {
    if (!alive && undoing.current) {
      undoing.current = false;
      onUndone();
    }
  }, [alive, onUndone]);
  const s = t.planner.share;
  return (
    <Card>
      <p data-testid="share-saved">{alive ? s.saved : s.undone}</p>
      <div ref={actions} className={styles.savedActions}>
        {alive ? (
          <>
            <Link
              replace
              className={styles.viewLink}
              to={`/planner?item=${encodeURIComponent(`todos:${saved.id}`)}`}
            >
              {s.view}
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                undoing.current = true;
                void saved.undo().catch(() => {
                  undoing.current = false;
                  useUiStore.getState().toast(t.ui.undoFailed);
                });
              }}
            >
              {t.ui.undo}
            </Button>
          </>
        ) : null}
        <Button
          variant="primary"
          data-share-done
          onClick={() => void navigate('/planner', { replace: true })}
        >
          {s.done}
        </Button>
      </div>
    </Card>
  );
}

/** What Android's "Share" hands over: `title`, `text` and/or `url` (apps differ in what they fill). */
export function sharedContent(params: URLSearchParams): {
  title: string;
  text: string;
  url: string;
} {
  const text = params.get('text')?.trim() ?? '';
  // An address found in the text loses trailing punctuation („…/a.“, „…/a)“), as the parser reads it.
  const url =
    params.get('url')?.trim() ||
    (() => {
      const found = text.match(/https?:\/\/[^\s<>"']+/i)?.[0];
      return found ? trimTrailing(found) : '';
    })() ||
    '';
  return { title: params.get('title')?.trim() ?? '', text, url };
}

/**
 * Shared text as one entry (U17): the first non-empty line is the line the sheet reads, the rest is
 * offered as a note (behind a tick, off by default) and never split into entries. A shared link stays
 * on the line (unless it sits in a longer text), so a shared page still reads as a bookmark.
 */
export function sharedLine(c: ReturnType<typeof sharedContent>): { line: string; rest: string } {
  const title = c.title.trim();
  let text = c.text.trim();
  // Only a text that repeats the title on its first line loses that line; the rest stays as shared
  // (paragraph breaks included).
  const firstOf = (s: string) => s.split('\n', 1)[0]!.trim();
  const dropFirst = (s: string) => s.slice(s.indexOf('\n') + 1 || s.length).trim();
  if (title && firstOf(text) === title) text = dropFirst(text);
  let line = title || firstOf(text);
  const rest = title ? text : dropFirst(text);
  // The link stays on the line when it was shared beside the text or in a one-line text („Schau mal
  // https://…“); a long text (a mail body) keeps its links in the rest.
  const textLines = c.text.split('\n').filter((l) => l.trim()).length;
  if (c.url && !line.includes(c.url) && (!c.text.includes(c.url) || textLines <= 1)) {
    line = line ? `${line} ${c.url}` : c.url;
  }
  return { line, rest };
}

interface Target {
  module: string;
  label: string;
  icon: IconName;
  to: (c: ReturnType<typeof sharedContent>) => string;
  /** Offered only for this content (a feed needs a shared address). */
  when?: (c: ReturnType<typeof sharedContent>) => boolean;
  /** Shown only while the module is on (no extra "switch on" row for a module few people use). */
  onlyWhenOn?: boolean;
}

const q = (values: Record<string, string>): string =>
  new URLSearchParams(Object.entries(values).filter(([, v]) => v)).toString();

/** Which module the shared content is sent to; modules that are switched off can be switched on right here. */
const TARGETS: Target[] = [
  {
    module: 'bookmarks',
    get label() {
      return t.share.toBookmarks;
    },
    icon: 'bookmark',
    // `shared=1`: the bookmarks form offers to fetch the preview of a shared link.
    to: (c) => `/bookmarks?${q({ title: c.title, text: c.text, url: c.url, shared: '1' })}`,
  },
  {
    module: 'notes',
    get label() {
      return t.share.toNote;
    },
    icon: 'note',
    to: (c) => `/notes?${q({ new: '1', title: c.title, text: c.text || c.url })}`,
  },
  {
    module: 'todos',
    get label() {
      return t.share.toTodo;
    },
    icon: 'checklist',
    to: (c) => `/todos?${q({ new: '1', title: c.title || c.text || c.url })}`,
  },
  {
    module: 'lists',
    // The label lives in the lists block: each shared line becomes an entry of the list picked there.
    get label() {
      return t.lists.shareTo;
    },
    icon: 'cart',
    to: (c) => `/lists?${q({ share: c.text || c.title || c.url })}`,
  },
  {
    module: 'feeds',
    get label() {
      return t.share.toFeed;
    },
    icon: 'wifi',
    // The page's address goes into the add dialog of the feeds module.
    to: (c) => `/feeds?${q({ add: c.url })}`,
    when: (c) => c.url !== '',
    onlyWhenOn: true,
  },
];

/**
 * The line as the planner path may store it (package 1): every address-like token the gate rejects leaves it, with the
 * punctuation that ended its sentence („Schau: https://a@b/x.“ → „Schau:“). An address it keeps stays (the parser takes
 * it out of the title as built).
 */
export function screenLine(line: string): string {
  // Word by word (linear on any input): a word that is only punctuation left by a removed address goes too.
  return line
    .replace(ADDRESS_TOKENS, (token) => (webAddress(trimTrailing(token)) ? token : ' '))
    .split(/\s+/)
    .filter((word) => word && !/^[.,;:!?)]+$/.test(word))
    .join(' ');
}

/** The note of a thing shared into the planner may hold this much (the address line included). */
export const SHARE_NOTE_MAX = 4000;

/**
 * What „Speichern“ stores as the note (package 1, LAUNCH-REVIEW B9). Under the kind `plan` a storable address (http/https,
 * ≤ 2 048 characters) is its first line – also without the tick – and the ticked rest follows, cut so the whole stays at
 * `SHARE_NOTE_MAX`. Any other kind: exactly the ticked rest, as built.
 */
export function shareNote(
  kind: string | undefined,
  address: string | undefined,
  rest: string,
  asNote: boolean,
): { note?: string; cut: boolean } {
  const ticked = asNote && rest ? rest : '';
  if (kind !== 'plan') return ticked ? { note: ticked, cut: false } : { cut: false };
  // A rest that starts with the same address does not store it twice.
  const restLines = ticked.split('\n');
  // Compared as URL reads both (a bare origin gains its „/“, trailing punctuation goes).
  const first = webAddress(trimTrailing(restLines[0]?.trim() ?? ''))?.url;
  const own = address && first === address ? restLines.slice(1).join('\n').trim() : ticked;
  const room = SHARE_NOTE_MAX - (address ? address.length + 1 : 0);
  let kept = own.slice(0, Math.max(0, room));
  // Never half a character at the cut.
  if (kept.length < own.length && /[\ud800-\udbff]$/.test(kept)) kept = kept.slice(0, -1);
  const note = [address, kept].filter(Boolean).join('\n');
  return { ...(note ? { note } : {}), cut: kept.length < own.length };
}

/** `/share`: the neutral target of the PWA share sheet – you choose where the content goes. */
export function ShareTarget() {
  const [params] = useSearchParams();
  const states = useModuleStates();
  const navigate = useNavigate();
  const plannerOnNow = states?.planner === true;
  const query = params.toString();
  // Read once per shared content (not on every render: the form re-renders the page while it reads the line).
  const { content, parts, has, address, line, rest } = useMemo(() => {
    const content = sharedContent(new URLSearchParams(query));
    // The link is dropped when the text already contains it.
    const parts = [content.title, content.text, content.url].filter(
      (v, i, all) =>
        v &&
        all.indexOf(v) === i &&
        !all.some((o) => o && o !== v && o.includes(v) && v === content.url),
    );
    const has = content.title || content.text || content.url;
    // With the planner on, an address that will not be stored (not http/https, too long) never enters the line either:
    // the parser would keep it as the title. The „Geteilt“ card still shows it.
    const address = webAddress(content.url);
    const unsafe = plannerOnNow && !address && content.url !== '';
    const shared = sharedLine(unsafe ? { ...content, url: '' } : content);
    // Also when the address came inside the text (Android hands over title and text only), and every other
    // address-like token the gate rejects. A line that was only the address starts empty.
    const line = plannerOnNow
      ? screenLine(unsafe ? shared.line.split(content.url).join(' ') : shared.line)
      : shared.line;
    return { content, parts, has, address, line, rest: shared.rest };
  }, [query, plannerOnNow]);
  const [asNote, setAsNote] = useState(false);
  // Package 1: with the planner on, the form starts with the kind `plan`; what it reads now decides S2 / S16 / S19.
  const plannerOn = states?.planner === true;
  // What kind the form reads now; seeded with the kind it starts with, so the first frame already says S2.
  const [read, setRead] = useState<CaptureType | undefined>(() =>
    states?.planner === true ? 'plan' : undefined,
  );
  // Before the form has read anything, the kind it starts with counts (a cold open says S2 from its first frame too).
  const kind = read ?? (plannerOn ? 'plan' : undefined);
  const asPlan = kind === 'plan';
  const { note, cut } = shareNote(kind, address?.url, rest, asNote);
  // A ticked rest that starts with another address leads the note: the page names its host too (S16).
  const noteLead = !address && note ? webAddress(note.split('\n', 1)[0]) : undefined;
  // After „Speichern“ as `plan`: the page stays and follows the saved ToDo live (S8, then S14 once it is gone).
  const [saved, setSaved] = useState<SavedCapture>();
  const savedId = saved?.id;
  // The capture's own view of what it saved (its plan row, which every undo takes away with the ToDo).
  const savedType = saved?.type;
  const live = useLiveQuery(
    async () => (savedId && savedType ? await secondStage(savedType, savedId) : undefined),
    [savedId, savedType],
  );
  // Still loading counts as there (it was just written): the three actions stand from the first frame.
  // Only a deleted plan row is gone; unknown (loading, or the planner switched off meanwhile) is not „undone“.
  const alive = live !== 'deleted';
  const head = useRef<HTMLHeadingElement>(null);
  const toastId = useRef<number | undefined>(undefined);

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 ref={head} tabIndex={-1}>
            {t.share.title}
          </h1>
          <p className={styles.lead}>{t.share.intro}</p>
        </div>
      </div>
      {!has ? (
        <EmptyState title={t.share.nothing} />
      ) : (
        <>
          <Card title={t.share.content}>
            <p data-testid="shared-content" style={{ overflowWrap: 'anywhere' }}>
              {parts.join('\n')}
            </p>
          </Card>
          {/* One live region for the whole visit: empty until „Speichern“, so S8 and S14 are both announced. */}
          <p className="sr-only" role="status">
            {saved ? (alive ? t.planner.share.saved : t.planner.share.undone) : ''}
          </p>
          {saved ? (
            <SavedCard
              saved={saved}
              alive={alive}
              onUndone={() => {
                // The capture toast's „Rückgängig“ would undo nothing now: it goes with the page's undo.
                if (toastId.current !== undefined)
                  useUiStore.getState().dismissToast(toastId.current);
                head.current?.focus();
              }}
            />
          ) : (
            <Card title={t.quickCapture.share.suggestion}>
              {rest ? (
                <Checkbox
                  label={t.quickCapture.share.asNote}
                  checked={asNote}
                  onChange={(e) => setAsNote(e.target.checked)}
                />
              ) : null}
              {/* The form waits for the module states: it starts with the kind `plan` only while the planner is on. */}
              {states ? (
                <CaptureForm
                  oneEntry
                  initialText={line}
                  {...(plannerOn ? { initialType: 'plan' as const } : {})}
                  extra={note ? { note } : undefined}
                  onRead={setRead}
                  onSaved={(s) => {
                    if (s.type !== 'plan') {
                      void announceSaved(s);
                      void navigate('/');
                      return;
                    }
                    setSaved(s);
                    // The capture toast as built; the page remembers it, so its own „Rückgängig“ can close it.
                    void announceSaved(s).then(async (id) => {
                      // Undone on the page before the toast came: it goes at once (its undo would do nothing).
                      if (id !== undefined && (await secondStage(s.type, s.id)) === 'deleted')
                        useUiStore.getState().dismissToast(id);
                      else toastId.current = id;
                    });
                  }}
                />
              ) : null}
              {asPlan ? (
                <div className={styles.lead} data-testid="share-plan-lines">
                  <p>{t.planner.share.lands}</p>
                  {address ? (
                    <p>{t.planner.share.linkSaved(address.host)}</p>
                  ) : content.url ? (
                    <p>{t.planner.share.linkNotSaved}</p>
                  ) : null}
                  {noteLead ? <p>{t.planner.share.linkSaved(noteLead.host)}</p> : null}
                  {cut ? <p>{t.planner.share.cut}</p> : null}
                </div>
              ) : null}
            </Card>
          )}
          {/* Once saved, the other ways go: one share, one thing (a second tap would store a copy). */}
          {saved ? null : (
            <>
              <h2>{t.quickCapture.share.or}</h2>
              <ul className={styles.list} aria-label={t.share.where}>
                {states
                  ? TARGETS.filter(
                      (x) => (x.when?.(content) ?? true) && (!x.onlyWhenOn || states[x.module]),
                    ).map((x) => (
                      <Card as="li" key={x.module}>
                        {states[x.module] ? (
                          <Link to={x.to(content)} data-testid={`share-${x.module}`}>
                            <Icon name={x.icon} size={18} /> {x.label}
                          </Link>
                        ) : (
                          <span className={patternStyles.hstack}>
                            <span data-testid={`share-${x.module}-off`}>
                              <Icon name={x.icon} size={18} /> {x.label}
                            </span>
                            <Button
                              aria-label={`${t.actions.enable}: ${x.label}`}
                              onClick={() => {
                                const m = getManifest(x.module);
                                if (m) void enableModule(m);
                              }}
                            >
                              {t.actions.enable}
                            </Button>
                          </span>
                        )}
                      </Card>
                    ))
                  : null}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
