// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SIGNUP_THRESHOLD,
  analyzeForm,
  findForms,
  findOtpField,
  findUsernameField,
  formOf,
} from '../src/lib/forms';

const page = (html: string) => {
  document.body.innerHTML = html;
};
const only = () => {
  const forms = findForms(document);
  expect(forms).toHaveLength(1);
  return forms[0]!;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('registration forms', () => {
  const signups: Record<string, string> = {
    'new-password autocomplete': `<form><input type="email" name="email"><input type="password" autocomplete="new-password"><button>Weiter</button></form>`,
    'two password fields': `<form><input name="user"><input type="password" name="p1"><input type="password" name="p2"><button>Absenden</button></form>`,
    'english sign up button': `<form><input type="email"><input type="password"><button type="submit">Sign up</button></form>`,
    'create account heading': `<form><h2>Create your account</h2><input type="email"><input type="password"><button>Continue</button></form>`,
    'german konto erstellen': `<form><input type="email"><input type="password"><button>Konto erstellen</button></form>`,
    'german registrieren with confirm label': `<form><input type="email"><input type="password"><input type="password" placeholder="Passwort wiederholen"><button>Jetzt registrieren</button></form>`,
    french: `<form><input type="email"><input type="password"><button>Créer un compte</button></form>`,
    'french inscription': `<form><input type="email"><input type="password" autocomplete="new-password"><input type="submit" value="S'inscrire"></form>`,
    spanish: `<form><input type="email"><input type="password"><input type="password" aria-label="Repetir contraseña"><button>Registrarse</button></form>`,
    italian: `<form><input type="email"><input type="password"><input type="password"><button>Registrati</button></form>`,
    'terms checkbox adds weight': `<form><input type="email"><input type="password"><label><input type="checkbox"> Ich akzeptiere die AGB</label><button>Registrieren</button></form>`,
    'login-ish link text on a signup form is ignored': `<form><h1>Sign up</h1><input type="email"><input type="password" autocomplete="new-password"><button>Create account</button><a href="/login">Already have an account? Log in</a></form>`,
  };
  it.each(Object.entries(signups))('detects %s', (_name, html) => {
    page(html);
    const form = only();
    expect(form.kind).toBe('signup');
    expect(form.score).toBeGreaterThanOrEqual(SIGNUP_THRESHOLD);
  });
});

describe('login forms are not registration forms', () => {
  const logins: Record<string, string> = {
    'plain english': `<form><input type="email"><input type="password"><button>Log in</button></form>`,
    'sign in with current-password': `<form><input name="user"><input type="password" autocomplete="current-password"><button>Sign in</button></form>`,
    german: `<form><input name="benutzer"><input type="password"><button>Anmelden</button><a href="/reset">Passwort vergessen?</a></form>`,
    'forgot password link only': `<form><input type="email"><input type="password"><button>Weiter</button><a href="/x">Forgot your password?</a></form>`,
    french: `<form><input type="email"><input type="password"><button>Se connecter</button></form>`,
    spanish: `<form><input type="email"><input type="password"><button>Iniciar sesión</button></form>`,
    'single bare password field': `<form><input type="password"><button>Los</button></form>`,
  };
  it.each(Object.entries(logins))('treats %s as login', (_name, html) => {
    page(html);
    const form = only();
    expect(form.kind).toBe('login');
    expect(form.score).toBeLessThan(SIGNUP_THRESHOLD);
  });

  it('a password change form (current + new) is not a signup', () => {
    page(
      `<form><input type="password" autocomplete="current-password"><input type="password" autocomplete="new-password"><button>Speichern</button></form>`,
    );
    expect(only().kind).not.toBe('signup');
  });
});

describe('what is not a form with a password', () => {
  it('ignores newsletter and search forms', () => {
    page(
      `<form><input type="email"><button>Subscribe</button></form><form role="search"><input type="search"></form>`,
    );
    expect(findForms(document)).toEqual([]);
  });
  it('ignores hidden, disabled and read-only password fields', () => {
    page(
      `<form><input type="password" style="display:none"><input type="password" disabled><input type="password" readonly><input type="password" hidden></form>`,
    );
    expect(findForms(document)).toEqual([]);
  });
  it('keeps two forms on one page apart', () => {
    page(
      `<form id="a"><input type="email"><input type="password"><button>Log in</button></form>
       <form id="b"><input type="email"><input type="password"><input type="password"><button>Sign up</button></form>`,
    );
    const kinds = findForms(document).map((f) => f.kind);
    expect(kinds).toEqual(['login', 'signup']);
  });
  it('finds fields that are not inside a <form> (single-page apps)', () => {
    page(
      `<div id="app"><div class="card"><input type="email" name="email"><input type="password" autocomplete="new-password"><button>Sign up</button></div></div>`,
    );
    const form = only();
    expect(form.kind).toBe('signup');
    expect(form.usernameField?.name).toBe('email');
  });
  it('formOf returns the analysis of the form that owns a field', () => {
    page(`<form><input type="email"><input id="pw" type="password"><button>Log in</button></form>`);
    const field = document.getElementById('pw') as HTMLInputElement;
    expect(formOf(field)?.kind).toBe('login');
    expect(formOf(document.createElement('input'))).toBeUndefined();
  });
});

describe('e-mail / user name detection', () => {
  const username = (html: string) => {
    page(html);
    const form = document.querySelector('form')!;
    return analyzeForm(form).usernameField;
  };

  it('prefers autocomplete, then type=email, then name and label', () => {
    expect(
      username(
        `<form><input name="x" autocomplete="email"><input name="u" autocomplete="username"><input type="password"></form>`,
      )?.name,
    ).toBe('x');
    expect(
      username(`<form><input name="u" autocomplete="username"><input type="password"></form>`)
        ?.name,
    ).toBe('u');
    expect(
      username(`<form><input name="a"><input type="email" name="b"><input type="password"></form>`)
        ?.name,
    ).toBe('b');
    expect(username(`<form><input name="login_name"><input type="password"></form>`)?.name).toBe(
      'login_name',
    );
    expect(
      username(
        `<form><label for="q">E-Mail-Adresse</label><input id="q" name="q"><input type="password"></form>`,
      )?.name,
    ).toBe('q');
    expect(
      username(`<form><label>Benutzername <input name="z"></label><input type="password"></form>`)
        ?.name,
    ).toBe('z');
  });
  it('skips name, address and search style fields', () => {
    expect(
      username(
        `<form><input name="vorname"><input name="nachname"><input type="email" name="mail"><input type="password"></form>`,
      )?.name,
    ).toBe('mail');
    expect(
      username(`<form><input name="firstname"><input type="password"></form>`),
    ).toBeUndefined();
  });
  it('only looks at fields before the password field', () => {
    expect(
      username(`<form><input type="password"><input type="email" name="after"></form>`),
    ).toBeUndefined();
  });
  it('ignores hidden and non-text inputs', () => {
    expect(
      username(
        `<form><input type="hidden" name="email" value="x"><input type="checkbox" name="user"><input type="password"></form>`,
      ),
    ).toBeUndefined();
  });
  it('findUsernameField works on any parent node', () => {
    page(`<div><input type="email" name="m"><input type="password" id="p"></div>`);
    const pw = document.getElementById('p') as HTMLInputElement;
    expect(findUsernameField(document.body, [pw])?.name).toBe('m');
  });
});

describe('submit button and one-time code', () => {
  it('recognises the submit button', () => {
    page(
      `<form><input type="email"><input type="password"><button type="button">Abbrechen</button><button type="submit" id="go">Los</button></form>`,
    );
    expect(only().submitButton).toBeDefined();
  });
  it('finds a one-time code field by autocomplete and by name', () => {
    page(`<input name="a"><input name="code" autocomplete="one-time-code">`);
    expect(findOtpField(document)?.name).toBe('code');
    page(`<input name="search"><input name="otp" maxlength="6">`);
    expect(findOtpField(document)?.name).toBe('otp');
    page(`<input name="otp_label_but_long" maxlength="200">`);
    expect(findOtpField(document)).toBeUndefined();
  });
  it('skips one-time code fields marked data-nemo-ignore (field, form or page)', () => {
    page(`<input name="code" autocomplete="one-time-code" data-nemo-ignore>`);
    expect(findOtpField(document)).toBeUndefined();
    page(`<form data-nemo-ignore><input name="otp" maxlength="6"></form>`);
    expect(findOtpField(document)).toBeUndefined();
    document.body.setAttribute('data-nemo-ignore', '');
    page(`<input name="code" autocomplete="one-time-code">`);
    expect(findOtpField(document)).toBeUndefined();
    document.body.removeAttribute('data-nemo-ignore');
    expect(findOtpField(document)?.name).toBe('code');
  });
});

describe('opt-out', () => {
  it('ignores fields, forms and pages marked data-nemo-ignore', () => {
    page(`<form><input type="email"><input type="password" data-nemo-ignore></form>`);
    expect(findForms(document)).toEqual([]);
    page(`<form data-nemo-ignore><input type="email"><input type="password"></form>`);
    expect(findForms(document)).toEqual([]);
    document.body.setAttribute('data-nemo-ignore', '');
    page(`<form><input type="email"><input type="password"></form>`);
    expect(findForms(document)).toEqual([]);
    document.body.removeAttribute('data-nemo-ignore');
  });
});

describe('provider buttons and login pages with a sign-up link', () => {
  it('"Sign in with Google" does not turn a registration form into a login', () => {
    page(
      `<form><input type="email"><input type="password" autocomplete="new-password"><button>Create account</button><button type="button">Sign in with Google</button></form>`,
    );
    expect(only().kind).toBe('signup');
  });
  it('a login form with a "Sign up" link stays a login', () => {
    page(
      `<form><input type="email"><input type="password"><button>Log in</button><a href="/signup">Sign up</a></form>`,
    );
    expect(only().kind).toBe('login');
  });
});
