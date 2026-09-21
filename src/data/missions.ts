export interface MissionDef { id: string; name: string; desc: string; target: number; rewardCoins: number; rewardGems: number; rewardXp: number; }
export const MILESTONES: MissionDef[] = [
  { id:'m_merge20', name:'First Harvest', desc:'Merge 20 fruits (lifetime)', target:20, rewardCoins:150, rewardGems:0, rewardXp:40 },
  { id:'m_merge200', name:'Orchard Hand', desc:'Merge 200 fruits', target:200, rewardCoins:600, rewardGems:3, rewardXp:120 },
  { id:'m_merge1500', name:'Fruit Master', desc:'Merge 1,500 fruits', target:1500, rewardCoins:3000, rewardGems:15, rewardXp:400 },
  { id:'m_score10k', name:'Sweet Ten', desc:'Score 10,000 in one run', target:10000, rewardCoins:400, rewardGems:2, rewardXp:80 },
  { id:'m_score100k', name:'Century Jam', desc:'Score 100,000 in one run', target:100000, rewardCoins:2000, rewardGems:10, rewardXp:250 },
  { id:'m_chain5', name:'Chain Baker', desc:'Reach a 5-chain', target:5, rewardCoins:500, rewardGems:3, rewardXp:100 },
  { id:'m_perfect3', name:'Sharpshooter', desc:'Land 3 PERFECT merges (lifetime)', target:3, rewardCoins:450, rewardGems:2, rewardXp:90 },
  { id:'m_tier7', name:'Big Bloom', desc:'Create a Frost Melon or better', target:7, rewardCoins:1200, rewardGems:8, rewardXp:200 },
  { id:'m_tier10', name:'Beyond Aurora', desc:'Create a Solar Plum or better', target:10, rewardCoins:4000, rewardGems:20, rewardXp:500 },
  { id:'m_score1m', name:'Million Jam', desc:'Score 1,000,000 in one run', target:1000000, rewardCoins:8000, rewardGems:40, rewardXp:800 },
  { id:'m_coins5k', name:'Coin Hoarder', desc:'Earn 5,000 coins (lifetime)', target:5000, rewardCoins:500, rewardGems:4, rewardXp:120 },
  { id:'m_powerup', name:'Toolbelt', desc:'Use 3 power-ups', target:3, rewardCoins:300, rewardGems:1, rewardXp:60 },
  { id:'m_special', name:'Wild Grove', desc:'Trigger 5 special fruits', target:5, rewardCoins:700, rewardGems:4, rewardXp:130 },
  { id:'m_games10', name:'Regular', desc:'Play 10 runs', target:10, rewardCoins:400, rewardGems:2, rewardXp:80 },
];

export interface AchDef { id: string; name: string; desc: string; coins: number; gems: number; xp: number; }
export const ACHIEVEMENTS: AchDef[] = [
  { id:'first_merge', name:'First Merge', desc:'Merge two Seeds.', coins:50, gems:0, xp:20 },
  { id:'first_chain', name:'First Chain', desc:'Trigger a chain reaction.', coins:80, gems:0, xp:25 },
  { id:'big_fruit', name:'Big Fruit', desc:'Create a Cider Apple.', coins:200, gems:1, xp:50 },
  { id:'fruit_master', name:'Fruit Master', desc:'Create a Star Pineapple.', coins:1500, gems:10, xp:250 },
  { id:'mega_combo', name:'Mega Chain', desc:'Reach a 6-chain.', coins:600, gems:3, xp:120 },
  { id:'coin_hoarder', name:'Coin Hoarder', desc:'Hold 10,000 coins at once.', coins:0, gems:5, xp:150 },
  { id:'perfect_run', name:'Perfect Touch', desc:'Land a PERFECT merge.', coins:150, gems:1, xp:40 },
  { id:'no_powerups', name:'Purist', desc:'Score 20,000 without power-ups.', coins:500, gems:4, xp:120 },
  { id:'specialist', name:'Specialist', desc:'Trigger all 8 special fruits.', coins:1600, gems:12, xp:320 },
  { id:'solar_born', name:'Solar Born', desc:'Create a Solar Plum.', coins:2000, gems:12, xp:300 },
  { id:'massive_merge', name:'Massive Merge', desc:'Create a Worldseed.', coins:8000, gems:40, xp:1000 },
  { id:'frenzy', name:'Fruit Frenzy', desc:'Reach an 8-chain.', coins:1200, gems:8, xp:220 },
  { id:'marathon', name:'Marathoner', desc:'Survive 6 minutes in one run.', coins:700, gems:4, xp:140 },
  { id:'daily_dabbler', name:'Daily Dabbler', desc:'Finish a daily challenge.', coins:300, gems:2, xp:80 },
  { id:'shopper', name:'Shopper', desc:'Buy 5 shop items.', coins:250, gems:1, xp:60 },
  { id:'upgrader', name:'Upgrader', desc:'Own 5 upgrade levels.', coins:250, gems:1, xp:60 },
  { id:'collector', name:'Collector', desc:'Discover 12 fruit tiers.', coins:1200, gems:8, xp:260 },
];

export const DAILY_POOL: Array<{ id: string; name: string; desc: string; target: number; coins: number; xp: number }> = [
  { id:'d_merge', name:'Daily Harvest', desc:'Merge {t} fruits', target:30, coins:200, xp:50 },
  { id:'d_score', name:'Daily Jam', desc:'Score {t} points', target:8000, coins:200, xp:50 },
  { id:'d_chain', name:'Daily Rhythm', desc:'Reach a {t}-chain', target:3, coins:250, xp:60 },
  { id:'d_coins', name:'Daily Coins', desc:'Earn {t} coins', target:400, coins:150, xp:40 },
];
