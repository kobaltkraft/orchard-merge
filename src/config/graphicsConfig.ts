export const RARITY_COLORS: Record<string, number> = {
  common: 0x7bc96f, uncommon: 0x5aa7e8, rare: 0xb678e8, epic: 0xf5a94b, legendary: 0xe84f6f, mythic: 0xe8d45f,
};
export const THEMES = [
  { id:'garden', name:'Fruit Garden', bg0:'#0e1f16', bg1:'#1d3a2a', accent:0x7bc96f, price:0, cur:'coins' },
  { id:'kitchen', name:'Candy Kitchen', bg0:'#241422', bg1:'#4a2440', accent:0xf57ab8, price:800, cur:'coins' },
  { id:'market', name:'Tropical Market', bg0:'#12241f', bg1:'#1f5f4a', accent:0x5fd6a8, price:1500, cur:'coins' },
  { id:'night', name:'Night Orchard', bg0:'#0a0e24', bg1:'#232a5f', accent:0x8f9eff, price:2500, cur:'coins' },
  { id:'neon', name:'Neon Fruit Lab', bg0:'#0d0716', bg1:'#2a1040', accent:0x00f0d0, price:25, cur:'gems' },
  { id:'cosmic', name:'Cosmic Orchard', bg0:'#080a1a', bg1:'#2a1a4a', accent:0xb678e8, price:40, cur:'gems' },
  { id:'winter', name:'Winter Market', bg0:'#0e1a24', bg1:'#2a4a5f', accent:0xbfeaff, price:2000, cur:'coins' },
] as const;
