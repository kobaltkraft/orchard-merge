import { z } from 'zod';

export const SaveSchema = z.object({
  version: z.literal(1),
  coins: z.string().default('0'),
  gems: z.string().default('0'),
  xp: z.number().default(0),
  level: z.number().default(1),
  upgrades: z.record(z.string(), z.number()).default({}),
  unlockedFruits: z.array(z.string()).default(['seed','sproutpea','dewberry']),
  ownedCosmetics: z.array(z.string()).default(['garden']),
  equipped: z.object({ theme: z.string().default('garden'), trail: z.string().default('none'), mergeFx: z.string().default('classic') }).default({ theme:'garden', trail:'none', mergeFx:'classic' }),
  powerups: z.record(z.string(), z.number()).default({}),
  boosts: z.record(z.string(), z.number()).default({}),
  missions: z.object({ daily: z.array(z.object({ id: z.string(), progress: z.number(), done: z.boolean(), claimed: z.boolean(), day: z.string() })).default([]), milestones: z.record(z.string(), z.number()).default({}) }).default({ daily: [], milestones: {} }),
  achievements: z.record(z.string(), z.boolean()).default({}),
  stats: z.object({
    games: z.number().default(0), merges: z.number().default(0), dropped: z.number().default(0),
    bestScore: z.number().default(0), bestCombo: z.number().default(0), bestTier: z.number().default(0),
    coinsEarned: z.string().default('0'), gemsEarned: z.string().default('0'),
    playSec: z.number().default(0), perfects: z.number().default(0), specials: z.number().default(0), powerupsUsed: z.number().default(0),
    perFruitMerges: z.record(z.string(), z.number()).default({}),
    bestByMode: z.record(z.string(), z.number()).default({}),
    specialsSeen: z.array(z.string()).default([]),
    streak: z.object({ count: z.number().default(0), lastDay: z.string().default('') }).default({ count:0, lastDay:'' }),
  }).default({ games:0, merges:0, dropped:0, bestScore:0, bestCombo:0, bestTier:0, coinsEarned:'0', gemsEarned:'0', playSec:0, perfects:0, specials:0, powerupsUsed:0, perFruitMerges:{}, bestByMode:{}, specialsSeen:[], streak:{ count:0, lastDay:'' } }),
  settings: z.object({ sound: z.boolean().default(true), music: z.boolean().default(true), haptics: z.boolean().default(true), reducedMotion: z.boolean().default(false), colorSafe: z.boolean().default(false), quality: z.enum(['low','medium','high','ultra']).default('high'), joystick: z.boolean().default(false), assist: z.boolean().default(true), screenShake: z.boolean().default(true), screenFlash: z.boolean().default(true), masterVol: z.number().default(0.8), musicVol: z.number().default(0.32), sfxVol: z.number().default(0.9), ambience: z.boolean().default(true), muted: z.boolean().default(false) }).default({ sound:true, music:true, haptics:true, reducedMotion:false, colorSafe:false, quality:'high', joystick:false, assist:true, screenShake:true, screenFlash:true, masterVol:0.8, musicVol:0.32, sfxVol:0.9, ambience:true, muted:false }),
  daily: z.object({ day: z.string().default(''), score: z.number().default(0), played: z.boolean().default(false) }).default({ day:'', score:0, played:false }),
  seen: z.object({ tutorial: z.boolean().default(false) }).default({ tutorial:false }),
});

export type SaveData = z.infer<typeof SaveSchema>;
export function defaultSave(): SaveData {
  return SaveSchema.parse({ version: 1 });
}
export function repairSave(raw: unknown): SaveData {
  try {
    const direct = SaveSchema.safeParse(raw);
    if (direct.success) return direct.data;
    // field-by-field repair: preserve every valid field, fix the rest
    const def = defaultSave();
    if (typeof raw !== 'object' || raw === null) return def;
    const r = raw as Record<string, unknown>;
    const out: Record<string, unknown> = { ...def, version: 1 };
    const shape = (SaveSchema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
    for (const key of Object.keys(def) as Array<keyof SaveData>) {
      if (!(key in r)) continue;
      try {
        const res = shape[key].safeParse((r as Record<string, unknown>)[key as string]);
        if (res.success) (out as Record<string, unknown>)[key as string] = res.data;
      } catch { /* keep default for this field */ }
    }
    const second = SaveSchema.safeParse(out);
    if (second.success) return second.data;
    return def;
  } catch { return defaultSave(); }
}
