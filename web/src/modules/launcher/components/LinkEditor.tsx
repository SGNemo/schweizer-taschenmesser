import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, FormActions, TextField } from '@/ui';
import { normalizeLaunchUrl } from '../logic';
import { linkRepo } from '../repo';
import type { Link } from '../schema';

export type LinkTarget = Stored<Link> | { draft: true } | null;

export function LinkEditor({ target, onClose }: { target: LinkTarget; onClose: () => void }) {
  const existing = target && 'id' in target ? target : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={existing ? t.launcher.edit : t.launcher.add}
    >
      {target ? <Fields key={existing?.id ?? 'new'} existing={existing} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({ existing, onClose }: { existing: Stored<Link> | null; onClose: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [group, setGroup] = useState(existing?.group ?? '');
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});

  async function save() {
    const normalized = normalizeLaunchUrl(url);
    const next = {
      title: title.trim() ? undefined : t.form.required,
      url: normalized ? undefined : t.launcher.badUrl,
    };
    setErrors(next);
    if (next.title || next.url || !normalized) return;
    const data = { title: title.trim(), url: normalized, group: group.trim() || undefined };
    if (existing) await linkRepo.update(existing.id, data);
    else await linkRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={t.form.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        data-autofocus
      />
      <TextField
        label={t.launcher.url}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        error={errors.url}
        hint={t.launcher.urlHint}
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
      />
      <TextField
        label={t.launcher.group}
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        hint={t.launcher.groupHint}
      />
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await linkRepo.remove(existing.id);
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
