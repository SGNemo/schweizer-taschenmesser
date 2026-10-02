/** Dev-Preview / E2E only: every shared component on one page (axe audit and screenshot target). */
import { useState } from 'react';
import { t } from '@/strings';
import { tDev } from '@/strings.dev';
import { useUiStore } from '@/stores/ui';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  Chips,
  DateField,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  Progress,
  Segmented,
  SelectField,
  SelectionBar,
  SkeletonRows,
  Switch,
  Tabs,
  TextArea,
  TextField,
  useDraft,
  useSelection,
} from '@/ui';
import styles from './ComponentSheet.module.css';

const c = tDev.components;
const ROWS = [
  { id: 'a', title: c.rowOne, meta: c.rowOneMeta },
  { id: 'b', title: c.rowTwo, meta: c.rowTwoMeta },
  { id: 'c', title: c.rowThree, meta: c.rowThreeMeta },
];

export default function ComponentSheet() {
  const toast = useUiStore((s) => s.toast);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [chip, setChip] = useState('all');
  const [tab, setTab] = useState('a');
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft, clearDraft] = useDraft('component-sheet', { name: '' });
  const selection = useSelection(ROWS.map((r) => r.id));

  return (
    <div className={styles.sheet}>
      <PageHeader title={c.title} />
      <p className={styles.intro}>{c.intro}</p>

      <section className={styles.section} aria-labelledby="cs-buttons">
        <h2 id="cs-buttons">{c.buttons}</h2>
        <div className={styles.cluster}>
          <Button variant="primary">{c.primary}</Button>
          <Button>{c.secondary}</Button>
          <Button variant="ghost">{c.quiet}</Button>
          <Button variant="danger">{c.danger}</Button>
          <Button variant="quietDanger">{c.quietDanger}</Button>
          <Button size="sm">{c.small}</Button>
          <Button disabled>{c.disabled}</Button>
          <IconButton label={c.iconButton}>
            <Icon name="edit" />
          </IconButton>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="cs-fields">
        <h2 id="cs-fields">{c.fields}</h2>
        <div className={styles.grid}>
          <TextField label={c.name} hint={c.nameHint} defaultValue="Anna" />
          <TextField label={c.name} error={c.nameError} defaultValue="" />
          <SelectField label={c.account} defaultValue="giro">
            <option value="giro">{c.accountOne}</option>
            <option value="spar">{c.accountTwo}</option>
          </SelectField>
          <DateField label={c.due} defaultValue="2026-10-05" />
          <TextArea label={c.note} />
          <div>
            <Checkbox label={c.checkbox} defaultChecked />
            <Switch label={c.switchLabel} checked={on} onChange={setOn} />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="cs-choices">
        <h2 id="cs-choices">{c.choices}</h2>
        <div className={styles.cluster}>
          <Segmented
            label={c.view}
            value={view}
            onChange={setView}
            options={[
              { value: 'month', label: c.month },
              { value: 'week', label: c.week },
            ]}
          />
          <Chips label={c.choices}>
            {(
              [
                ['all', c.chipOne],
                ['open', c.chipTwo],
                ['paid', c.chipThree],
              ] as const
            ).map(([id, label]) => (
              <Chip key={id} label={label} selected={chip === id} onClick={() => setChip(id)} />
            ))}
          </Chips>
        </div>
        <h3>{c.tabs}</h3>
        <Tabs
          label={c.tabsLabel}
          onSelect={setTab}
          items={[
            { id: 'a', label: c.tabA, active: tab === 'a' },
            { id: 'b', label: c.tabB, active: tab === 'b' },
            { id: 'c', label: c.tabC, active: tab === 'c' },
          ]}
        />
      </section>

      <section className={styles.section} aria-labelledby="cs-cards">
        <h2 id="cs-cards">{c.cards}</h2>
        <Card title={c.cardTitle}>{c.cardBody}</Card>
      </section>

      <section className={styles.section} aria-labelledby="cs-rows">
        <h2 id="cs-rows">{c.rows}</h2>
        <SelectionBar count={selection.count} onCancel={selection.clear}>
          <Button size="sm">{c.selectionActions}</Button>
        </SelectionBar>
        <ItemList label={c.rowsLabel}>
          {ROWS.map((r, i) => (
            <ItemRow
              key={r.id}
              title={r.title}
              meta={r.meta}
              onOpen={() => undefined}
              end={<strong>{c.amount}</strong>}
              selectable
              selected={selection.isSelected(r.id)}
              onSelectChange={(_, extend) => selection.toggle(r.id, extend)}
              done={i === 2}
              onSwipeRight={() => toast(c.toastMessage)}
              swipeRightLabel={c.swipeDone}
              onSwipeLeft={() => toast(c.toastMessage)}
              swipeLeftLabel={c.swipeLater}
              actions={
                <IconButton label={c.delete}>
                  <Icon name="trash" />
                </IconButton>
              }
            />
          ))}
        </ItemList>
      </section>

      <section className={styles.section} aria-labelledby="cs-badges">
        <h2 id="cs-badges">{c.badges}</h2>
        <div className={styles.cluster}>
          <Badge tone="accent">{c.badgeEvent}</Badge>
          <Badge>{c.badgeReminder}</Badge>
          <Badge tone="danger">{c.badgeOverdue}</Badge>
          <Badge tone="success">{c.badgePaid}</Badge>
          <Badge tone="warning">{c.badgeExpiring}</Badge>
          <Badge tone="info">{c.badgeInfo}</Badge>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="cs-states">
        <h2 id="cs-states">{c.states}</h2>
        <Progress value={64} max={100} label={c.progressLabel} />
        <SkeletonRows />
        <EmptyState title={c.empty}>
          <Button variant="primary">{c.emptyAction}</Button>
        </EmptyState>
        <ErrorState title={c.error} onRetry={() => undefined} />
      </section>

      <section className={styles.section} aria-labelledby="cs-feedback">
        <h2 id="cs-feedback">{c.feedback}</h2>
        <div className={styles.cluster}>
          <Button onClick={() => toast(c.toastMessage)}>{c.toast}</Button>
          <Button
            onClick={() =>
              toast(c.toastMessage, { label: t.ui.undo, run: () => toast(c.toastUndone) })
            }
          >
            {c.toastUndo}
          </Button>
          <Button onClick={() => setOpen(true)}>{c.openDialog}</Button>
        </div>
        <p className={styles.intro}>{c.dialogHint}</p>
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={c.dialogTitle}
        dirty={draft.name.length > 0}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                clearDraft();
                setDraft({ name: '' });
                setOpen(false);
              }}
            >
              {c.save}
            </Button>
          </>
        }
      >
        <TextField
          label={c.name}
          data-autofocus
          value={draft.name}
          onChange={(e) => setDraft({ name: e.target.value })}
        />
      </Dialog>
    </div>
  );
}
