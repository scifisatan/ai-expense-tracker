import { describe, it, expect } from "vitest";
import { money, pct } from "../src/web/helper";

describe("web helpers", () => {
  describe("money", () => {
    it("formats positive numbers in Indian Rupee format", () => {
      expect(money(1000)).toBe("Rs. 1,000.00");
      expect(money(123456.78)).toBe("Rs. 1,23,456.78");
    });

    it("formats negative numbers (absolute value with sign prefix usually handled by UI)", () => {
      // The current implementation uses Math.abs(v)
      expect(money(-500)).toBe("Rs. 500.00");
    });

    it("handles zero", () => {
      expect(money(0)).toBe("Rs. 0.00");
    });
  });

  describe("pct", () => {
    it("calculates percentage correctly", () => {
      expect(pct(50, 200)).toBe(25);
      expect(pct(1, 3)).toBe(33);
    });

    it("returns 0 when total is 0", () => {
      expect(pct(10, 0)).toBe(0);
    });

    it("handles zero part", () => {
      expect(pct(0, 100)).toBe(0);
    });
  });
});
