import { useSearchParams } from 'react-router';
import { t } from '@/strings';
import { SelectField } from '@/ui';
import { usePeople } from './people';

/** The `?for=<personId>` filter of a list page. */
export function usePersonFilter(): string {
  const [params] = useSearchParams();
  return params.get('for') ?? '';
}

/**
 * "Für wen": narrows a list to one person's entries. It only appears once at least one entry in
 * view is assigned to somebody (`usedIds`), so pages without assignments stay as quiet as before.
 */
export function PersonFilter({ usedIds }: { usedIds: readonly string[] }) {
  const people = usePeople();
  const [params, setParams] = useSearchParams();
  const current = params.get('for') ?? '';
  const choices = (people ?? []).filter((p) => usedIds.includes(p.id));
  if (choices.length === 0 && !current) return null;
  return (
    <SelectField
      label={t.assign.filter}
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set('for', e.target.value);
        else next.delete('for');
        setParams(next, { replace: true });
      }}
    >
      <option value="">{t.assign.all}</option>
      {choices.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </SelectField>
  );
}
