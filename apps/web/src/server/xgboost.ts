/**
 * Minimal XGBoost gbtree evaluator for the compact boosters written by
 * scripts/export_web_data.py. Matches xgboost's predict(): features and split
 * thresholds are compared as float32, missing values follow default_left.
 */

export interface CompactTree {
  l: number[];
  r: number[];
  f: number[];
  t: number[];
  d: number[];
}

export interface CompactBooster {
  objective: string;
  base_margin: number;
  trees: CompactTree[];
}

const f32 = Math.fround;

function leafValue(tree: CompactTree, x: Float32Array): number {
  let node = 0;
  while (tree.l[node] !== -1) {
    const v = x[tree.f[node]];
    if (Number.isNaN(v)) node = tree.d[node] ? tree.l[node] : tree.r[node];
    else node = v < f32(tree.t[node]) ? tree.l[node] : tree.r[node];
  }
  return tree.t[node];
}

export function margin(booster: CompactBooster, row: number[]): number {
  const x = Float32Array.from(row, v => (v === null || v === undefined ? NaN : v));
  let sum = booster.base_margin;
  for (const tree of booster.trees) sum += leafValue(tree, x);
  return f32(sum);
}

/** Regression output, or P(class 1) for a binary:logistic classifier. */
export function predict(booster: CompactBooster, row: number[]): number {
  const m = margin(booster, row);
  if (booster.objective.startsWith("binary:logistic") || booster.objective === "reg:logistic") {
    return 1 / (1 + Math.exp(-m));
  }
  return m;
}
