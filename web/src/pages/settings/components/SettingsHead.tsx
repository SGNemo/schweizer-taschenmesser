import { useLocation } from 'react-router';
import { categoryDef } from '@/core/settings/registry/categories';
import { visibleCategoryIds } from '@/core/settings/registry/registry';
import { isCategoryId } from '@/core/settings/registry/types';
import { t } from '@/strings';
import { tSettingsV3 } from '@/strings.settingsV3';
import { useMediaQuery, type IconName } from '@/ui';
import { CATEGORY_LOOK, STATUS_LOOK } from '../categoryLook';
import { ModuleRouteHead } from '../ModuleSettingsPage';
import { StatusHead } from '../StatusHead';
import { useSettingsSections } from '../useSections';
import { WIDE_QUERY } from '../wide';
import { SettingsTitle } from './SettingsTitle';

/** `decodeURIComponent` that keeps a malformed escape as it is (a typed `/settings/module/%` must not crash the head). */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Head of the open settings page: "Status" on the landing page (`StatusHead`); on a category and on a module's page
 * the title line of Identity 4.0 (`SettingsTitle`). A state figure belongs in the tab's `StatusCard`, not here. */
export function SettingsHead() {
  const { pathname } = useLocation();
  const v3 = tSettingsV3.use();
  const sections = useSettingsSections();
  const wide = useMediaQuery(WIDE_QUERY);
  const moduleId = /^\/settings\/module\/([^/]+)/.exec(pathname)?.[1];
  if (moduleId) return <ModuleRouteHead moduleId={safeDecode(moduleId)} />;
  const segment = /^\/settings\/([^/]+)/.exec(pathname)?.[1];
  if (!segment) return <StatusHead title={t.settings.title} />;
  // Sections still loading: no head yet (CategoryPage shows its skeleton), so no category head flashes up for a hidden one.
  if (sections.length === 0) return null;
  // An unknown category, or a known one without visible sections (vault off, preview hidden): a "not found" page, no category head.
  if (!isCategoryId(segment) || !visibleCategoryIds(sections).includes(segment))
    return (
      <SettingsTitle
        {...STATUS_LOOK}
        icon="settings"
        eyebrow={v3.eyebrow}
        title={t.settings.title}
        testId="settings-head-missing"
      />
    );
  const c = categoryDef(segment);
  return (
    <SettingsTitle
      {...CATEGORY_LOOK[segment]}
      icon={c.icon as IconName}
      eyebrow={v3.eyebrow}
      title={c.title}
      description={c.description}
      back={wide ? undefined : { to: '/settings', label: t.settings.back }}
      testId={`settings-head-${segment}`}
    />
  );
}
