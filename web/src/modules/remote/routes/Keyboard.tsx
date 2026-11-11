import { useEffect, useRef, useState } from 'react';
import type { RemotePcState, RemoteKeyAction } from '@/core/platform/types';
import type { RemoteView, TypeResult } from '@/core/remote/session';
import { t } from '@/strings';
import { Button, NoReadAid, TextField, useMediaQuery } from '@/ui';
import { remoteSession } from '../session';
import { describePad } from '../view';
import styles from '../remote.module.css';
import { LevelState, useMouseLevel } from './level';

/**
 * Tastatur: type, read, send. One field with the focus – the phone's own keyboard opens at once,
 * with its autocorrect and swipe typing. Its enter key sends the line and presses Enter at the
 * PC; "Senden" sends the line without Enter. While the field has the focus the page shows only
 * the field and its buttons; with it closed, the keys of the fixed list.
 *
 * The text is in the field until it is sent and nowhere else: no history, nothing stored, never
 * logged, not read by the reading aid. A text that did not go out stays in the field, and the
 * page says so.
 */
export function Keyboard({
  view,
  last,
  tick,
  onMedia,
}: {
  view: RemoteView;
  last: RemotePcState | undefined;
  /** The short tick of a key (the page knows whether it is switched on). */
  tick: () => void;
  onMedia: () => void;
}) {
  const k = t.remote.keys;
  const level = useMouseLevel(view);
  const line = describePad(view, level.pad, last);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState<string>();
  // a press that found the page not connected yet: it connects, and the page says so
  const [asked, setAsked] = useState(false);
  // sideways on a phone the open keyboard leaves a strip: the hint makes room for the field
  const low = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const field = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const usable = line.live || line.waiting;
  // The field takes the focus once, as soon as it can be typed in: the phone's keyboard opens by
  // itself. Later the person decides (after "Tasten zeigen" it stays closed) – and it never
  // takes the focus away from a key or a step of this view the person is on.
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (!usable || focusedOnce.current) return;
    focusedOnce.current = true;
    const on = document.activeElement;
    if (on && on !== field.current && root.current?.contains(on)) return;
    field.current?.focus();
  }, [usable]);
  // Android closes its keyboard (back gesture, its own hide key) without taking the focus off
  // the field. The screen growing back while the field has the focus is that: show the keys.
  useEffect(() => {
    const screen = window.visualViewport;
    if (!screen || !focused) return;
    let height = screen.height;
    const onResize = () => {
      if (screen.height > height + 100) {
        field.current?.blur();
        setFocused(false);
      }
      height = screen.height;
    };
    screen.addEventListener('resize', onResize);
    return () => screen.removeEventListener('resize', onResize);
  }, [focused]);
  // a field that was switched off (the PC got locked) may never say that it lost the focus:
  // the phone's keyboard counts as open only on a field that can be typed in
  const typing = focused && usable;

  const said = (result: TypeResult): string | undefined => {
    if (result === 'busy') return k.busy;
    if (result === 'failed') return k.failed;
    if (result === 'partial') return k.partial;
    // sent: nothing to say; locked: the state line says it
    return undefined;
  };
  const submit = async (enter: boolean) => {
    if (sending) return;
    if (!line.live) {
      // not ready yet: the press is the person's step that connects or asks for the level –
      // nothing is sent later by itself, so the page says to press again
      level.touched();
      setAsked(true);
      return;
    }
    setAsked(false);
    const value = text;
    if (!value && !enter) return;
    setNote(undefined);
    setSending(true);
    const result = await remoteSession.type(value, enter);
    setSending(false);
    // gone from the field only once it went out, and only if nothing was typed over it meanwhile
    if (result === 'sent') setText((now) => (now === value ? '' : now));
    setNote(said(result));
  };
  const press = (key: RemoteKeyAction) => {
    if (!line.live) {
      level.touched();
      setAsked(true);
      return;
    }
    setAsked(false);
    tick();
    // a key that finds the queue full is simply not pressed: nothing to report
    remoteSession.key(key);
  };
  const key = (action: RemoteKeyAction, label: string, face?: string) => (
    <button
      type="button"
      key={action}
      className={styles.padKey}
      disabled={!usable}
      aria-label={face ? label : undefined}
      onClick={() => press(action)}
      data-testid={`remote-${action}`}
    >
      {face ?? label}
    </button>
  );

  // a press that only connected: said until the page is connected (then the next press sends)
  const waitNote = asked && !line.live && usable ? k.connecting : note;

  return (
    <div className={styles.typeView} ref={root}>
      <LevelState line={line} level={level} onMedia={onMedia} />

      {/* what is typed here is nobody's to read along: no reading aid on it */}
      <NoReadAid>
        <form
          className={styles.typing}
          data-live={line.live}
          // the enter key of the phone's keyboard: the line, then Enter at the PC
          onSubmit={(e) => {
            e.preventDefault();
            void submit(true);
          }}
        >
          <TextField
            ref={field}
            label={k.field}
            hint={low && typing ? undefined : k.fieldHint}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={!usable}
            enterKeyHint="send"
            // no history of what was typed here; the phone's own word suggestions stay
            autoComplete="off"
            // (the mark of "this field wants the focus"; the effect above gives it)
            data-autofocus
            data-testid="remote-text"
          />
          <div className={styles.typeRow}>
            <Button
              variant="primary"
              disabled={!usable || sending}
              // sending keeps the phone's keyboard open: type, send, type on
              onPointerDown={(e) => {
                if (focused) e.preventDefault();
              }}
              onClick={() => void submit(false)}
              data-testid="remote-send"
            >
              {sending ? k.sending : k.send}
            </Button>
            {typing ? (
              // the phone's keyboard covers the keys: closing it brings them back
              <Button
                onClick={() => {
                  field.current?.blur();
                  setFocused(false);
                }}
                data-testid="remote-show-keys"
              >
                {k.showKeys}
              </Button>
            ) : null}
          </div>
          {waitNote ? (
            <p role="status" className={styles.note} data-testid="remote-type-note">
              {waitNote}
            </p>
          ) : null}
        </form>
      </NoReadAid>

      {typing ? null : (
        <div className={styles.keys} role="group" aria-label={k.group} data-testid="remote-keys">
          <div className={styles.keyRow}>
            {key('key-enter', k.enter)}
            {key('key-backspace', k.backspace)}
            {key('key-escape', k.escape)}
          </div>
          <div className={styles.keyRow}>
            {key('key-tab', k.tab)}
            {key('key-alt-tab', k.altTab)}
            {key('key-f11', k.f11)}
          </div>
          <div className={styles.arrows} role="group" aria-label={k.arrows}>
            <span />
            {key('key-up', k.up, '↑')}
            <span />
            {key('key-left', k.left, '←')}
            {key('key-down', k.down, '↓')}
            {key('key-right', k.right, '→')}
          </div>
          <div>
            <Button
              variant="ghost"
              aria-expanded={more}
              onClick={() => setMore((on) => !on)}
              data-testid="remote-more-keys"
            >
              {k.more}
            </Button>
          </div>
          {more ? (
            <>
              <div className={styles.keyRow}>
                {key('key-space', k.space)}
                {key('key-home', k.home)}
                {key('key-end', k.end)}
              </div>
              <div className={styles.keyRow}>
                {key('key-page-up', k.pageUp)}
                {key('key-page-down', k.pageDown)}
                {key('key-delete', k.delete)}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
