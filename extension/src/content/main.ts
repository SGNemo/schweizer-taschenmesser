/**
 * Content script. It reads form fields, shows the overlay, and fills fields – only after the user
 * clicked in the overlay (or in the popup). It never fills on page load, never puts a password into
 * a field other than the detected password fields of the form, and sends nothing but: the generator
 * request, the user name / password / title the user confirmed, and a request for entries (the
 * service worker takes the origin from the browser, not from here).
 */
import { findForms, findOtpField, formOf, type FormAnalysis } from '../lib/forms';
import type { GenSettings, Generated } from '../lib/generate';
import type { ContentCommand, Reply, Request } from '../lib/messages';
import { t } from '../strings';
import { setFieldValue } from './dom';
import {
  closeAll,
  closePanel,
  hideKey,
  showKey,
  showMenu,
  showNotice,
  showSave,
  showSuggest,
} from './ui';

const SUGGEST_DELAY_MS = 0;

async function send<T = unknown>(request: Request): Promise<Reply<T>> {
  try {
    return (await chrome.runtime.sendMessage(request)) as Reply<T>;
  } catch {
    // The extension was reloaded or the worker is gone: behave like "app not found".
    return { ok: false, error: 'app-missing' };
  }
}

const failureText = (error: string): string =>
  error === 'locked'
    ? t.status.locked
    : error === 'app-missing'
      ? t.status.appMissing
      : error === 'not-paired'
        ? t.status.rejected
        : error === 'origin-mismatch'
          ? t.errors.mismatch
          : t.errors.generic;

const dismissed = new WeakSet<Element>();
let lastGen: GenSettings | undefined;

const siteLabel = (): string => (location.origin === 'null' ? location.hostname : location.origin);
const pageTitle = (): string => (document.title.trim() || location.hostname).slice(0, 200);

async function generate(
  settings?: GenSettings,
): Promise<(Generated & { settings: GenSettings }) | null> {
  const r = await send<Generated & { settings: GenSettings }>({
    type: 'generate',
    ...(settings ? { settings } : lastGen ? { settings: lastGen } : {}),
  });
  if (!r.ok) return null;
  lastGen = r.data.settings;
  return r.data;
}

// ---- registration: suggestion → use → save card -----------------------------------------------

async function openSuggest(form: FormAnalysis, field: HTMLInputElement): Promise<void> {
  const first = await generate();
  if (!first) return;
  showSuggest({
    anchor: field,
    initial: first,
    regenerate: async (settings) => (await generate(settings)) ?? first,
    onClose: () => dismissed.add(form.root),
    onUse(value) {
      // Only the form's own password fields get the value (also the confirmation field).
      for (const pw of form.passwordFields) setFieldValue(pw, value);
      const username = form.usernameField?.value ?? '';
      void send({ type: 'pending-set', title: pageTitle(), username, password: value }).then(() =>
        openSaveCard({
          kind: 'save',
          origin: 'suggestion',
          title: pageTitle(),
          username,
          anchor: field,
        }),
      );
    },
  });
}

function openSaveCard(opts: {
  kind: 'save' | 'update';
  origin: 'suggestion' | 'offer';
  title: string;
  username: string;
  anchor: Element | null;
}): void {
  showSave({
    ...opts,
    site: siteLabel(),
    async onSave(title, username) {
      const r = await send({ type: 'pending-save', title, username });
      if (r.ok) return { ok: true, text: opts.kind === 'update' ? t.save.updated : t.save.saved };
      return { ok: false, text: failureText(r.error) };
    },
    onLater: () => showNotice(t.save.laterHint, 'info'),
    onDiscard: () => void send({ type: 'pending-clear' }),
  });
}

async function showPending(): Promise<void> {
  const r = await send<{
    kind: 'save' | 'update';
    title: string;
    username: string;
    origin: string;
  } | null>({
    type: 'pending-get',
  });
  if (!r.ok || !r.data) return;
  const p = r.data;
  // The service worker only hands this out for the same site (registrable domain) as the tab.
  openSaveCard({
    kind: p.kind,
    origin: 'offer',
    title: p.title,
    username: p.username,
    anchor: null,
  });
}

// ---- login: key button → entry menu → fill ------------------------------------------------------

