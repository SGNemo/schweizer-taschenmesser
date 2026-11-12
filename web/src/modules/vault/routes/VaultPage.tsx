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
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  Segmented,
  SplitView,
  Tabs,
  TextField,
  useOpenParam,
  useSplitView,
} from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { DocumentDetail } from '../components/DocumentDetail';
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
  STATE_GROUPS,
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
  const [state, setState] = useState<StateGroup | 'all'>('all');
  // Master–detail (layout `split`): on a wide page a document shows in the panel beside the folders, below that
  // width the folder opens its dialog (a sheet on the phone).
  const wide = useSplitView();
  const [picked, setPicked] = useState<string | null>(null);
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
          (d) => state === 'all' || stateGroup(statusOf(d, day)) === state,
        ),
        day,
      ),
    [docs, category, query, state, day],
  );

  const counts = countByCategory(docs ?? []);
  const groups = (docs ?? []).map((d) => stateGroup(statusOf(d, day)));
  const none = !!docs && docs.length === 0;
  // The panel shows the document that was picked; before that the page shows no note and no full detail (they are
  // not for whoever happens to look at the screen when the page opens). A pick ends when its folder leaves the
  // list (filter, search, delete): the panel never opens again by itself.
  const detail = picked ? shown.find((d) => d.id === picked) : undefined;
  if (picked && docs && !detail) setPicked(null);

  return (
    <>
      <PageHeader
        title={t.vault.title}
        besideContent={!none}
        views={
          <Tabs
            label={t.vault.stateTabs}
            value={state}
            options={[
              { value: 'all' as const, label: t.vault.allStates },
              ...STATE_GROUPS.map((g) => ({
                value: g,
                label: t.vault.labelCount(
                  t.vault.stateGroups[g],
                  groups.filter((x) => x === g).length,
                ),
              })),
            ]}
            onChange={setState}
          />
        }
      >
        {/* While nothing is filed, the empty state holds the one filled step. */}
        <PageAction
          short={t.vault.meta.quickAdd}
          variant={none ? 'secondary' : 'primary'}
          onClick={() => setTarget({ draft: true })}
        >
          <Icon name="plus" size={18} />
          {t.vault.add}
        </PageAction>
        <StartDataMenu moduleId="vault" />
      </PageHeader>
      <VaultHead docs={docs ?? []} day={day} />
      {none ? null : (
        <div className={styles.filters}>
          {/* The first row of the page: on the phone the "⋯" menu lies beside it (`besideContent`). */}
          <div className={styles.first}>
            <TextField
              label={t.vault.search}
              labelHidden
              placeholder={t.vault.search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-list-search
            />
          </div>
          <Segmented
            label={t.vault.category}
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all' as const, label: t.vault.allCategories },
              ...CATEGORIES.filter((c) => (counts[c] ?? 0) > 0 || c === category).map((c) => ({
                value: c,
                label: t.vault.labelCount(t.vault.categories[c] ?? c, counts[c] ?? 0),
              })),
            ]}
          />
        </div>
      )}
      <p className={styles.privacy} data-testid="vault-local">
        <Icon name="lock" size={16} />
        <span>{t.vault.privacyLine}</span>
      </p>
      <SplitView
        enabled={wide && detail !== undefined}
        asideLabel={t.vault.detail.label}
        aside={
          detail ? (
            <DocumentDetail
              doc={detail}
              day={day}
              hasFile={files?.has(detail.id) ?? false}
              onEdit={() => setTarget(detail)}
              onClose={() => setPicked(null)}
            />
          ) : null
        }
      >
        {docs && shown.length === 0 ? (
          <EmptyState
            title={none ? t.vault.empty : t.vault.emptyFiltered}
            testId="vault-empty"
            motif={<SignatureMark id="folderTab" size={64} />}
          >
            {none ? (
              <Button variant="primary" onClick={() => setTarget({ draft: true })}>
                {t.vault.addFirst}
              </Button>
            ) : null}
          </EmptyState>
        ) : null}
        {shown.length > 0 ? (
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
                  current={wide && detail?.id === d.id}
                  onOpen={() => (wide ? setPicked(d.id) : setTarget(d))}
                  meta={metaLine([
                    t.vault.categories[d.category],
                    d.provider,
                    end
                      ? dated(`${t.vault.endLabel}: ${formatDay(end, 'd. MMM yyyy')}`)
                      : undefined,
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
        ) : null}
      </SplitView>
      <DocumentEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
