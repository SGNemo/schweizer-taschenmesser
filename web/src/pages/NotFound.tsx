import { Link } from 'react-router';
import { t } from '@/strings';
import { EmptyState } from '@/ui';

export function NotFound() {
  return (
    <EmptyState icon="search" title={t.errors.notFound}>
      <Link to="/">{t.nav.dashboard}</Link>
    </EmptyState>
  );
}
