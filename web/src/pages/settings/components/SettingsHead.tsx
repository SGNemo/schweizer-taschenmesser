import { useLocation } from 'react-router';
import { categoryDef } from '@/core/settings/registry/categories';
import { visibleCategoryIds } from '@/core/settings/registry/registry';
import { isCategoryId } from '@/core/settings/registry/types';
import { t } from '@/strings';
import { tSettingsV3 } from '@/strings.settingsV3';
import type { IconName } from '@/ui';
import { CATEGORY_LOOK, STATUS_LOOK } from '../categoryLook';
import { ModuleRouteHead } from '../ModuleSettingsPage';
import { PageHead } from '../PageHead';
import { StatusHead } from '../StatusHead';
import { useSettingsSections } from '../useSections';

/** `decodeURIComponent` that keeps a malformed escape as it is (a typed `/settings/module/%` must not crash the head). */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Head of a settings tab (identity v3.1), like the tool heads: the category's icon on a plate in its hue, the title and
 * one line of description, compact (variant B: a state figure belongs in the tab's `StatusCard`, not here).
 *
 * Head of the open settings page: "Status" on the landing page, the category's own head on a category, the module's on its page. */
export function SettingsHead() {
  const { pathname } = useLocation();
  const v3 = tSettingsV3.use();
  const sections = useSettingsSections();
  const moduleId = /^\/settings\/module\/([^/]+)/.exec(pathname)?.[1];
  if (moduleId) return <ModuleRouteHead moduleId={safeDecode(moduleId)} />;
  const segment = /^\/settings\/([^/]+)/.exec(pathname)?.[1];
  if (!segment) return <StatusHead title={t.settings.title} />;
  // Sections still loading: no head yet (CategoryPage shows its skeleton), so no category head flashes up for a hidden one.
  if (sections.length === 0) return null;
  // An unknown category, or a known one without visible sections (vault off, preview hidden): a "not found" page, no category head.
  if (!isCategoryId(segment) || !visibleCategoryIds(sections).includes(segment))
    return (
      <PageHead
        {...STATUS_LOOK}
        icon="settings"
        eyebrow={v3.eyebrow}
        title={t.settings.title}
        testId="settings-head-missing"
      />
    );
  const c = categoryDef(segment);
  return (
    <PageHead
      {...CATEGORY_LOOK[segment]}
      icon={c.icon as IconName}
      eyebrow={v3.eyebrow}
      title={c.title}
      description={c.description}
      testId={`settings-head-${segment}`}
    />
  );
}
