import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button, Dialog, Form, patternStyles, TextField } from '@/ui';
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
      <ul className={patternStyles.plainListGap}>
        {projects.map((p) => (
          <li key={p.id} className={patternStyles.listRow}>
            <span className={p.archived ? patternStyles.dimmed : undefined}>
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
