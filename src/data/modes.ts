import type { GameModeId } from '../config/gameConfig';
export interface ModeDef { id: GameModeId; name: string; desc: string; timeLimit?: number; gravityMul: number; specialMul: number; widthMul: number; poolCap: number; scoreMul: number; accent: number; icon: string; difficulty: string; }
export const MODES: ModeDef[] = [
  { id:'classic', name:'Classic', desc:'Merge fruit, build combos, and chase a new high score.', gravityMul:1, specialMul:1, widthMul:1, poolCap:5, scoreMul:1, accent:0x7bc96f, icon:'🍎', difficulty:'Normal' },
  { id:'time', name:'Time Attack', desc:'Score as much as possible before 90 seconds runs out.', timeLimit:90, gravityMul:1, specialMul:1.2, widthMul:1, poolCap:5, scoreMul:1.2, accent:0xf5a94b, icon:'⏱️', difficulty:'Fast' },
  { id:'chill', name:'Chill Grove', desc:'Relax, experiment, and merge without a danger line.', gravityMul:0.8, specialMul:1, widthMul:1.1, poolCap:6, scoreMul:0.7, accent:0x5aa7e8, icon:'🌸', difficulty:'Relaxed' },
  { id:'chaos', name:'Chaos Jar', desc:'Wild physics and unpredictable special fruit.', gravityMul:1.05, specialMul:3.2, widthMul:1, poolCap:6, scoreMul:1.3, accent:0xb678e8, icon:'🎲', difficulty:'Unpredictable' },
  { id:'hardcore', name:'Hardcore', desc:'A narrow jar, heavier gravity, and no second chances.', gravityMul:1.25, specialMul:0.7, widthMul:0.82, poolCap:4, scoreMul:1.6, accent:0xe84f4f, icon:'⚠️', difficulty:'Extreme' },
  { id:'daily', name:'Daily Challenge', desc:'Seeded run. One per day.', gravityMul:1, specialMul:1.5, widthMul:1, poolCap:5, scoreMul:1.25, accent:0xe8c832, icon:'📅', difficulty:'Daily' },
  { id:'fountain', name:'Lucky Fountain', desc:'Special fruits rain. Glorious chaos.', gravityMul:1, specialMul:6, widthMul:1, poolCap:6, scoreMul:1.1, accent:0xe85f9e, icon:'⛲', difficulty:'Wild' },
];
