import { useEffect, useMemo, useState } from 'react';
import { getSettings } from '@/core/settings/settings';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Dialog } from '@/ui';
import { findOld, findReused } from '../audit';
import { findBreached } from '../breach';
import { defaultSettings, settingsSchema } from '../settings';
import { measureStrength, StrengthUnavailable } from '../strength';
import type { DecryptedEntry } from '../vault';

/** Entries checked for strength per run (zxcvbn is slow for very large vaults). */
const MAX_CHECKED = 400;

/**
 * "Passwörter prüfen": strength, reuse and age, computed here from the entries that are already open in memory.
 * Lists show entry titles only, never a password; the result is not stored and nothing is sent anywhere.
 */
export function AuditDialog({
  open,
  onClose,
  entries,
  onOpenEntry,
}: {
  open: boolean;
  onClose: () => void;
  entries: readonly DecryptedEntry[];
  onOpenEntry: (id: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.accounts.audit.title}>
      {open ? <Body entries={entries} onOpenEntry={(id) => (onClose(), onOpenEntry(id))} /> : null}
    </Dialog>
  );
}

function Body({
  entries,
  onOpenEntry,
}: {
  entries: readonly DecryptedEntry[];
  onOpenEntry: (id: string) => void;
}) {
  const a = t.accounts.audit;
  const [weak, setWeak] = useState<string[]>();
  const [progress, setProgress] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [breached, setBreached] = useState<string[]>();
  const [breachOn, setBreachOn] = useState(false);
  const [breachDone, setBreachDone] = useState(false);
  const [breachFailed, setBreachFailed] = useState(false);
  const reused = useMemo(() => findReused(entries), [entries]);
  const old = useMemo(() => findOld(entries, today()), [entries]);
  const title = (id: string) => entries.find((e) => e.id === id)?.data.title ?? '';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const withPassword = entries.filter((e) => e.data.password).slice(0, MAX_CHECKED);
      const found: string[] = [];
      try {
        for (const [i, e] of withPassword.entries()) {
          if (cancelled) return;
          const s = await measureStrength(e.data.password, [e.data.title, e.data.username]);
          if (s.score <= 1) found.push(e.id);
          if (i % 10 === 0) setProgress(i + 1);
        }
        if (!cancelled) setWeak(found);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof StrengthUnavailable) setUnavailable(true);
        setWeak(found);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  useEffect(() => {
    const ctl = new AbortController();
    void (async () => {
      // Off by default: with the switch off nothing below runs and no request is made.
      const prefs = await getSettings('module.accounts', settingsSchema, defaultSettings).catch(
        () => defaultSettings,
      );
      if (ctl.signal.aborted || !prefs.breachCheck) return;
      setBreachOn(true);
      try {
        const ids = await findBreached(entries.slice(0, MAX_CHECKED), { signal: ctl.signal });
        if (!ctl.signal.aborted) setBreached(ids);
      } catch {
        if (!ctl.signal.aborted) setBreachFailed(true);
      } finally {
        if (!ctl.signal.aborted) setBreachDone(true);
      }
    })();
    return () => ctl.abort();
  }, [entries]);

  const total = entries.filter((e) => e.data.password).length;
  const done = weak !== undefined;
  const breachSettled = !breachOn || breachDone;
  const none =
    done &&
    breachSettled &&
    !breachFailed &&
    weak.length === 0 &&
    reused.length === 0 &&
    old.length === 0 &&
    (breached?.length ?? 0) === 0;
  const group = (label: string, ids: string[]) =>
    ids.length === 0 ? null : (
      <section aria-label={label}>
        <h3>{label}</h3>
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <Button variant="ghost" onClick={() => onOpenEntry(id)}>
                {title(id)}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div data-testid="audit">
      <p>{a.intro}</p>
      {!done ? <p role="status">{a.running(Math.min(progress, total), total)}</p> : null}
      {breachOn ? <p>{a.breachNote}</p> : null}
      {breachOn && !breachDone ? <p role="status">{a.breachChecking}</p> : null}
      {breachFailed ? <p role="status">{a.breachUnavailable}</p> : null}
      {unavailable ? <p role="status">{a.unavailable}</p> : null}
      {none ? <p role="status">{a.nothing}</p> : null}
      {group(a.weak(weak?.length ?? 0), weak ?? [])}
      {group(a.reused(reused.flat().length), reused.flat())}
      {group(a.old(old.length), old)}
      {breached && breached.length > 0 ? <p>{a.breachHint}</p> : null}
      {group(a.breached(breached?.length ?? 0), breached ?? [])}
    </div>
  );
}
