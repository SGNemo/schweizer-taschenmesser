import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { blobKeys, getBlob, pruneBlobs } from '@/core/blobs';
import { getPlatform } from '@/core/platform';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import {
  Badge,
  Button,
  Chip,
  Chips,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  TextField,
} from '@/ui';
import { DocumentEditor, type DocumentTarget } from '../components/DocumentEditor';
import { expiryState, filterDocuments, formatSize, safeFileName, sortDocuments } from '../logic';
import { documentRepo } from '../repo';
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

export default function VaultPage() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const files = useLiveQuery(async () => new Set(await blobKeys()), []);
  const [category, setCategory] = useState<DocCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<DocumentTarget>(null);
  const [params, setParams] = useSearchParams();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  // Files of documents that were deleted on another device are dead weight here.
  useEffect(() => {
    if (docs) void pruneBlobs(new Set(docs.map((d) => d.id)));
  }, [docs]);

  const shown = useMemo(
    () => sortDocuments(filterDocuments(docs ?? [], { category, query })),
    [docs, category, query],
  );

  return (
    <>
      <PageHeader title={t.vault.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.vault.add}
        </Button>
      </PageHeader>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{t.vault.localOnly}</p>
      <TextField
        label={t.vault.search}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div style={{ margin: 'var(--space-3) 0' }}>
        <Chips label={t.vault.category}>
          <Chip
            label={t.vault.allCategories}
            selected={category === 'all'}
            onClick={() => setCategory('all')}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t.vault.categories[c] ?? c}
              selected={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </Chips>
      </div>
      {docs && shown.length === 0 ? (
        <EmptyState icon="lock" title={docs.length === 0 ? t.vault.empty : t.vault.emptyFiltered} />
      ) : null}
      <ItemList label={t.vault.title}>
        {shown.map((d) => {
          const state = expiryState(d, day);
          const hasFile = files?.has(d.id) ?? false;
          return (
            <ItemRow
              key={d.id}
              title={d.title}
              onOpen={() => setTarget(d)}
              meta={[
                t.vault.categories[d.category],
                d.expiresOn
                  ? `${t.vault.expiresOn}: ${formatDay(d.expiresOn, 'd. MMM yyyy')}`
                  : undefined,
                d.fileName
                  ? `${d.fileName}${d.fileSize !== undefined ? ` (${formatSize(d.fileSize)})` : ''}${hasFile ? '' : ` · ${t.vault.fileElsewhere}`}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
              end={
                <>
                  {state === 'expired' || state === 'soon' ? (
                    <Badge tone={state === 'expired' ? 'accent' : 'neutral'}>
                      {state === 'expired' ? t.vault.expired : t.vault.soon}
                    </Badge>
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
