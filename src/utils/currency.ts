export const SUPPORTED_CURRENCIES = ['MAD', 'DH', 'EUR', 'USD', 'TND', 'DZD'] as const;

// Fixed commercial rates relative to 1 MAD:
// 100 MAD = 100 DH = 10 USD = 10 EUR (stable, independent of market fluctuations)
export const FIXED_RATES_FROM_MAD: Record<string, number> = {
  MAD: 1,
  DH: 1,
  USD: 0.1,
  EUR: 0.1,
  TND: 0.3,
  DZD: 13.5,
};

export const DEFAULT_RATES_FROM_MAD = FIXED_RATES_FROM_MAD;

let activeRates: Record<string, number> = { ...FIXED_RATES_FROM_MAD };

export function getExchangeRates(): Record<string, number> {
  return activeRates;
}

export function setExchangeRates(nextRates: Record<string, number>): void {
  const merged: Record<string, number> = { ...FIXED_RATES_FROM_MAD };
  for (const code of SUPPORTED_CURRENCIES) {
    const val = Number(nextRates[code]);
    if (Number.isFinite(val) && val > 0) {
      merged[code] = val;
    }
  }
  merged.MAD = 1;
  merged.DH = 1;
  activeRates = merged;
}

export function getRateFromMad(currency: string): number {
  const code = (currency || 'MAD').toUpperCase();
  const rate = activeRates[code] ?? FIXED_RATES_FROM_MAD[code];
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export function roundCurrencyAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function convertFromMad(amountInMad: number, targetCurrency: string): number {
  const base = Number(amountInMad) || 0;
  const rate = getRateFromMad(targetCurrency);
  return roundCurrencyAmount(base * rate);
}

export function convertToMad(amountInCurrency: number, sourceCurrency: string): number {
  const val = Number(amountInCurrency) || 0;
  const rate = getRateFromMad(sourceCurrency);
  return roundCurrencyAmount(val / rate);
}
