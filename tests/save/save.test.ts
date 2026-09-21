import { describe, it, expect } from 'vitest';
import { SaveSchema, repairSave, defaultSave } from '../../src/persistence/SaveSchema';
import { rngFrom, dailySeed, pickWeighted } from '../../src/utils/Random';

describe('save validation + rotation determinism', () => {
  it('rejects garbage, repairs to defaults without crashing', () => {
    expect(() => repairSave({ garbage: true })).not.toThrow();
    const s = repairSave({ garbage: true });
    expect(s.version).toBe(1);
    expect(SaveSchema.safeParse(repairSave(null)).success).toBe(true);
    expect(defaultSave().coins).toBe('0');
  });
  it('preserves valid fields, fixes invalid ones', () => {
    const s = repairSave({ version: 1, coins: '123', level: 'oops', settings: { sound: true } });
    expect(s.coins).toBe('123');
    expect(typeof s.level).toBe('number');
  });
  it('same date => same shop rotation pick', () => {
    const pick = (seed: string): string => {
      const rng = rngFrom(seed);
      return pickWeighted(rng, ['a', 'b', 'c', 'd'], [1, 1, 1, 1]);
    };
    const day = dailySeed(new Date(2026, 8, 21));
    expect(pick(`grove-${day}`).length).toBeGreaterThan(0);
    expect(pick('grove-test')).toBe(pick('grove-test'));
  });
});
