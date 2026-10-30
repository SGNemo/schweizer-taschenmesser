import { createContext, useContext } from 'react';
import { DEFAULT_CURRENCY } from '@/core/money';

/** The currency the finance views show (accounts in other currencies are filtered out; nothing is converted). */
export const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);
export const useCurrency = (): string => useContext(CurrencyContext);
