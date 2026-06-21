// Shared currency/timezone options for Settings and onboarding, plus best-effort
// guesses from the browser to prefill onboarding.

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "NPR", "JPY", "AUD", "CAD"]

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney"
]

export const guessTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

// Region → currency for the subset we support. Anything else falls back to USD.
const REGION_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  IN: "INR",
  NP: "NPR",
  JP: "JPY",
  AU: "AUD",
  CA: "CAD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  IE: "EUR",
  NL: "EUR"
}

export const guessCurrency = (): string => {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region ?? ""
    return REGION_CURRENCY[region] ?? "USD"
  } catch {
    return "USD"
  }
}
