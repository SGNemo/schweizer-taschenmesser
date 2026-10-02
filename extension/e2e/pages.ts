/** Invented test sites served through `context.route` (no real network). */
export const SHOP = 'https://shop.example.test';
export const PHISH = 'https://shop-example.test';
export const OTHER = 'https://other.example.test';

const wrap = (title: string, body: string) =>
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;

export const signupPage = wrap(
  'Beispiel-Shop – Konto erstellen',
  `<h1>Konto erstellen</h1>
   <form id="signup" action="/welcome" method="post">
     <label>E-Mail <input id="email" name="email" type="email" autocomplete="email"></label>
     <label>Passwort <input id="pw" name="password" type="password" autocomplete="new-password"></label>
     <label>Passwort wiederholen <input id="pw2" name="password2" type="password" autocomplete="new-password"></label>
     <input id="other" name="note" type="text" placeholder="Anmerkung">
     <button type="submit">Registrieren</button>
   </form>`,
);

export const loginPage = wrap(
  'Beispiel-Shop – Anmelden',
  `<h1>Anmelden</h1>
   <form id="login" action="/home" method="post">
     <label>E-Mail <input id="user" name="user" type="email" autocomplete="username"></label>
     <label>Passwort <input id="pw" name="password" type="password" autocomplete="current-password"></label>
     <input id="otp" name="otp" type="text" autocomplete="one-time-code" maxlength="6">
     <button type="submit">Anmelden</button>
     <a href="/forgot">Passwort vergessen?</a>
   </form>`,
);

export const welcomePage = wrap('Willkommen', '<h1>Willkommen</h1><p>Konto erstellt.</p>');
