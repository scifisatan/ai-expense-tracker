// Money is stored in the database as integer minor units (e.g. cents) to avoid
// floating-point drift. The API contract and UI work in major-unit decimals.

// Currencies whose minor unit is the same as the major unit (no fractional part).
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF"])

export const currencyFractionDigits = (currency: string): number =>
  ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2

// Convert a major-unit decimal amount (e.g. 12.50) to minor units (e.g. 1250).
export const toMinor = (amount: number, currency: string): number => {
  const factor = 10 ** currencyFractionDigits(currency)
  return Math.round(amount * factor)
}

// Convert minor units back to a major-unit decimal amount.
export const fromMinor = (minor: number, currency: string): number => {
  const factor = 10 ** currencyFractionDigits(currency)
  return minor / factor
}

// Human-readable amount with currency, e.g. "$12.50". Falls back to a generic
// "<CODE> <amount>" format when Intl has no symbol for the currency.
export const formatMoney = (minor: number, currency: string): string => {
  const fractionDigits = currencyFractionDigits(currency)
  const amount = fromMinor(minor, currency)

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount)
  } catch {
    return `${currency.toUpperCase()} ${amount.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })}`
  }
}
