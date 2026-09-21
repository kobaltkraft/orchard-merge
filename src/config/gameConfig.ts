export const SAVE_VERSION = 1;
export const GAME_ID = 'orchard-merge-pocket-grove';

export const gameConfig = {
  width: 480,
  height: 800,
  container: { x: 40, top: 146, width: 400, height: 556, wall: 14 },
  dangerY: 222,
  dangerGraceSec: 3.0,
  dropCooldownMs: 550,
  maxBodies: 120,
  fixedStepHz: 60,
} as const;

export type GameModeId = 'classic' | 'time' | 'chill' | 'chaos' | 'hardcore' | 'daily' | 'fountain';
