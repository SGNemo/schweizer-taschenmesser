import { useMemo, useState } from 'react';
import { z } from 'zod';
import { getLang } from '@/core/i18n/lang';
import { dateTimeFormat } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Button, Checkbox, Icon, IconButton, SelectField } from '@/ui';
import { copyWithToast, useSaveAsNote, useSaveInVault } from '../shared';
import styles from '../tools.module.css';
import { COUNTRIES } from './data';
import {
  AGE_BANDS,
  countryForLang,
  DEFAULT_OPTIONS,
  FIELDS,
  generatePersona,
  rerollField,
  type AgeBandId,
  type Field,
  type GenderChoice,
  type Persona,
  type PersonaOptions,
} from './logic';
import { PERSONA_SCOPE } from '@/core/tools/mailProviders';
import {
  DEFAULT_MAIL_PROVIDER,
  MAIL_PROVIDERS,
  MAIL_PROVIDER_IDS,
  type MailProviderId,
} from './mail';

const s = t.tools.persona;

/** Choices that stay between visits (per user, synced like other settings). Nothing generated is stored. */
const schema = z.object({
  country: z.enum(COUNTRIES).optional().catch(undefined),
  age: z.enum(Object.keys(AGE_BANDS) as [AgeBandId, ...AgeBandId[]]).catch('a26'),
  gender: z.enum(['none', 'any', 'f', 'm']).catch('none'),
  bio: z.boolean().catch(false),
  passwordSymbols: z.boolean().catch(true),
  mailProvider: z.enum(['guerrilla', 'tempmail', 'tenminute']).catch(DEFAULT_MAIL_PROVIDER),
  noticeSeen: z.boolean().catch(false),
});

const birthFormat = () => dateTimeFormat({ day: '2-digit', month: '2-digit', year: 'numeric' });
/** "1990-03-15" → "15.03.1990" in the format locale (a plain local date, no time zone shifts). */
const showBirth = (iso: string): string => birthFormat().format(new Date(`${iso}T12:00:00`));

/** What a field shows and copies. */
function valueOf(p: Persona, f: Field): string | undefined {
  switch (f) {
    case 'birth':
      return showBirth(p.birth);
    case 'gender':
      return p.gender ? s.genderValues[p.gender] : undefined;
    default:
      return p[f];
  }
}

export default function PersonaTool() {
  const [stored, patch] = useSettings(PERSONA_SCOPE, schema, {
    age: 'a26',
    gender: 'none',
    bio: false,
    passwordSymbols: true,
    mailProvider: DEFAULT_MAIL_PROVIDER,
    noticeSeen: false,
  });
  if (!stored) return null;
  const options: PersonaOptions = {
    ...DEFAULT_OPTIONS,
    country: stored.country ?? countryForLang(getLang()),
    age: stored.age,
    gender: stored.gender as GenderChoice,
    bio: stored.bio,
    passwordSymbols: stored.passwordSymbols,
  };
  return (
    <Generator
      options={options}
      mailProvider={stored.mailProvider as MailProviderId}
      noticeSeen={stored.noticeSeen}
      patch={(p) => void patch(p)}
    />
  );
}

