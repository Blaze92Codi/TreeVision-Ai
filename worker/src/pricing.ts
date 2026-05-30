import type { Analysis, PkgKey, PriceTable } from "./types";

const BASE: Record<PkgKey, { name: string; icon: string; low: number; high: number }> = {
  trim:      { name: "Trimming & Pruning", icon: "✂️",  low: 150, high: 400  },
  removal:   { name: "Full Tree Removal",  icon: "🪓",  low: 400, high: 1200 },
  stump:     { name: "Stump Grinding",     icon: "🪨",  low: 100, high: 300  },
  treatment: { name: "Health & Treatment", icon: "💉",  low: 175, high: 450  },
};

const RISK_MULT: Record<string, number> = {
  Low: 1.0, Moderate: 1.1, High: 1.25, Extreme: 1.5,
};

function heightMultiplier(estHeightFt: string): number {
  const m = (estHeightFt || "").match(/(\d+)/);
  const h = m ? parseInt(m[1], 10) : 30;
  if (h < 20) return 0.7;
  if (h < 35) return 1.0;
  if (h < 55) return 1.4;
  if (h < 80) return 1.9;
  return 2.4;
}

function round25(n: number): number {
  return Math.round(n / 25) * 25;
}

export function computePrices(analysis: Analysis): PriceTable {
  const hMult = heightMultiplier(analysis.est_height_ft);
  const rMult = RISK_MULT[analysis.isa_risk_rating] ?? 1.0;
  const out = {} as PriceTable;
  for (const key of Object.keys(BASE) as PkgKey[]) {
    const b = BASE[key];
    const mult = hMult * (key === "removal" ? rMult : 1.0);
    out[key] = { name: b.name, icon: b.icon, low: round25(b.low * mult), high: round25(b.high * mult) };
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// Bundle discounts — apply when multiple trees in one estimate.
// Edit thresholds here; no DB migration needed.
// ────────────────────────────────────────────────────────────
const BUNDLE_TIERS: Array<{ minTrees: number; pct: number }> = [
  { minTrees: 3, pct: 10 },
  { minTrees: 2, pct: 5 },
];

export function bundleDiscountPct(treeCount: number): number {
  for (const tier of BUNDLE_TIERS) {
    if (treeCount >= tier.minTrees) return tier.pct;
  }
  return 0;
}

export function computeEstimateTotal(trees: Array<{ quote_low: number | null; quote_high: number | null }>): {
  subtotal_low: number;
  subtotal_high: number;
  discount_pct: number;
  total_low: number;
  total_high: number;
} {
  const priced = trees.filter(t => t.quote_low != null && t.quote_high != null);
  const subtotal_low  = priced.reduce((s, t) => s + (t.quote_low  ?? 0), 0);
  const subtotal_high = priced.reduce((s, t) => s + (t.quote_high ?? 0), 0);
  const discount_pct = bundleDiscountPct(priced.length);
  const total_low  = round25(subtotal_low  * (1 - discount_pct / 100));
  const total_high = round25(subtotal_high * (1 - discount_pct / 100));
  return { subtotal_low, subtotal_high, discount_pct, total_low, total_high };
}
