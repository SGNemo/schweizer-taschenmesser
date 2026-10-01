/**
 * Form detection (pure DOM reading, no side effects, nothing is sent anywhere). A form with a
 * password field is scored: sign-up signals add, login signals subtract. The limits are documented
 * in docs/security/VAULT-EXTENSION.md – e.g. multi-step flows where the e-mail and the password are
 * on different pages, or pages that render their fields inside a closed shadow root, are not seen.
 */

export type FormKind = 'signup' | 'login' | 'unknown';

export interface FormAnalysis {
  /** The `<form>`, or the smallest container that holds the password field(s). */
  root: Element;
  kind: FormKind;
  score: number;
  passwordFields: HTMLInputElement[];
  /** The field that carries the e-mail / user name (before the first password field). */
  usernameField: HTMLInputElement | undefined;
  /** The button that submits the form, if one is recognisable. */
  submitButton: HTMLElement | undefined;
}

/** Score at or above which a form counts as a registration form. */
export const SIGNUP_THRESHOLD = 5;

const SIGNUP_TEXT = new RegExp(
  [
    'registrier', // registrieren, registrierung
    'konto (erstellen|anlegen|eröffnen)',
    'account (erstellen|anlegen)',
    'neues konto',
    'kostenlos (registrieren|anmelden)',
    'sign ?up',
    'create (an? |your |new )?(free )?account',
    'register',
    'join (now|us|for free)',
    "s'inscrire",
    'inscription',
    'créer (un |votre )?compte',
    'registrarse',
    'crear (una |tu )?cuenta',
    'regístr',
    'registrati',
    'crea (un )?account',
    'registreren',
    'account aanmaken',
    'zarejestruj',
    'cadastr',
    'criar conta',
  ].join('|'),
  'i',
);

const LOGIN_TEXT = new RegExp(
  [
    'anmelden',
    'einloggen',
    'login',
    'log ?in',
    'sign ?in',
    'weiter zum passwort',
    'connexion',
    'se connecter',
    'iniciar sesi',
    'acceder',
    'accedi',
    'inloggen',
    'zaloguj',
    'entrar',
  ].join('|'),
  'i',
);

const PROVIDER_TEXT =
  /(with|mit|via|avec|con|con tu|using)\s+(google|apple|facebook|github|microsoft|twitter|x|sso)|\bsso\b/i;
const FORGOT_TEXT =
  /vergessen|forgot|reset (your )?password|mot de passe oubli|olvid|dimenticat|vergeten|zapomnia/i;
const CONFIRM_TEXT =
  /confirm|repeat|re-?type|again|wiederhol|bestätig|bestaetig|erneut|confirmer|répéter|repetir|confirma|ripeti|herhaal|powt/i;
const TERMS_TEXT =
  /terms|agb|nutzungsbedingungen|datenschutz|privacy|conditions|cgu|términos|condizioni|voorwaarden|regulamin/i;
const USER_HINT =
  /e-?mail|mail|user|login|benutzer|nutzer|konto|account|identifier|handle|nick|phone|mobile|telefon|utilisateur|usuario|utente|gebruiker/i;
const NOT_A_USERNAME =
  /first|last|sur|vor|nach|given|family|full ?name|company|firma|street|stra|city|stadt|zip|plz|postal|country|land|birth|geburt|search|such|coupon|promo|captcha|code/i;

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').trim();

export function isVisible(el: Element): boolean {
  const node = el as HTMLElement & { checkVisibility?: () => boolean };
  if (node.hidden || el.getAttribute('aria-hidden') === 'true') return false;
  if (el instanceof HTMLInputElement && (el.type === 'hidden' || el.disabled)) return false;
  if (typeof node.checkVisibility === 'function') return node.checkVisibility();
  // No layout engine (tests): look at inline styles up the tree.
  for (let n: Element | null = el; n; n = n.parentElement) {
    const style = (n as HTMLElement).style;
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
    if ((n as HTMLElement).hidden) return false;
  }
  return true;
}

