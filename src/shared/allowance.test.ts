import { describe, it, expect } from "vitest"
import {
  poolMinor,
  allowanceForDay,
  sweepMinor,
  daysToAfford,
  midRank,
  needsRenormalize
} from "./allowance"

describe("poolMinor", () => {
  it("subtracts allocations from gross", () => {
    expect(poolMinor(1_800_000, [500_000, 200_000])).toBe(1_100_000)
  })

  it("floors at 0 when allocations exceed gross", () => {
    expect(poolMinor(1000, [2000])).toBe(0)
  })
})

describe("allowanceForDay", () => {
  it("splits the pool evenly across all remaining days on day one", () => {
    const allowance = allowanceForDay({
      poolMinor: 18000,
      spentBeforeTodayMinor: 0,
      sweptBeforeTodayMinor: 0,
      daysRemainingInclusive: 30
    })

    expect(allowance).toBe(600)
  })

  it("amortizes an overspend across the remaining days instead of penalizing the next day alone", () => {
    // Worked example from the plan: day 3 overspends by 900 out of a 600
    // allowance; day 4 has 27 days left afterward.
    const allowance = allowanceForDay({
      poolMinor: 18000,
      spentBeforeTodayMinor: 400 + 600 + 1500, // days 1-3 spend
      sweptBeforeTodayMinor: 200, // day 1's sweep
      daysRemainingInclusive: 27
    })

    expect(allowance).toBe(566)
  })

  it("returns 0 once there are no days remaining", () => {
    expect(
      allowanceForDay({
        poolMinor: 1000,
        spentBeforeTodayMinor: 0,
        sweptBeforeTodayMinor: 0,
        daysRemainingInclusive: 0
      })
    ).toBe(0)
  })

  it("never goes negative when spend already exceeds the pool", () => {
    expect(
      allowanceForDay({
        poolMinor: 1000,
        spentBeforeTodayMinor: 5000,
        sweptBeforeTodayMinor: 0,
        daysRemainingInclusive: 5
      })
    ).toBe(0)
  })
})

describe("sweepMinor", () => {
  it("sweeps a percentage of the day's underspend", () => {
    expect(sweepMinor({ allowanceMinor: 600, spentTodayMinor: 400, sweepPct: 100 })).toBe(200)
    expect(sweepMinor({ allowanceMinor: 600, spentTodayMinor: 400, sweepPct: 50 })).toBe(100)
  })

  it("never sweeps a negative amount when the day overspent", () => {
    expect(sweepMinor({ allowanceMinor: 600, spentTodayMinor: 900, sweepPct: 100 })).toBe(0)
  })
})

describe("daysToAfford", () => {
  it("is 0 when the balance already covers the price", () => {
    expect(
      daysToAfford({ priceMinor: 1000, currentBalanceMinor: 1000, projectedDailySweepMinor: 50 })
    ).toBe(0)
  })

  it("rounds up the number of days at the current sweep rate", () => {
    expect(
      daysToAfford({ priceMinor: 1000, currentBalanceMinor: 100, projectedDailySweepMinor: 300 })
    ).toBe(3)
  })

  it("is null when the projected sweep can never reach the price", () => {
    expect(
      daysToAfford({ priceMinor: 1000, currentBalanceMinor: 0, projectedDailySweepMinor: 0 })
    ).toBeNull()
  })
})

describe("midRank", () => {
  it("splits the gap between two neighbors", () => {
    expect(midRank(1000, 2000)).toBe(1500)
  })

  it("places above the first item when there's no previous neighbor", () => {
    expect(midRank(null, 1000)).toBe(0)
  })

  it("places below the last item when there's no next neighbor", () => {
    expect(midRank(1000, null)).toBe(2000)
  })

  it("returns a default rank for an empty list", () => {
    expect(midRank(null, null)).toBe(1000)
  })
})

describe("needsRenormalize", () => {
  it("is false with plenty of room between neighbors", () => {
    expect(needsRenormalize(1000, 2000)).toBe(false)
  })

  it("is true once the gap collapses below the float-precision threshold", () => {
    expect(needsRenormalize(1.0000001, 1.0000002)).toBe(true)
  })

  it("is false when either neighbor is absent", () => {
    expect(needsRenormalize(null, 1000)).toBe(false)
    expect(needsRenormalize(1000, null)).toBe(false)
  })
})
