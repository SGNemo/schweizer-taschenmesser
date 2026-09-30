import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoneyInput, parseMoney } from '@/core/money';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, Split, TextArea, TextField } from '@/ui';
import { safeUrl } from '../logic';
import { ideaRepo } from '../repo';
import { STATUSES, type Idea, type Status } from '../schema';

export type IdeaTarget = Stored<Idea> | { draft: true } | null;

export function IdeaEditor({
  target,
  people,
  onClose,
}: {
  target: IdeaTarget;
  people: readonly string[];
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog open={target !== null} onClose={onClose} title={existing ? t.gifts.edit : t.gifts.add}>
      {target ? (
        <Fields key={existing?.id ?? 'new'} existing={existing} people={people} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  people,
  onClose,
}: {
  existing: Stored<Idea> | null;
  people: readonly string[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [forWhom, setForWhom] = useState(existing?.forWhom ?? '');
  const [occasion, setOccasion] = useState(existing?.occasion ?? '');
  const [date, setDate] = useState(existing?.date ?? '');
  const [price, setPrice] = useState(
    existing?.priceCents === undefined ? '' : formatMoneyInput(existing.priceCents),
  );
  const [url, setUrl] = useState(existing?.url ?? '');
  const [status, setStatus] = useState<Status>(existing?.status ?? 'idea');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<{ title?: string; forWhom?: string; price?: string }>({});

  async function save() {
    const cents = price.trim() === '' ? null : parseMoney(price);
    const next = {
      title: title.trim() ? undefined : t.form.required,
      forWhom: forWhom.trim() ? undefined : t.form.required,
      price: cents === undefined ? t.gifts.badPrice : undefined,
    };
    setErrors(next);
    if (next.title || next.forWhom || next.price || cents === undefined) return;
    const data = {
      title: title.trim(),
      forWhom: forWhom.trim(),
      occasion: occasion.trim() || undefined,
      date: date || undefined,
      priceCents: cents ?? undefined,
      url: safeUrl(url),
      status,
      note: note.trim() || undefined,
    };
    if (existing) await ideaRepo.update(existing.id, data);
    else await ideaRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.gifts.what}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        data-autofocus
      />
      <TextField
        label={t.gifts.forWhom}
        value={forWhom}
        onChange={(e) => setForWhom(e.target.value)}
        error={errors.forWhom}
        list="gift-people"
        autoComplete="off"
      />
      <datalist id="gift-people">
        {people.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <Split>
        <TextField
          label={t.gifts.occasion}
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
        />
        <TextField
          label={t.gifts.date}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Split>
      <Split>
        <TextField
          label={t.gifts.price}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.price}
          inputMode="decimal"
        />
        <SelectField
          label={t.gifts.status}
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.gifts.statuses[s]}
            </option>
          ))}
        </SelectField>
      </Split>
      <TextField
        label={t.gifts.url}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
      />
      <TextArea label={t.gifts.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await ideaRepo.remove(existing.id);
                onClose();
              }}
            >
              {t.actions.delete}
            </Button>
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
