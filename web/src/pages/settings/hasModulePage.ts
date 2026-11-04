import { hasStartData } from '@/core/dataapi/onboarding';
import type { ModuleManifest } from '@/core/modules/types';

/** Modules that have a settings page of their own: fields or start data, in the "Module" category (the vault sits under Sicherheit). */
export const hasModulePage = (m: ModuleManifest): boolean =>
  (m.settings.category ?? 'module') === 'module' &&
  (m.settings.fields.length > 0 || hasStartData(m));