function Generator({
  options: initial,
  mailProvider,
  noticeSeen,
  patch,
}: {
  options: PersonaOptions;
  mailProvider: MailProviderId;
  noticeSeen: boolean;
  patch: (p: Partial<z.input<typeof schema>>) => void;
}) {
  const saveAsNote = useSaveAsNote();
  const saveInVault = useSaveInVault();
  // The choices are kept here so a control shows its new value at once; they are stored in the settings next to it.
  const [options, setOptions] = useState<PersonaOptions>(initial);
  const [persona, setPersona] = useState<Persona>(() => generatePersona(initial));
  const rows = useMemo(
    () =>
      FIELDS.flatMap((f) => {
        const value = valueOf(persona, f);
        return value === undefined ? [] : [{ field: f, label: s.fields[f], value }];
      }),
    [persona],
  );
  // Vault: name, user name and password in their own fields, everything else as the (encrypted) note.
  const vaultEntry = {
    title: `${s.noteTitle}: ${persona.firstName} ${persona.lastName}`,
    username: persona.username,
    password: persona.password,
    notes: rows
      .filter((r) => r.field !== 'username' && r.field !== 'password')
      .map((r) => `${r.label}: ${r.value}`)
      .join('\n'),
  };
  const allText = rows.map((r) => `${r.label}: ${r.value}`).join('\n');
  const reroll = (f: Field) => setPersona((p) => rerollField(p, f, options));
  // A changed country, age, gender, bio or password setting is stored and makes a fresh persona right away.
  // The panel stays mounted, so focus stays on the control that was changed.
  const change = (stored: Partial<z.input<typeof schema>>, now: Partial<PersonaOptions>) => {
    patch(stored);
    const next = { ...options, ...now };
    setOptions(next);
    setPersona(generatePersona(next));
  };

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{s.intro}</p>
      {noticeSeen ? null : (
        <div className={styles.stack} role="note">
          <p>{s.notice}</p>
          <div className={styles.row}>
            <Button onClick={() => patch({ noticeSeen: true })}>{s.noticeOk}</Button>
          </div>
        </div>
      )}
      <div className={styles.row}>
        <div className={styles.grow}>
          <SelectField
            label={s.country}
            value={options.country}
            onChange={(e) => {
              const country = e.target.value as (typeof COUNTRIES)[number];
              change({ country }, { country });
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {s.countries[c]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className={styles.grow}>
          <SelectField
            label={s.age}
            value={options.age}
            onChange={(e) => {
              const age = e.target.value as AgeBandId;
              change({ age }, { age });
            }}
          >
            {(Object.keys(AGE_BANDS) as AgeBandId[]).map((a) => (
              <option key={a} value={a}>
                {s.ages[a]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className={styles.grow}>
          <SelectField
            label={s.gender}
            value={options.gender}
            onChange={(e) => {
              const gender = e.target.value as GenderChoice;
              change({ gender }, { gender });
            }}
          >
            {(['none', 'any', 'f', 'm'] as const).map((g) => (
              <option key={g} value={g}>
                {s.genders[g]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <div className={styles.row}>
        <Checkbox
          label={s.bio}
          checked={options.bio}
          onChange={(e) => change({ bio: e.target.checked }, { bio: e.target.checked })}
        />
        <Checkbox
          label={s.symbols}
          checked={options.passwordSymbols}
          onChange={(e) =>
            change({ passwordSymbols: e.target.checked }, { passwordSymbols: e.target.checked })
          }
        />
      </div>

      <div className={styles.table} data-testid="persona-fields">
        {rows.map((r) => (
          <PersonaRow
            key={r.field}
            label={r.label}
            value={r.value}
            mono={r.field === 'password' || r.field === 'username'}
            onCopy={() => void copyWithToast(r.value)}
            onReroll={() => reroll(r.field)}
          />
        ))}
      </div>
      <p className={styles.muted}>{s.phoneNote}</p>

      <div className={styles.row}>
        <Button variant="primary" onClick={() => setPersona(generatePersona(options))}>
          <Icon name="shuffle" size={18} />
          {s.rerollAll}
        </Button>
        <Button onClick={() => void copyWithToast(allText)}>{s.copyAll}</Button>
        {saveAsNote ? (
          <Button onClick={() => saveAsNote(s.noteTitle, allText)}>{s.saveNote}</Button>
        ) : null}
        {saveInVault ? (
          <Button onClick={() => saveInVault(vaultEntry)}>{s.saveVault}</Button>
        ) : null}
      </div>
      {saveAsNote ? <p className={styles.muted}>{s.noteWarn}</p> : null}

      <section className={styles.stack} aria-label={s.mail}>
        <div className={styles.row}>
          <div className={styles.grow}>
            <SelectField
              label={s.mailProvider}
              value={mailProvider}
              onChange={(e) => patch({ mailProvider: e.target.value as MailProviderId })}
            >
              {MAIL_PROVIDER_IDS.map((id) => (
                <option key={id} value={id}>
                  {s.providers[id]}
                </option>
              ))}
            </SelectField>
          </div>
          <Button onClick={() => void getPlatform().app.openUrl(MAIL_PROVIDERS[mailProvider])}>
            {s.mail}
          </Button>
        </div>
        <p className={styles.muted}>{s.mailHint}</p>
      </section>
    </div>
  );
}

function PersonaRow({
  label,
  value,
  mono,
  onCopy,
  onReroll,
}: {
  label: string;
  value: string;
  mono: boolean;
  onCopy: () => void;
  onReroll: () => void;
}) {
  return (
    <>
      <span className={styles.label}>{label}</span>
      <span className={mono ? styles.mono : undefined}>{value}</span>
      <span className={styles.row}>
        <IconButton label={s.copyField(label)} onClick={onCopy}>
          <Icon name="copy" size={18} />
        </IconButton>
        <IconButton label={s.rerollField(label)} onClick={onReroll}>
          <Icon name="shuffle" size={18} />
        </IconButton>
      </span>
    </>
  );
}
