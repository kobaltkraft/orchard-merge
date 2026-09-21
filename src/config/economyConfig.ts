export const economyConfig = {
  coinScoreRate: 0.02, // coins per score point (before multipliers)
  gemEveryScore: 50000, // auto-trickle safety
  mergeCoinBase: [1,2,4,8,15,30,60,140,320,900,2200,5500,13000,30000],
  comboMultiplierPerChain: 0.5,
  perfectBonus: { perfect: 2.0, great: 1.5 },
  xpPerMerge: [5,6,8,12,18,28,45,70,110,200,300,450,650,1000],
  levelCoins: (lvl: number) => 100 + lvl * 75,
  doubleCoinsDurationSec: 120,
} as const;

export const upgradeDefs = [
  { id:'drop_speed', name:'Swift Hands', desc:'+8% drop speed per level', max:8, base:150, growth:1.65 },
  { id:'luck', name:'Orchard Luck', desc:'Better big-fruit odds + special chance', max:10, base:120, growth:1.6 },
  { id:'coin_mult', name:'Golden Touch', desc:'+10% coins per level', max:10, base:200, growth:1.7 },
  { id:'merge_value', name:'Rich Harvest', desc:'+12% merge score per level', max:10, base:220, growth:1.75 },
  { id:'combo_window', name:'Long Rhythm', desc:'+0.4s combo window per level', max:5, base:300, growth:1.8 },
  { id:'special_chance', name:'Wild Seeds', desc:'+0.4% special fruit chance', max:8, base:350, growth:1.8 },
  { id:'safe_height', name:'Tall Jar', desc:'Raises danger line tolerance', max:5, base:400, growth:2.0 },
  { id:'preview', name:'Far Sight', desc:'See +1/+2 next fruits', max:2, base:500, growth:2.2 },
] as const;
