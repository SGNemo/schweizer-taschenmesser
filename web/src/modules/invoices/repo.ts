import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { invoiceSchema } from './schema';

export const invoiceRepo = createRepo(tableName('invoices', 'invoice'), invoiceSchema);
