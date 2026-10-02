import { Link } from 'react-router';
import { t } from '@/strings';
import { EmptyState } from '@/ui';

export function NotFound() {
  return (
    <EmptyState title={t.errors.notFound}>
      <Link to="/">{t.nav.home}</Link>
    </EmptyState>
  );
}
