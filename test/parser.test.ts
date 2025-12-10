import { describe, it, expect } from "bun:test";
import { parseBalance } from "@/utils/parser";

describe("parseBalance", () => {
  it("parses rupee formats", () => {
    expect(parseBalance("Remaining Balance: Rs. 1,234")).toBe(1234);
    expect(parseBalance("remaining balance: -1,234")).toBe(-1234);
    expect(parseBalance("Rs. 1000")).toBe(1000);
    expect(parseBalance("No money here")).toBe(null);
  });
});
