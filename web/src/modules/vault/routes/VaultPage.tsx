import { tDeadline } from '@/strings.deadline';
import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { blobKeys, getBlob, pruneBlobs } from '@/core/blobs';
import { getPlatform } from '@/core/platform';
import { formatDay, relativeDayLabel, today } from '@/core/time/dates';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import { t } from '@/strings';
import {
  Badge,
  Button,
  EmptyState,
  FolderTabs,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  TextField,
  useOpenParam,
} from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { DocumentEditor, type DocumentTarget } from '../components/DocumentEditor';
import { VaultHead } from '../components/VaultHead';
import { changeWithUndo } from '@/core/undo/withToast';
import {
  cancelDeadline,
  countByCategory,
  endOf,
  filterDocuments,
  formatSize,
  RENEWABLE,
  renewedEnd,
  safeFileName,
  sortDocuments,
  stateGroup,
  statusOf,
  type StateGroup,
} from '../logic';
import { documentRepo, keepBlobIds } from '../repo';
import styles from './VaultPage.module.css';
import { CATEGORIES, type DocCategory } from '../schema';

async function download(id: string, name: string) {
  const blob = await getBlob(id);
  if (!blob) return;
  await getPlatform().saveFile({
    fileName: safeFileName(name),
    data: blob,
    mime: blob.type || 'application/octet-stream',
  });
}

/** A date segment of a card's meta line: never broken between day, month and year (U53). */
const dated = (text: string) => <span className={styles.nowrap}>{text}</span>;

/** The card's meta line: its parts joined with " · ", empty parts left out. */
function metaLine(parts: (ReactNode | undefined)[]) {
  return parts.filter(Boolean).map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? ' · ' : null}
      {part}
    </Fragment>
  ));
}

export default function VaultPage() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const files = useLiveQuery(async () => new Set(await blobKeys()), []);
  const [category, setCategory] = useState<DocCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<StateGroup | null>(null);
  const [target, setTarget] = useState<DocumentTarget>(null);
  useOpenParam((id) => documentRepo.get(id), setTarget);
  const [params, setParams] = useSearchParams();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  // Files of documents that were deleted on another device are dead weight here.
  // A document deleted here stays restorable for 30 days, so its file stays too.
  const keep = useLiveQuery(() => keepBlobIds(), []);
  useEffect(() => {
    if (keep) void pruneBlobs(keep);
  }, [keep]);

  const shown = useMemo(
    () =>
      sortDocuments(
        filterDocuments(docs ?? [], { category, query }).filter(
          (d) => !state || stateGroup(statusOf(d, day)) === state,
        ),
        day,
      ),
    [docs, category, query, state, day],
  );

  const counts = countByCategory(docs ?? []);

  return (
    <>
      <PageHeader title={t.vault.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.vault.add}
        </Button>
        {docs && docs.length === 0 ? <StartDataMenu moduleId="vault" /> : null}
      </PageHeader>
      <p className={styles.privacy} data-testid="vault-local">
        <Icon name="lock" size={16} />
        <span>{t.vault.privacyLine}</span>
      </p>
      <VaultHead docs={docs ?? []} day={day} state={state} onState={setState} />
      <TextField
        label={t.vault.search}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <FolderTabs
        folder
        testId="folder-tabs"
        label={t.vault.category}
        value={category}
        onChange={(id) => setCategory(id as DocCategory | 'all')}
        tabs={[
          { id: 'all', label: t.vault.allCategories, count: docs?.length ?? 0 },
          ...CATEGORIES.map((c) => ({
            id: c,
            label: t.vault.categories[c] ?? c,
            count: counts[c] ?? 0,
          })),
        ]}
      />
      {docs && shown.length === 0 ? (
        <EmptyState
          title={docs.length === 0 ? t.vault.empty : t.vault.emptyFiltered}
          testId="vault-empty"
          motif={<SignatureMark id="folderTab" size={64} />}
        />
      ) : null}
      <ItemList layout="grid" label={t.vault.title}>
        {shown.map((d) => {
          const state = statusOf(d, day);
          const end = endOf(d);
          const deadline = cancelDeadline(d);
          const hasFile = files?.has(d.id) ?? false;
          return (
            <ItemRow
              key={d.id}
              className={styles.doc}
              signatureBlock="vault-doc"
              title={d.title}
              onOpen={() => setTarget(d)}
              meta={metaLine([
                t.vault.categories[d.category],
                d.provider,
                end ? dated(`${t.vault.endLabel}: ${formatDay(end, 'd. MMM yyyy')}`) : undefined,
                deadline && state === 'missed'
                  ? dated(tDeadline.get().missedOn(formatDay(deadline, 'd. MMM yyyy')))
                  : deadline && state !== 'expired'
                    ? dated(`${t.vault.deadlineLabel}: ${relativeDayLabel(deadline, day)}`)
                    : undefined,
                d.fileName
                  ? `${d.fileName}${d.fileSize !== undefined ? ` (${formatSize(d.fileSize)})` : ''}${hasFile ? '' : ` · ${t.vault.fileElsewhere}`}`
                  : undefined,
              ])}
              end={
                <>
                  {state === 'ok' || state === 'open-ended' ? null : (
                    <Badge
                      tone={
                        state === 'expired'
                          ? 'danger'
                          : state === 'act-now' || state === 'missed' || state === 'soon'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {state === 'missed' ? tDeadline.get().missed : t.vault.status[state]}
                    </Badge>
                  )}
                  {RENEWABLE.includes(d.category) &&
                  renewedEnd(d) &&
                  (state === 'act-now' || state === 'missed' || state === 'expired') ? (
                    <Button
                      size="sm"
                      aria-label={t.vault.renewAria(d.title)}
                      onClick={() =>
                        void changeWithUndo(
                          () =>
                            documentRepo.update(d.id, {
                              endDate: renewedEnd(d),
                              expiresOn: undefined,
                            }),
                          t.vault.renewed(d.title, formatDay(renewedEnd(d)!, 'd. MMM yyyy')),
                        )
                      }
                    >
                      {t.vault.renew}
                    </Button>
                  ) : null}
                  {hasFile && d.fileName ? (
                    <Button
                      variant="ghost"
                      aria-label={`${t.vault.download}: ${d.title}`}
                      onClick={() => void download(d.id, d.fileName!)}
                    >
                      <Icon name="download" size={18} />
                    </Button>
                  ) : null}
                </>
              }
            />
          );
        })}
      </ItemList>
      <DocumentEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
