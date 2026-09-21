import { createStore } from 'zustand/vanilla';
import type { SaveData } from '../persistence/SaveSchema';
import { defaultSave } from '../persistence/SaveSchema';
import { persistDebounced } from '../persistence/SaveManager';
import Decimal from 'decimal.js';

interface MetaState extends SaveData {
  ready: boolean;
  hydrate: (s: SaveData) => void;
  addCoins: (n: string | number) => void;
  spendCoins: (n: string | number) => boolean;
  addGems: (n: number) => void;
  spendGems: (n: number) => boolean;
  addXp: (n: number) => { leveled: boolean };
  setUpgrade: (id: string, lvl: number) => void;
  setSetting: <K extends keyof SaveData['settings']>(k: K, v: SaveData['settings'][K]) => void;
  bump: (fn: (s: SaveData) => Partial<SaveData>) => void;
}

function snapshot(s: MetaState): SaveData {
  return {
    version: 1, coins: s.coins, gems: s.gems, xp: s.xp, level: s.level,
    upgrades: s.upgrades, unlockedFruits: s.unlockedFruits, ownedCosmetics: s.ownedCosmetics,
    equipped: s.equipped, powerups: s.powerups, boosts: s.boosts, missions: s.missions,
    achievements: s.achievements, stats: s.stats, settings: s.settings, daily: s.daily, seen: s.seen,
  };
}

export const useMeta = createStore<MetaState>()((set, get) => ({
  ...defaultSave(), ready: false,
  hydrate: (s) => set({ ...s, ready: true }),
  addCoins: (n) => {
    const st = get();
    const v = new Decimal(st.coins).plus(new Decimal(n)).toString();
    const earn = new Decimal(st.stats.coinsEarned).plus(new Decimal(n)).toString();
    const next = { coins: v, stats: { ...st.stats, coinsEarned: earn } };
    set(next);
    persistDebounced(snapshot({ ...get(), ...next } as MetaState));
  },
  spendCoins: (n) => {
    const st = get();
    if (new Decimal(st.coins).lt(n)) return false;
    const v = new Decimal(st.coins).minus(new Decimal(n)).toString();
    set({ coins: v });
    persistDebounced(snapshot({ ...st, coins: v } as MetaState));
    return true;
  },
  addGems: (n) => {
    const st = get();
    const v = new Decimal(st.gems).plus(n).toString();
    set({ gems: v, stats: { ...st.stats, gemsEarned: new Decimal(st.stats.gemsEarned).plus(n).toString() } });
    persistDebounced(snapshot(get() as MetaState));
  },
  spendGems: (n) => {
    const st = get();
    if (new Decimal(st.gems).lt(n)) return false;
    set({ gems: new Decimal(st.gems).minus(n).toString() });
    persistDebounced(snapshot(get() as MetaState));
    return true;
  },
  addXp: (n) => {
    const st = get();
    let xp = st.xp + n; let lvl = st.level; let leveled = false;
    const need = (l: number) => 100 + (l - 1) * 120;
    while (xp >= need(lvl)) { xp -= need(lvl); lvl++; leveled = true; }
    set({ xp, level: lvl });
    persistDebounced(snapshot(get() as MetaState));
    return { leveled };
  },
  setUpgrade: (id, lvl) => { const st = get(); set({ upgrades: { ...st.upgrades, [id]: lvl } }); persistDebounced(snapshot(get() as MetaState)); },
  setSetting: (k, v) => { const st = get(); set({ settings: { ...st.settings, [k]: v } }); persistDebounced(snapshot(get() as MetaState)); },
  bump: (fn) => { set(fn(get() as SaveData) as Partial<MetaState>); persistDebounced(snapshot(get() as MetaState)); },
}));

// Selectors helpers (Decimal-safe multipliers)
export function coinMult(s: SaveData): number {
  return 1 + (s.upgrades['coin_mult'] ?? 0) * 0.10 + (s.boosts['coins25'] ? 0.25 : 0);
}
export function scoreMult(s: SaveData): number {
  return 1 + (s.upgrades['merge_value'] ?? 0) * 0.12 + (s.boosts['score50'] ? 0.5 : 0);
}
export function specialChance(s: SaveData): number {
  return 0.012 + (s.upgrades['special_chance'] ?? 0) * 0.004 + (s.boosts['luck'] ? 0.01 : 0);
}
