import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, TextField } from '@/ui';
import { projectRepo } from '../repo';
import type { Project } from '../schema';

export function ProjectsDialog({
  open,
  projects,
  onClose,
}: {
  open: boolean;
  projects: readonly Stored<Project>[];
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  async function add() {
    const value = name.trim();
    if (!value) return;
    await projectRepo.create({ name: value, archived: false });
    setName('');
  }
  return (
    <Dialog open={open} onClose={onClose} title={t.timetrack.projects}>
      <Form onSubmit={() => void add()}>
        <TextField
          label={t.timetrack.projectName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-autofocus
        />
        <div>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {t.timetrack.addProject}
          </Button>
        </div>
      </Form>
      <ul style={{ listStyle: 'none', margin: 'var(--space-4) 0 0', padding: 0 }}>
        {projects.map((p) => (
          <li
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              minHeight: 'var(--touch)',
            }}
          >
            <span style={{ opacity: p.archived ? 0.6 : 1 }}>
              {p.name}
              {p.archived ? ` (${t.timetrack.archived})` : ''}
            </span>
            <Button onClick={() => void projectRepo.update(p.id, { archived: !p.archived })}>
              {p.archived ? t.timetrack.unarchive : t.timetrack.archive}
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
