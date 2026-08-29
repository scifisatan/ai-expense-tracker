import { describe, it, expect } from "vitest"
import {
  localDateString,
  monthRange,
  normalizeBackdate,
  resolvePeriod,
  toDbTimestamp,
  dayRange,
  startOfLocalDay,
  addDays,
  daysBetweenLocalDates,
  parseDbTimestamp
} from "./datetime"

describe("datetime", () => {
  it("formats UTC instants in the DB's space-separated shape", () => {
    expect(toDbTimestamp(new Date("2026-06-20T13:45:09.000Z"))).toBe("2026-06-20 13:45:09")
  })

  it("reports the local calendar date for a timezone", () => {
    // 2026-06-20 23:30 UTC is already 2026-06-21 in Kathmandu (+05:45).
    const now = new Date("2026-06-20T23:30:00Z")
    expect(localDateString("Asia/Kathmandu", now)).toBe("2026-06-21")
    expect(localDateString("America/Los_Angeles", now)).toBe("2026-06-20")
  })

  it("anchors a bare backdate at local noon and rejects the future", () => {
    const now = new Date("2026-06-20T12:00:00Z")
    // Local noon in LA (UTC-7 in June) → 19:00 UTC.
    expect(normalizeBackdate("2026-06-19", "America/Los_Angeles", now)).toBe("2026-06-19 19:00:00")
    expect(normalizeBackdate("2030-01-01", "UTC", now)).toBeNull()
    expect(normalizeBackdate("not-a-date", "UTC", now)).toBeNull()
  })

  it("buckets a backdate into the correct local month for any offset", () => {
    const now = new Date("2026-06-15T12:00:00Z")
    for (const tz of ["America/Los_Angeles", "UTC", "Asia/Kathmandu", "Australia/Sydney"]) {
      const stored = normalizeBackdate("2026-06-01", tz, now)!
      const range = monthRange(tz, now)
      expect(stored >= range.from && stored < range.to).toBe(true)
    }
  })

  it("month boundaries are a half-open range", () => {
    const range = monthRange("UTC", new Date("2026-06-15T00:00:00Z"))
    expect(range.from).toBe("2026-06-01 00:00:00")
    expect(range.to).toBe("2026-07-01 00:00:00")
  })

  it("resolvePeriod honors custom ranges and falls back to the month", () => {
    const now = new Date("2026-06-15T00:00:00Z")
    const custom = resolvePeriod(
      { period: "custom", from: "2026-01-01", to: "2026-02-01" },
      "UTC",
      now
    )
    expect(custom.from <= "2026-01-01 12:00:00").toBe(true)
    expect(custom.to <= "2026-02-01 12:00:00").toBe(true)

    const fallback = resolvePeriod({ period: "custom" }, "UTC", now)
    expect(fallback.from).toBe("2026-06-01 00:00:00")
  })

  it("day boundaries are a half-open range in the local timezone", () => {
    // 2026-06-20 23:30 UTC is already 2026-06-21 00:15 in Kathmandu.
    const now = new Date("2026-06-20T23:30:00Z")
    const range = dayRange("Asia/Kathmandu", now)
    expect(range.from).toBe("2026-06-20 18:15:00")
    expect(range.to).toBe("2026-06-21 18:15:00")
  })

  it("gives local midnight for startOfLocalDay", () => {
    expect(startOfLocalDay("UTC", "2026-06-20")).toBe("2026-06-20 00:00:00")
    expect(startOfLocalDay("Asia/Kathmandu", "2026-06-20")).toBe("2026-06-19 18:15:00")
  })

  it("addDays shifts forward and backward across month/DST-agnostic boundaries", () => {
    expect(addDays("UTC", "2026-06-20", 1)).toBe("2026-06-21")
    expect(addDays("UTC", "2026-06-20", -20)).toBe("2026-05-31")
    expect(addDays("Asia/Kathmandu", "2026-06-20", -1)).toBe("2026-06-19")
  })

  it("daysBetweenLocalDates counts whole calendar days, exclusive of the end", () => {
    expect(daysBetweenLocalDates("2026-06-01", "2026-06-01")).toBe(0)
    expect(daysBetweenLocalDates("2026-06-01", "2026-07-01")).toBe(30)
    expect(daysBetweenLocalDates("2026-06-15", "2026-06-01")).toBe(-14)
  })

  it("parseDbTimestamp round-trips toDbTimestamp", () => {
    const original = new Date("2026-06-20T13:45:09.000Z")
    expect(parseDbTimestamp(toDbTimestamp(original)).getTime()).toBe(original.getTime())
  })
})
