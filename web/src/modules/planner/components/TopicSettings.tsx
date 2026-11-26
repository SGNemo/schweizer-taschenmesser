/**
 * „Themen“ in the planner's settings (planner hub 2, package 11; COPY T9, T10): each topic with „Umbenennen“ and
 * „Thema löschen …“ – one confirm sentence, one undo; deleting removes the topic's links and touches no thing.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { t } from '@/strings';
import { Button, Dialog, SettingRow, TextField } from '@/ui';
import { topicRepo } from '../repo';
import { deleteTopic, renameTopic } from '../topic';
import styles from '../routes/planner.module.css';

export function TopicSettings() {
  const p = t.planner.topic;
  const topics = useLiveQuery(
    async () =>
      (await topicRepo.active().toArray()).sort((a, b) =>
        a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }),
      ),
    [],
  );
  const [deleting, setDeleting] = useState<{ id: string; title: string }>();
  const [renaming, setRenaming] = useState<{ id: string; title: string; value: string }>();
  return (
    <section
      id="planner-topics"
      aria-labelledby="planner-topics-head"
      className={styles.topicSettings}
    >
      <h3 id="planner-topics-head" className={styles.topicSettingsHead}>
        {p.section}
      </h3>
      {topics && topics.length === 0 ? <p className={styles.topicHint}>{p.noTopics}</p> : null}
      {(topics ?? []).map((x) => (
        <SettingRow key={x.id} id={`planner-topic-${x.id}`} label={x.title}>
          <Button
            variant="ghost"
            aria-label={`${p.rename}: ${x.title}`}
            onClick={() => setRenaming({ id: x.id, title: x.title, value: x.title })}
          >
            {p.rename}
          </Button>
          <Button
            variant="ghost"
            aria-label={`${p.delete} ${x.title}`}
            onClick={() => setDeleting({ id: x.id, title: x.title })}
          >
            {p.delete}
          </Button>
        </SettingRow>
      ))}
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        title={p.delete}
        footer={
          <>
            <Button data-autofocus onClick={() => setDeleting(undefined)}>
              {t.actions.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const d = deleting;
                setDeleting(undefined);
                if (d) void deleteTopic(d.id);
              }}
            >
              {p.deleteConfirm}
            </Button>
          </>
        }
      >
        <p>{p.deleteSentence}</p>
      </Dialog>
      <Dialog
        open={!!renaming}
        onClose={() => setRenaming(undefined)}
        title={p.rename}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(undefined)}>
              {t.actions.cancel}
            </Button>
            <Button
              onClick={() => {
                const r = renaming;
                setRenaming(undefined);
                if (r) void renameTopic(r.id, r.value);
              }}
            >
              {t.actions.save}
            </Button>
          </>
        }
      >
        {renaming ? (
          <TextField
            label={p.renameLabel(renaming.title)}
            value={renaming.value}
            maxLength={60}
            data-autofocus
            onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
          />
        ) : null}
      </Dialog>
    </section>
  );
}
