import { describe, it, expect } from "vitest"
import { toMinor, fromMinor, formatMoney, currencyFractionDigits } from "./money"

describe("money helpers", () => {
  it("converts decimals to minor units for 2-decimal currencies", () => {
    expect(toMinor(12.5, "USD")).toBe(1250)
    expect(toMinor(0.01, "EUR")).toBe(1)
    expect(toMinor(1000, "USD")).toBe(100000)
  })

  it("treats zero-decimal currencies as whole units", () => {
    expect(currencyFractionDigits("JPY")).toBe(0)
    expect(toMinor(1500, "JPY")).toBe(1500)
    expect(fromMinor(1500, "JPY")).toBe(1500)
  })

  it("round-trips minor <-> major", () => {
    expect(fromMinor(toMinor(99.99, "USD"), "USD")).toBe(99.99)
  })

  it("avoids float drift on common values", () => {
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30)
  })

  it("formats with a currency symbol", () => {
    expect(formatMoney(1250, "USD")).toBe("$12.50")
  })

  it("falls back gracefully for unknown currency codes", () => {
    const out = formatMoney(1250, "ZZZ")
    expect(out).toContain("12.50")
    expect(out).toContain("ZZZ")
  })
})
