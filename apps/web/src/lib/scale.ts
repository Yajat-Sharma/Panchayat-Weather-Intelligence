import type { VarKey } from "./api";

/**
 * Single-hue sequential ramps (light -> dark = low -> high), quantised into 7 classes.
 * Blue is the reference sequential ramp; temperature takes an orange ramp so warm reads warm.
 */
const BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const ORANGE = ["#fde3c8", "#fbc690", "#f8a35a", "#ee7f2d", "#cf6219", "#a24a12", "#72330c"];

export const RAMP: Record<VarKey, string[]> = {
  rainfall: BLUE, rh: BLUE, wind: BLUE, tmax: ORANGE, tmin: ORANGE,
};

export interface Quantized {
  domain: [number, number];
  breaks: number[]; // class lower edges, length = colors.length
  colors: string[];
  color: (v: number) => string;
}

/** Equal-interval classes over [min, max] of the values shown (coarse and downscaled together, so both views share a legend). */
export function quantize(variable: VarKey, values: number[]): Quantized | null {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (variable === "rainfall") lo = 0;
  if (hi - lo < 1e-6) hi = lo + 1;
  const colors = RAMP[variable];
  const n = colors.length;
  const step = (hi - lo) / n;
  const breaks = colors.map((_, i) => lo + i * step);
  return {
    domain: [lo, hi],
    breaks,
    colors,
    color: v => colors[Math.min(n - 1, Math.max(0, Math.floor((v - lo) / step)))],
  };
}
