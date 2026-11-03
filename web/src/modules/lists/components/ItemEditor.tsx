import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { formatMoneyInput, parseMoney } from '@/core/money';
import { Button, Checkbox, Dialog, Form, FormActions, SelectField, TextField } from '@/ui';
import { itemRepo } from '../repo';
import { SECTIONS, SHOPPING_LIST_ID, type Item, type Section } from '../schema';

export function ItemEditor({
  item,
  kind,
  onClose,
}: {
  item: Stored<Item> | null;
  kind: 'shopping' | 'packing' | 'checklist';
  onClose: () => void;
}) {
  return (
    <Dialog open={item !== null} onClose={onClose} title={t.lists.editItem}>
      {item ? <Fields key={item.id} item={item} kind={kind} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({
  item,
  kind,
  onClose,
}: {
  item: Stored<Item>;
  kind: 'shopping' | 'packing' | 'checklist';
  onClose: () => void;
}) {
  const shopping = kind === 'shopping' || item.listId === SHOPPING_LIST_ID;
  const [section, setSection] = useState<Section | ''>(item.section ?? '');
  const [price, setPrice] = useState(
    item.priceCents === undefined ? '' : formatMoneyInput(item.priceCents),
  );
  const [recurring, setRecurring] = useState(item.recurring ?? false);
  const [category, setCategory] = useState(item.category ?? '');
  const [toBuy, setToBuy] = useState(item.toBuy ?? false);
  const [priceError, setPriceError] = useState('');
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? '');
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) return setError(t.form.required);
    const cents = price.trim() === '' ? null : parseMoney(price);
    if (cents === undefined) return setPriceError(t.money.invalidAmount(formatMoneyInput(1250)));
    await itemRepo.update(item.id, {
      name: name.trim(),
      quantity: quantity.trim() || undefined,
      ...(shopping
        ? {
            section: section || undefined,
            priceCents: cents ?? undefined,
            recurring: recurring || undefined,
          }
        : {}),
      ...(kind === 'packing'
        ? { category: category.trim() || undefined, toBuy: toBuy || undefined }
        : {}),
    });
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.lists.itemName}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        error={error}
        data-autofocus
      />
      <TextField
        label={t.lists.quantity}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      {shopping ? (
        <>
          <SelectField
            label={t.lists.section}
            value={section}
            onChange={(e) => setSection(e.target.value as Section | '')}
          >
            <option value="">{t.lists.noSection}</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {t.lists.sections[s]}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t.lists.price}
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setPriceError('');
            }}
            error={priceError}
            inputMode="decimal"
          />
          <Checkbox
            label={t.lists.recurring}
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          <p>{t.lists.recurringHint}</p>
        </>
      ) : null}
      {kind === 'packing' ? (
        <>
          <TextField
            label={t.lists.category}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <Checkbox
            label={t.lists.toBuy}
            checked={toBuy}
            onChange={(e) => setToBuy(e.target.checked)}
          />
        </>
      ) : null}
      <FormActions
        start={
          <Button
            variant="danger"
            onClick={() => {
              const message = t.lists.removedItem(item.name);
              void undoableWithToast(message, message, () => itemRepo.remove(item.id));
              onClose();
            }}
          >
            {t.actions.delete}
          </Button>
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