/** Everything a human would read as the name of this field. */
export function fieldHint(input: HTMLInputElement): string {
  const doc = input.ownerDocument;
  const parts = [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    input.getAttribute('autocomplete') ?? '',
    input.title,
  ];
  if (input.id) {
    for (const label of doc.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`)) {
      parts.push(text(label));
    }
  }
  const wrapping = input.closest('label');
  if (wrapping) parts.push(text(wrapping));
  const by = input.getAttribute('aria-labelledby');
  if (by) for (const id of by.split(/\s+/)) parts.push(text(doc.getElementById(id)));
  return parts.join(' ');
}

const autocompleteOf = (input: HTMLInputElement): string =>
  (input.getAttribute('autocomplete') ?? '').toLowerCase();

/**
 * `data-nemo-ignore` on a field, a form or any ancestor opts out: the extension then neither
 * suggests, offers nor fills there (Nemo's own web app sets it on <body>, so the vault's master
 * password is never seen by the extension).
 */
export const IGNORE_ATTRIBUTE = 'data-nemo-ignore';
const ignored = (el: Element): boolean => el.closest(`[${IGNORE_ATTRIBUTE}]`) !== null;

export function visiblePasswordFields(root: ParentNode): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>('input[type="password" i]')].filter(
    (el) => isVisible(el) && !el.readOnly && !ignored(el),
  );
}

/** Text that says what the form is for: buttons, headings, legends and the document title. */
function purposeText(root: Element): string[] {
  const out: string[] = [];
  for (const el of root.querySelectorAll(
    'button, input[type="submit" i], input[type="button" i], [role="button"], h1, h2, h3, legend',
  )) {
    out.push(el instanceof HTMLInputElement ? el.value : text(el));
  }
  return out.filter(Boolean);
}

function findSubmit(root: Element): HTMLElement | undefined {
  const candidates = [
    ...root.querySelectorAll<HTMLElement>(
      'button[type="submit" i], input[type="submit" i], button:not([type]), [role="button"]',
    ),
  ].filter(isVisible);
  return candidates[0];
}

export function findUsernameField(
  root: ParentNode,
  passwordFields: HTMLInputElement[],
): HTMLInputElement | undefined {
  const first = passwordFields[0];
  const inputs = [
    ...root.querySelectorAll<HTMLInputElement>(
      'input:not([type]), input[type="text" i], input[type="email" i], input[type="tel" i]',
    ),
  ].filter(isVisible);
  let best: { el: HTMLInputElement; score: number } | undefined;
  for (const el of inputs) {
    // Only fields before the (first) password field can be the user name of that form.
    if (first && el.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_PRECEDING) continue;
    const ac = autocompleteOf(el);
    const hint = fieldHint(el);
    let score = 0;
    if (ac.includes('email')) score = 100;
    else if (ac.includes('username')) score = 95;
    else if (el.type === 'email') score = 90;
    else if (/e-?mail|mail/i.test(hint)) score = 70;
    else if (USER_HINT.test(hint)) score = 60;
    else if (!NOT_A_USERNAME.test(hint)) score = 20;
    if (score < 60 && NOT_A_USERNAME.test(hint) && !ac.includes('user')) continue;
    if (score >= 20 && (!best || score > best.score)) best = { el, score };
  }
  return best && best.score >= 30 ? best.el : undefined;
}

export function analyzeForm(root: Element, passwordFields?: HTMLInputElement[]): FormAnalysis {
  const passwords = passwordFields ?? visiblePasswordFields(root);
  let score = 0;

  const acs = passwords.map(autocompleteOf);
  const current = acs.some((a) => a.includes('current-password'));
  if (acs.some((a) => a.includes('new-password'))) score += 5;
  if (current) score -= 4;
  // Two password fields mean "choose and repeat" – unless one of them asks for the current one.
  if (passwords.length >= 2 && !current) score += 5;
  if (passwords.length >= 2 && passwords.slice(1).some((p) => CONFIRM_TEXT.test(fieldHint(p)))) {
    score += 2;
  }

  // "Sign in with Google" says nothing about this form's own purpose.
  const purposes = purposeText(root).filter((p) => !PROVIDER_TEXT.test(p));
  if (purposes.some((p) => SIGNUP_TEXT.test(p))) score += 5;
  if (purposes.some((p) => LOGIN_TEXT.test(p))) score -= 4;

  // "Forgot your password?" is a link on login forms, almost never on registration forms.
  if ([...root.querySelectorAll('a')].some((a) => FORGOT_TEXT.test(text(a)))) score -= 3;

  const terms = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox" i]')].some((c) =>
    TERMS_TEXT.test(fieldHint(c) + ' ' + text(c.closest('label') ?? c.parentElement)),
  );
  if (terms) score += 1;

  const usernameField = findUsernameField(root, passwords);
  const kind: FormKind =
    passwords.length === 0
      ? 'unknown'
      : score >= SIGNUP_THRESHOLD
        ? 'signup'
        : passwords.length === 1
          ? 'login'
          : 'unknown';
  return {
    root,
    kind,
    score,
    passwordFields: passwords,
    usernameField,
    submitButton: findSubmit(root),
  };
}

/**
 * Smallest ancestor that groups the password field with its sibling inputs when there is no
 * `<form>` (single-page apps). Stops at `body`.
 */
function containerOf(input: HTMLInputElement): Element {
  const form = input.closest('form');
  if (form) return form;
  let node: Element = input;
  for (let depth = 0; depth < 6 && node.parentElement; depth++) {
    node = node.parentElement;
    if (node === input.ownerDocument.body) break;
    if (
      node.querySelectorAll('input:not([type="hidden" i])').length >= 2 ||
      node.querySelector('button')
    ) {
      return node;
    }
  }
  return node;
}

/** Every form (or form-like container) that holds at least one visible password field. */
export function findForms(doc: Document): FormAnalysis[] {
  const groups = new Map<Element, HTMLInputElement[]>();
  for (const password of visiblePasswordFields(doc)) {
    const root = containerOf(password);
    groups.set(root, [...(groups.get(root) ?? []), password]);
  }
  return [...groups].map(([root, passwords]) => analyzeForm(root, passwords));
}

/** The analysis that owns `field`, or undefined when the field is not part of a password form. */
export function formOf(field: HTMLInputElement): FormAnalysis | undefined {
  return findForms(field.ownerDocument).find((f) => f.passwordFields.includes(field));
}

/** A one-time code field (`autocomplete="one-time-code"` or a clearly named short code input). */
export function findOtpField(doc: Document): HTMLInputElement | undefined {
  const inputs = [
    ...doc.querySelectorAll<HTMLInputElement>(
      'input:not([type="password" i]):not([type="hidden" i])',
    ),
  ].filter(isVisible);
  const byAutocomplete = inputs.find((i) => autocompleteOf(i).includes('one-time-code'));
  if (byAutocomplete) return byAutocomplete;
  return inputs.find((i) => {
    const hint = fieldHint(i);
    const short = (i.maxLength > 0 && i.maxLength <= 8) || i.inputMode === 'numeric';
    return (
      short &&
      /otp|one.?time|2fa|totp|authenticator|verification|bestätigungscode|sicherheitscode/i.test(
        hint,
      )
    );
  });
}
