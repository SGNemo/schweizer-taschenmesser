/** Money formulas of the calculator's finance mode (pure). Amounts in currency units, rounded to cents. */

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface Discount {
  saving: number;
  final: number;
}

/** Price after a discount of `percent`. */
export function discount(price: number, percent: number): Discount | undefined {
  if (!Number.isFinite(price) || !Number.isFinite(percent) || price < 0 || percent < 0) {
    return undefined;
  }
  if (percent > 100) return undefined;
  const saving = round2((price * percent) / 100);
  return { saving, final: round2(price - saving) };
}

export interface Compound {
  final: number;
  deposited: number;
  interest: number;
}

/**
 * Compound interest: `principal` at `ratePercent` per year for `years`, interest added `perYear` times a
 * year; `monthlyDeposit` is added at the end of each month (0 for none).
 */
export function compoundInterest(
  principal: number,
  ratePercent: number,
  years: number,
  perYear: 1 | 2 | 4 | 12,
  monthlyDeposit = 0,
): Compound | undefined {
  if (![principal, ratePercent, years, monthlyDeposit].every(Number.isFinite)) return undefined;
  if (principal < 0 || ratePercent < 0 || years < 0 || years > 100 || monthlyDeposit < 0) {
    return undefined;
  }
  const months = Math.round(years * 12);
  const monthlyRate = Math.pow(1 + ratePercent / 100 / perYear, perYear / 12) - 1;
  let balance = principal;
  for (let m = 0; m < months; m++) balance = balance * (1 + monthlyRate) + monthlyDeposit;
  const deposited = principal + monthlyDeposit * months;
  return {
    final: round2(balance),
    deposited: round2(deposited),
    interest: round2(balance - deposited),
  };
}

export interface Loan {
  monthly: number;
  total: number;
  interest: number;
  months: number;
}

/** Annuity loan: constant monthly payment over `years` at a nominal yearly rate (0 % allowed). */
export function annuityLoan(amount: number, ratePercent: number, years: number): Loan | undefined {
  if (![amount, ratePercent, years].every(Number.isFinite)) return undefined;
  if (amount <= 0 || ratePercent < 0 || years <= 0 || years > 100) return undefined;
  const months = Math.round(years * 12);
  if (months < 1) return undefined;
  const i = ratePercent / 100 / 12;
  const monthly = i === 0 ? amount / months : (amount * i) / (1 - Math.pow(1 + i, -months));
  const total = monthly * months;
  return {
    monthly: round2(monthly),
    total: round2(total),
    interest: round2(total - amount),
    months,
  };
}
