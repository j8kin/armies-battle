export interface PenaltyConfig {
  regular: { minPct: number; maxPct: number; minAbs: number; maxAbs: number };
  veteran: { minPct: number; maxPct: number; minAbs: number; maxAbs: number };
  elite: { minPct: number; maxPct: number; minAbs: number; maxAbs: number };
}
