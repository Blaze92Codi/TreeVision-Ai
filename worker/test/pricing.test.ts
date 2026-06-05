import { describe, it, expect } from "vitest";
import { computePrices, bundleDiscountPct, computeEstimateTotal } from "../src/pricing";
import type { Analysis } from "../src/types";

// Minimal Analysis factory — only the fields computePrices reads matter here.
function analysis(over: Partial<Analysis> = {}): Analysis {
  return {
    is_tree: true,
    common_name: "White Oak",
    latin_name: "Quercus alba",
    est_height_ft: "45-55 ft",
    est_dbh_in: "18-22 in",
    crown_spread_ft: "30-40 ft",
    condition: "Good",
    isa_risk_rating: "Moderate",
    recommended_service: "Trimming & Pruning",
    recommended_pkg_key: "trim",
    ...over,
  };
}

describe("computePrices", () => {
  it("applies the height multiplier and rounds to the nearest $25", () => {
    // height 45 -> band [35,55) -> 1.4x ; Moderate risk -> 1.1x (removal only)
    const p = computePrices(analysis({ est_height_ft: "45-55 ft", isa_risk_rating: "Moderate" }));

    expect(p.trim).toMatchObject({ low: 200, high: 550 });       // 150/400 * 1.4
    expect(p.stump).toMatchObject({ low: 150, high: 425 });      // 100/300 * 1.4
    expect(p.treatment).toMatchObject({ low: 250, high: 625 });  // 175/450 * 1.4
    expect(p.removal).toMatchObject({ low: 625, high: 1850 });   // 400/1200 * 1.4 * 1.1
  });

  it("applies the risk multiplier ONLY to removal", () => {
    const low = computePrices(analysis({ est_height_ft: "45 ft", isa_risk_rating: "Low" }));
    const extreme = computePrices(analysis({ est_height_ft: "45 ft", isa_risk_rating: "Extreme" }));

    // Non-removal packages are identical regardless of risk rating.
    expect(extreme.trim).toEqual(low.trim);
    expect(extreme.stump).toEqual(low.stump);
    expect(extreme.treatment).toEqual(low.treatment);
    // Removal scales up with Extreme (1.5x) vs Low (1.0x).
    expect(extreme.removal.low).toBeGreaterThan(low.removal.low);
    expect(extreme.removal.high).toBeGreaterThan(low.removal.high);
  });

  it("defaults to a 30ft (1.0x) height when est_height_ft has no number", () => {
    const p = computePrices(analysis({ est_height_ft: "", isa_risk_rating: "Low" }));
    // 1.0x height, 1.0x risk -> base prices unchanged.
    expect(p.trim).toMatchObject({ low: 150, high: 400 });
    expect(p.removal).toMatchObject({ low: 400, high: 1200 });
  });

  it("treats an unknown risk rating as 1.0x", () => {
    const p = computePrices(analysis({ est_height_ft: "30 ft", isa_risk_rating: "Bogus" as any }));
    expect(p.removal).toMatchObject({ low: 400, high: 1200 });
  });

  it("honours the height bands at their boundaries", () => {
    // <20 -> 0.7x
    expect(computePrices(analysis({ est_height_ft: "15 ft", isa_risk_rating: "Low" })).trim.low)
      .toBe(100); // round25(150 * 0.7 = 105) -> 100
    // 80+ -> 2.4x
    expect(computePrices(analysis({ est_height_ft: "90 ft", isa_risk_rating: "Low" })).trim.high)
      .toBe(950); // round25(400 * 2.4 = 960) -> 950
  });
});

describe("bundleDiscountPct", () => {
  it("returns 0% for 0 or 1 tree", () => {
    expect(bundleDiscountPct(0)).toBe(0);
    expect(bundleDiscountPct(1)).toBe(0);
  });
  it("returns 5% at 2 trees and 10% at 3+", () => {
    expect(bundleDiscountPct(2)).toBe(5);
    expect(bundleDiscountPct(3)).toBe(10);
    expect(bundleDiscountPct(7)).toBe(10);
  });
});

describe("computeEstimateTotal", () => {
  it("sums a single tree with no discount", () => {
    const t = computeEstimateTotal([{ quote_low: 200, quote_high: 550 }]);
    expect(t).toEqual({
      subtotal_low: 200,
      subtotal_high: 550,
      discount_pct: 0,
      total_low: 200,
      total_high: 550,
    });
  });

  it("applies the 5% bundle discount for two priced trees", () => {
    const t = computeEstimateTotal([
      { quote_low: 200, quote_high: 550 },
      { quote_low: 625, quote_high: 1850 },
    ]);
    expect(t.subtotal_low).toBe(825);
    expect(t.subtotal_high).toBe(2400);
    expect(t.discount_pct).toBe(5);
    expect(t.total_low).toBe(775);   // round25(825 * 0.95 = 783.75)
    expect(t.total_high).toBe(2275); // round25(2400 * 0.95 = 2280)
  });

  it("excludes trees with null quotes from both the subtotal and the tree count", () => {
    const t = computeEstimateTotal([
      { quote_low: 200, quote_high: 550 },
      { quote_low: null, quote_high: null },
    ]);
    // Only one priced tree -> no bundle discount, unpriced tree ignored.
    expect(t.subtotal_low).toBe(200);
    expect(t.subtotal_high).toBe(550);
    expect(t.discount_pct).toBe(0);
  });

  it("handles an empty estimate", () => {
    expect(computeEstimateTotal([])).toEqual({
      subtotal_low: 0,
      subtotal_high: 0,
      discount_pct: 0,
      total_low: 0,
      total_high: 0,
    });
  });
});
