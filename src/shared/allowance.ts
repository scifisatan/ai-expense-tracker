// Pacer's pacing math: pure functions, no DB/network access, so the core
// allowance/sweep/queue-ranking logic is testable without infrastructure and
// stays identical whether it's driven by a tRPC route or the day-close cron.
// Money in, money out is always integer minor units (see money.ts).

// Gross income minus off-the-top allocations = the discretionary pool for the
// cycle. Floored at 0 so over-allocating never produces a negative pool.
export const poolMinor = (grossMinor: number, allocationsMinor: number[]): number =>
  Math.max(0, grossMinor - allocationsMinor.reduce((sum, amount) => sum + amount, 0))

export type AllowanceInput = {
  poolMinor: number
  spentBeforeTodayMinor: number
  sweptBeforeTodayMinor: number
  daysRemainingInclusive: number // includes today
}

// Today's spendable amount. Overspend amortizes automatically: spending more
// than a day's allowance grows spentBeforeTodayMinor, so the next division
// spreads the shortfall across every remaining day instead of penalizing a
// single day. Division is floored so the remainder stays in the pool rather
// than being conjured into existence.
export const allowanceForDay = (input: AllowanceInput): number => {
  if (input.daysRemainingInclusive <= 0) return 0
  const available = input.poolMinor - input.spentBeforeTodayMinor - input.sweptBeforeTodayMinor
  return Math.max(0, Math.floor(available / input.daysRemainingInclusive))
}

export type SweepInput = {
  allowanceMinor: number
  spentTodayMinor: number
  sweepPct: number // 0-100
}

// Underspend swept into the Want Fund at the end of a local day. Money spent
// beyond the allowance never produces a negative sweep.
export const sweepMinor = (input: SweepInput): number =>
  Math.max(0, Math.floor(((input.allowanceMinor - input.spentTodayMinor) * input.sweepPct) / 100))

export type DaysToAffordInput = {
  priceMinor: number
  currentBalanceMinor: number
  projectedDailySweepMinor: number
}

// Days until a fund balance would cover a queue item's price at the current
// projected daily sweep rate. `0` if already affordable, `null` if the rate
// is non-positive (would never get there).
export const daysToAfford = (input: DaysToAffordInput): number | null => {
  const remaining = input.priceMinor - input.currentBalanceMinor
  if (remaining <= 0) return 0
  if (input.projectedDailySweepMinor <= 0) return null
  return Math.ceil(remaining / input.projectedDailySweepMinor)
}

// Fractional rank for drag-reorder: insert at the midpoint of its neighbors.
// Either neighbor may be absent (top/bottom of the list).
export const midRank = (prevRank: number | null, nextRank: number | null): number => {
  if (prevRank === null && nextRank === null) return 1000
  if (prevRank === null) return nextRank! - 1000
  if (nextRank === null) return prevRank + 1000
  return (prevRank + nextRank) / 2
}

export const RANK_MIN_GAP = 1e-6

// True once repeated midpoint inserts between the same two neighbors have
// narrowed their gap below float precision — time to renormalize.
export const needsRenormalize = (prevRank: number | null, nextRank: number | null): boolean =>
  prevRank !== null && nextRank !== null && nextRank - prevRank < RANK_MIN_GAP
