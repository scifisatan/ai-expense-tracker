// Time handling for the ledger.
//
// `transactions.occurred_at` is TEXT in SQLite, written by D1's CURRENT_TIMESTAMP
// default as a UTC wall-clock string "YYYY-MM-DD HH:MM:SS" (no `T`, no `Z`).
// Every value we write by hand MUST use the same shape so lexicographic range
// comparisons (Phase 3) stay correct. These helpers are the single source of
// that formatting plus the timezone math for period boundaries.

// Milliseconds the given IANA timezone is offset from UTC at `date`
// (positive east of UTC). Derived by formatting the instant in the zone and
// diffing against UTC.
const tzOffsetMs = (tz: string, date: Date): number => {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
    const parts = dtf.formatToParts(date)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    // Intl renders hour "24" for midnight in some engines; normalize to 0.
    const hour = get("hour") % 24
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      hour,
      get("minute"),
      get("second")
    )
    return asUtc - date.getTime()
  } catch {
    return 0 // Unknown timezone → treat as UTC.
  }
}

// The UTC instant whose wall-clock representation in `tz` is the given local
// time. One offset correction is enough outside rare DST-transition minutes.
const zonedWallTimeToUtc = (
  tz: string,
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset = tzOffsetMs(tz, new Date(utcGuess))
  return new Date(utcGuess - offset)
}

// Format a UTC instant as the DB's "YYYY-MM-DD HH:MM:SS" (always UTC).
export const toDbTimestamp = (date: Date): string =>
  date.toISOString().slice(0, 19).replace("T", " ")

// Today's calendar date ("YYYY-MM-DD") in the given timezone. Passed to the AI so
// it can resolve "yesterday" / "last Friday".
export const localDateString = (tz: string, now: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now) // en-CA renders as YYYY-MM-DD
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

// Normalize an AI-supplied date into a DB timestamp, or null if invalid / in the
// future. A bare "YYYY-MM-DD" is anchored at local noon in `tz` then converted to
// UTC — noon is safely inside the local day for any offset, so the value always
// buckets into the correct local month. A full ISO datetime is taken as-is.
export const normalizeBackdate = (
  value: string,
  tz: string,
  now: Date = new Date()
): string | null => {
  const trimmed = value.trim()
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)

  let instant: Date
  if (dateOnly) {
    instant = zonedWallTimeToUtc(
      tz,
      Number(dateOnly[1]),
      Number(dateOnly[2]),
      Number(dateOnly[3]),
      12
    )
  } else {
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    instant = parsed
  }

  if (Number.isNaN(instant.getTime())) return null
  // Reject far-future dates (allow a day of slack for tz skew).
  if (instant.getTime() > now.getTime() + 24 * 60 * 60 * 1000) return null

  return toDbTimestamp(instant)
}

export type DbRange = { from: string; to: string }

// [start, end) DB timestamps for the local month containing `now`.
export const monthRange = (tz: string, now: Date = new Date()): DbRange => {
  const local = localDateString(tz, now)
  const [year, month] = local.split("-").map(Number)
  const from = zonedWallTimeToUtc(tz, year, month, 1)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const to = zonedWallTimeToUtc(tz, nextYear, nextMonth, 1)
  return { from: toDbTimestamp(from), to: toDbTimestamp(to) }
}

// Resolve a period selector to a [from, to) DB range against the account tz.
// A "custom" period uses the supplied from/to (normalized through the same
// local-noon anchoring as backdates); falls back to the current month.
export const resolvePeriod = (
  selector: { period: "month" | "week" | "custom"; from?: string; to?: string } | undefined,
  tz: string,
  now: Date = new Date()
): DbRange => {
  if (!selector || selector.period === "month") return monthRange(tz, now)
  if (selector.period === "week") return weekRange(tz, now)

  const from = selector.from ? normalizeBackdate(selector.from, tz, new Date(8.64e15)) : null
  const to = selector.to ? normalizeBackdate(selector.to, tz, new Date(8.64e15)) : null
  if (from && to) return { from, to }
  return monthRange(tz, now)
}

// Period key for alert bookkeeping, e.g. "2026-06" for the local month.
export const monthKey = (tz: string, now: Date = new Date()): string =>
  localDateString(tz, now).slice(0, 7)

// [start, end) DB timestamps for the local week (Monday-anchored) containing `now`.
export const weekRange = (tz: string, now: Date = new Date()): DbRange => {
  const local = localDateString(tz, now)
  const [year, month, day] = local.split("-").map(Number)
  // Day-of-week for the local date, Monday=0.
  const dow = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
  const start = zonedWallTimeToUtc(tz, year, month, day - dow)
  const end = zonedWallTimeToUtc(tz, year, month, day - dow + 7)
  return { from: toDbTimestamp(start), to: toDbTimestamp(end) }
}
