import { describe, it, expect } from "vitest";
import { parseBalance } from "../src/utils/parser";

describe("parseBalance", () => {
  it("parses rupee formats", () => {
    expect(parseBalance("Remaining Balance: Rs. 1,234")).toBe(1234);
    expect(parseBalance("remaining balance: -1,234")).toBe(-1234);
    expect(parseBalance("Rs. 1000")).toBe(1000);
    expect(parseBalance("No money here")).toBe(null);
  });

  it("handles decimal values", () => {
    expect(parseBalance("Balance: 1234.56")).toBe(1234.56);
    expect(parseBalance("Rs. 0.50")).toBe(0.5);
  });

  it("handles zero balance", () => {
    expect(parseBalance("Remaining Balance: 0")).toBe(0);
    expect(parseBalance("Current Balance: Rs. 0.00")).toBe(0);
  });

  it("handles no match with numbers present but no prefix", () => {
    expect(parseBalance("The year is 2024")).toBe(null);
  });

  it("handles multiple commas", () => {
    expect(parseBalance("Balance: 1,00,00,000")).toBe(10000000);
  });

  it("handles negative values with RS prefix", () => {
    expect(parseBalance("Rs. -1,234")).toBe(-1234);
  });
});
