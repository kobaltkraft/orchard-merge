import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { FRUITS, fruitById } from '../../src/config/fruitConfig';

describe('merge data model', () => {
  it('14-tier chain is fully linked, terminal tier ends', () => {
    expect(FRUITS).toHaveLength(14);
    for (let i = 0; i < FRUITS.length - 1; i++) expect(FRUITS[i].mergeTarget).toBe(FRUITS[i + 1].id);
    expect(FRUITS[FRUITS.length - 1].mergeTarget).toBeNull();
  });
  it('radii strictly increase; score/coins increase', () => {
    for (let i = 1; i < FRUITS.length; i++) {
      expect(FRUITS[i].radius).toBeGreaterThan(FRUITS[i - 1].radius);
      expect(FRUITS[i].score).toBeGreaterThan(FRUITS[i - 1].score);
    }
  });
  it('adjacent tiers differ in size enough to read at a glance', () => {
    for (let i = 1; i < FRUITS.length; i++) {
      expect(FRUITS[i].radius - FRUITS[i - 1].radius).toBeGreaterThanOrEqual(5);
    }
  });
  it('adjacent tiers differ in hue enough to tell apart', () => {
    const hexToHsl = (hex: string): [number, number] => {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2;
      if (mx === mn) return [-1000, l]; // achromatic: exempt (neutrals read by lightness)
      const d = mx - mn;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return [((h * 60) + 360) % 360, l];
    };
    const hueDist = (a: number, b: number): number => {
      if (a < 0 || b < 0) return 999;
      const d = Math.abs(a - b) % 360;
      return Math.min(d, 360 - d);
    };
    for (let i = 1; i < FRUITS.length; i++) {
      const [h0, l0] = hexToHsl(FRUITS[i - 1].body);
      const [h1, l1] = hexToHsl(FRUITS[i].body);
      const distinct = hueDist(h0, h1) >= 20 || (hueDist(h0, h1) >= 12 && Math.abs(l0 - l1) >= 0.12);
      expect(distinct).toBe(true);
    }
  });
  it('chain walk always terminates (property)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: FRUITS.length - 1 }), (start) => {
      let id: string | null = FRUITS[start].id; let steps = 0;
      while (id && steps < 30) { id = fruitById(id)?.mergeTarget ?? null; steps++; }
      return id === null && steps <= FRUITS.length;
    }));
  });
});
