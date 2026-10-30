import { t } from '@/strings';
import { SelectField } from '@/ui';
import { usePeople } from './people';

/** "Für": pick the person or client an entry is for. Nothing to show while there are no people. */
export function PersonField({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const people = usePeople();
  if (!people || (people.length === 0 && !value)) return null;
  const known = people.some((p) => p.id === value);
  return (
    <SelectField label={t.assign.label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t.assign.none}</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      {value && !known ? <option value={value}>{t.assign.removed}</option> : null}
    </SelectField>
  );
}
