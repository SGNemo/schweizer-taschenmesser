import type { Stored } from '@/core/db/types';
import type { Account, Category, Transaction } from './schema';

export interface FinanceData {
  accounts: Stored<Account>[];
  categories: Stored<Category>[];
  txs: Stored<Transaction>[];
}
