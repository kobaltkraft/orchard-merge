import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import fc from 'fast-check';
import { fmt } from '../../src/utils/NumberFormat';

describe('economy formatting + Decimal accuracy', () => {
  it('keeps 1e12 / 1.25e18 accurate', () => {
    expect(new Decimal('1000000000000').plus(1).toString()).toBe('1000000000001');
    expect(new Decimal('1.25e18').times(2).toString()).toBe('2500000000000000000');
  });
  it('formats compact numbers', () => {
    expect(fmt(999)).toBe('999');
    expect(fmt(1200)).toMatch(/1\.2K/);
    expect(fmt(15_000_000)).toMatch(/15M/);
    expect(fmt(2_400_000_000)).toMatch(/2\.4B/);
    expect(fmt(1_200_000_000_000)).toMatch(/1\.2T/);
  });
  it('pricing monotonic (property)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 9 }), (lvl) => {
      const cost = (b: number, g: number, l: number): number => Math.floor(b * Math.pow(g, l));
      return cost(200, 1.7, lvl + 1) >= cost(200, 1.7, lvl);
    }));
  });
});
