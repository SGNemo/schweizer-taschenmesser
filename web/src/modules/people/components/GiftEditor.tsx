import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { formatMoneyInput, parseMoney } from '@/core/money';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, SelectField, Split, TextArea, TextField } from '@/ui';
import { safeUrl } from '../logic';
import { giftRepo } from '../repo';
import { GIFT_STATUSES, type Gift, type GiftStatus } from '../schema';

export type GiftTarget = Stored<Gift> | { draft: true } | null;

export function GiftEditor({
  target,
  personId,
  onClose,
}: {
  target: GiftTarget;
  personId: string;
  onClose: () => void;
}) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.people.editGift : t.people.addGift}
    >
      {target ? (
        <Fields
          key={existing?.id ?? 'new'}
          existing={existing}
          personId={personId}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  existing,
  personId,
  onClose,
}: {
  existing: Stored<Gift> | null;
  personId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [occasion, setOccasion] = useState(existing?.occasion ?? '');
  const [date, setDate] = useState(existing?.date ?? '');
  const [price, setPrice] = useState(
    existing?.priceCents === undefined ? '' : formatMoneyInput(existing.priceCents),
  );
  const [url, setUrl] = useState(existing?.url ?? '');
  const [status, setStatus] = useState<GiftStatus>(existing?.status ?? 'idea');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});

  async function save() {
    const cents = price.trim() === '' ? null : parseMoney(price);
    const next = {
      title: title.trim() ? undefined : t.form.required,
      price: cents === undefined ? t.people.gift.badPrice(formatMoneyInput(1990)) : undefined,
    };
    setErrors(next);
    if (next.title || next.price || cents === undefined) return;
    const data = {
      title: title.trim(),
      personId,
      occasion: occasion.trim() || undefined,
      date: date || undefined,
      priceCents: cents ?? undefined,
      url: safeUrl(url),
      status,
      note: note.trim() || undefined,
    };
    if (existing) await giftRepo.update(existing.id, data);
    else await giftRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.people.gift.what}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        data-autofocus
      />
      <Split>
        <TextField
          label={t.people.gift.occasion}
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
        />
        <TextField
          label={t.people.gift.date}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Split>
      <Split>
        <TextField
          label={t.people.gift.price}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.price}
          inputMode="decimal"
        />
        <SelectField
          label={t.people.gift.status}
          value={status}
          onChange={(e) => setStatus(e.target.value as GiftStatus)}
        >
          {GIFT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.people.gift.statuses[s]}
            </option>
          ))}
        </SelectField>
      </Split>
      <TextField
        label={t.people.gift.url}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
      />
      <TextArea label={t.people.gift.note} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await giftRepo.remove(existing.id);
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