function fillLogin(form: FormAnalysis | undefined, username: string, password: string): boolean {
  if (!form) return false;
  const pw = form.passwordFields[0];
  if (!pw) return false;
  if (form.usernameField && username) setFieldValue(form.usernameField, username);
  setFieldValue(pw, password);
  return true;
}

async function openEntryMenu(field: HTMLInputElement, mode: 'login' | 'totp'): Promise<void> {
  const found = await send<{ id: string; title: string; username: string; hasTotp: boolean }[]>({
    type: 'match',
  });
  if (!found.ok) return showNotice(failureText(found.error), 'err', field);
  const entries = mode === 'totp' ? found.data.filter((e) => e.hasTotp) : found.data;
  showMenu({
    anchor: field,
    title: mode === 'totp' ? t.fill.totp : t.fill.title,
    entries,
    async onPick(entry) {
      const secret = await send<string>({
        type: 'secret',
        entryId: entry.id,
        field: mode === 'totp' ? 'totp' : 'password',
      });
      if (!secret.ok) return showNotice(failureText(secret.error), 'err', field);
      if (mode === 'totp') setFieldValue(field, secret.data);
      else if (!fillLogin(formOf(field), entry.username, secret.data)) return;
      hideKey();
      showNotice(t.fill.filled, 'ok', field);
    },
  });
}

// ---- events ------------------------------------------------------------------------------------

function onFocusIn(event: FocusEvent): void {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) return;

  if (el.type === 'password') {
    const form = formOf(el);
    if (!form) return;
    if (form.kind === 'signup') {
      hideKey();
      if (!dismissed.has(form.root)) setTimeout(() => void openSuggest(form, el), SUGGEST_DELAY_MS);
      return;
    }
    showKey(el, t.fill.button, () => void openEntryMenu(el, 'login'));
    return;
  }

  const form = findForms(document).find((f) => f.usernameField === el);
  if (form && form.kind !== 'signup') {
    showKey(el, t.fill.button, () => void openEntryMenu(el, 'login'));
    return;
  }
  if (findOtpField(document) === el) {
    showKey(el, t.fill.totp, () => void openEntryMenu(el, 'totp'));
    return;
  }
  hideKey();
}

function onSubmit(event: Event): void {
  // Only a submit the user caused: a page script can dispatch `submit` or call `requestSubmit()`
  // with values of its choosing and would otherwise learn through the save card whether they
  // match a stored entry.
  if (!event.isTrusted) return;
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;
  const analysis = findForms(document).find((f) => f.root === form || form.contains(f.root));
  const password = analysis?.passwordFields.find((p) => p.value !== '')?.value;
  if (!analysis || !password) return;
  const username = analysis.usernameField?.value ?? '';
  void send<{ kind: 'save' | 'update'; title: string; username: string } | null>({
    type: 'submitted',
    username,
    password,
  }).then((r) => {
    if (!r.ok || !r.data) return;
    openSaveCard({
      kind: r.data.kind,
      origin: 'offer',
      title: r.data.title,
      username: r.data.username,
      anchor: null,
    });
  });
}

/** Tiny strict check (the content script stays free of schema libraries to load fast on every page). */
function asCommand(message: unknown): ContentCommand | undefined {
  if (typeof message !== 'object' || message === null) return undefined;
  const m = message as Record<string, unknown>;
  const keys = Object.keys(m).sort().join(',');
  if (
    m.type === 'do-fill' &&
    keys === 'password,type,username' &&
    typeof m.username === 'string' &&
    typeof m.password === 'string'
  ) {
    return {
      type: 'do-fill',
      username: m.username.slice(0, 500),
      password: m.password.slice(0, 1024),
    };
  }
  return undefined;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  const command = asCommand(message);
  if (!command) return;
  if (window !== window.top) return; // popup fills only the top frame
  if (command.type === 'do-fill') {
    const forms = findForms(document);
    const form = forms.find((f) => f.kind === 'login') ?? forms[0];
    if (fillLogin(form, command.username, command.password)) showNotice(t.fill.filled, 'ok');
    else showNotice(t.errors.generic, 'err');
  }
});

document.addEventListener('focusin', onFocusIn, true);
document.addEventListener('submit', onSubmit, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAll();
});
window.addEventListener('pagehide', closePanel);

// A pending save is shown once per page, in the top frame only.
if (window === window.top) {
  if (document.readyState === 'complete') void showPending();
  else window.addEventListener('load', () => void showPending(), { once: true });
}
