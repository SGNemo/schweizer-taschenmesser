import { parseCsv } from '@/core/io/csv';
import { best, extOf } from '../helpers';
import type { SourceDef } from '../types';
import { detectVaultCsv } from './header';

/** Password manager CSV (Bitwarden, KeePass, 1Password). It opens the vault's own import: it needs the master password. */
export const source: SourceDef = {
  id: 'vault-csv',
  targets: [{ moduleId: 'accounts', route: '/accounts?tools=1' }],
  extensions: ['csv'],
  detect: (files) =>
    best(files, (f) => {
      if (extOf(f.name) !== 'csv') return 0;
      const [header] = parseCsv(f.text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '', {
        delimiter: ',',
      });
      return header && detectVaultCsv(header) ? 0.95 : 0;
    }),
};
