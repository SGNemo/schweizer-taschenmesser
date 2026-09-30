import type { ModuleManifest } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button } from '@/ui';
import { buildAiSchemaText } from './text';

/** Copies the compact format description of a module (no user data) for pasting into an AI tool. */
export function CopySchemaButton({ manifest }: { manifest: ModuleManifest }) {
  const toast = useUiStore((s) => s.toast);
  async function copy() {
    try {
      await getPlatform().clipboard.writeText(buildAiSchemaText(manifest));
      toast(t.dataApi.schemaCopied);
    } catch {
      toast(t.dataApi.copyFailed);
    }
  }
  return (
    <Button onClick={() => void copy()} title={t.dataApi.copyHint}>
      {t.dataApi.copySchema}
    </Button>
  );
}
