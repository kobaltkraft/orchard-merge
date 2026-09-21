import seedrandom from 'seedrandom';
export function rngFrom(seed: string) { return seedrandom(seed); }
export function pickWeighted<T>(rng: () => number, items: T[], weights: number[]): T {
  let total = 0; for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
export function dailySeed(d = new Date()): string {
  return `grove-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
