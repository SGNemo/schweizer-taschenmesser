/** Disposable-mail providers the tool can open in the browser. Only the link is used: nothing is fetched. */
export const MAIL_PROVIDERS = {
  guerrilla: 'https://www.guerrillamail.com/',
  tempmail: 'https://temp-mail.org/',
  tenminute: 'https://10minutemail.com/',
} as const;
export type MailProviderId = keyof typeof MAIL_PROVIDERS;
export const DEFAULT_MAIL_PROVIDER: MailProviderId = 'guerrilla';
