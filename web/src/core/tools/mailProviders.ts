/**
 * Disposable-mail providers the anonymous persona tool can open in the browser. Only the link is used: nothing
 * is fetched from the provider. Lives in `core` because the tool and the settings page both read the choice
 * (synced settings scope `tools.persona`, key `mailProvider`).
 */
export const MAIL_PROVIDERS = {
  guerrilla: 'https://www.guerrillamail.com/',
  tempmail: 'https://temp-mail.org/',
  tenminute: 'https://10minutemail.com/',
} as const;
export type MailProviderId = keyof typeof MAIL_PROVIDERS;
export const MAIL_PROVIDER_IDS = Object.keys(MAIL_PROVIDERS) as MailProviderId[];
export const DEFAULT_MAIL_PROVIDER: MailProviderId = 'guerrilla';
export const PERSONA_SCOPE = 'tools.persona';
