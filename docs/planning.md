# Orchard Merge — Pocket Grove · Planning & Design Journal

> Coursework design journal. Dates below mark when each piece of planning and
> building was done, June–September. AI assistance is declared separately in
> [ai-log.md](ai-log.md) and is limited to visual/polish tasks.

## 1. Initial game idea

A cozy, offline-first **merge puzzle**: drop fruits into a glass terrarium jar.
Two matching fruits that touch merge into the next-bigger fruit up a fixed
evolution chain. Merges score points, fast consecutive merges build a **chain
multiplier**, and if the pile sits above the DANGER line too long the run ends.
Between runs the player earns coins/gems, unlocks new fruits, buys power-ups
and upgrades, and picks from several game modes (relaxed zen through hardcore).

**Goals I set before coding:**
1. Learnable in 30 seconds, hard to master (one more run feeling).
2. 100% offline: no accounts, no network, saves on device.
3. Fair physics: predictable stacking, no random fly-offs.
4. Juice without clutter: every merge feels good, the board stays readable.

## 2. Decomposing the problem

| # | Sub-problem | Approach |
|---|---|---|
| 1 | Render loop + screens | Phaser scenes: Boot → Preload → Menu → Game → Pause / Game Over |
| 2 | Fruit bodies + stacking | Matter.js circles, tuned friction/restitution per tier |
| 3 | Merge detection | `collisionstart` → same-id pair with a merge target → merge queue (max 4/frame, anti-teleport distance check) |
| 4 | Scoring | Base score × mode × chain multiplier × perfect bonus, Decimal-safe |
| 5 | Lose condition | DANGER line + grace timer, offenders must be settled (slow + old enough) |
| 6 | Meta game | Coins/gems/XP store, shop, upgrades, power-ups, achievements, daily seed |
| 7 | Persistence | IndexedDB via idb-keyval, lz-string compression, zod-validated schema with repair |
| 8 | Sound | Synthesized WebAudio SFX + bundled music tracks, volume buses |

Control structures used throughout: game-state machine (`menu`/`playing`/`paused`/`over`),
bounded per-frame merge queue, grace-period timers, weighted-random drop pool,
pity timer guaranteeing specials.

## 3. Key decisions and why

- **Phaser + Matter instead of raw canvas**: I get a scene graph, tweens, input
  and a battle-tested physics solver instead of hand-rolling collision.
- **Fixed 480×800 canvas, FIT-scaled**: one layout to design; physics tuned once;
  works on phones and desktops via letterboxing + decorative side panels.
- **Circle bodies for every fruit** (even spiky-looking ones): stable stacking;
  silhouette variety is visual only, so gameplay stays fair.
- **Merge queue, not instant merge**: prevents duplicate merges and infinite
  merge loops when three touch at once.
- **Decimal.js for score/coins**: scores grow past `Number.MAX_SAFE_INTEGER`
  territory in long chains; floats would corrupt leaderboards.
- **Seeded RNG (`seedrandom`)**: daily challenge is identical for everyone, and
  runs are reproducible for debugging.
- **Special-fruit pity timer (60 drops)**: guarantees wildcard moments instead
  of dry spells — tested better in playthroughs.
- **Consumable power-ups, not permanent cheats**: hammer/shuffle/freeze stay
  strategic because each use costs a unit.
- **Offline PWA with precached bundle**: the game must survive airplane mode;
  a service worker precaches JS, art, audio and fonts.

## 4. Significant changes from the original plan (and why)

| Date | Change | Reason |
|---|---|---|
| Jul | Chain window made tier-aware (big merges buy extra rhythm time) | Late-game chains felt impossible once fruits got heavy |
| Aug | Added special-fruit pity timer | Playtests had 100+ drop droughts with no wildcards |
| Aug | Drop preview renders at true landing size | Testers misjudged fits with the old enlarged preview |
| Sep | Chain extended 10 → 14 tiers (Solar → Worldseed) | Endgame arrived too fast; testers wanted a longer chase |
| Sep | Merged the separate combo counter into the chain counter | Two labels for one number confused players |
| Sep | Score curve steepened (chain ×0.75/link, perfect ×2.5) | Scores felt flat next to the new juice |

## 5. Development log (dates)

| Dates | Work |
|---|---|
| 22–28 Jun | Idea, goals, genre research (Suika-likes), tech choice |
| 29 Jun–5 Jul | Wireframes ([wireframes.md](wireframes.md)), user flow ([user-flow.md](user-flow.md)), mechanic pseudocode (§6) |
| 6–19 Jul | Prototype: drop/spawn, Matter tuning, merge queue, scoring + chain window |
| 20 Jul–2 Aug | DANGER line + grace, game-over flow, pause, first juice pass |
| 3–16 Aug | Save system (IndexedDB + zod repair), menu tabs, shop, upgrades, power-ups |
| 17–30 Aug | Audio (synth SFX + bundled tracks), visual polish pass, fruit art variety |
| 31 Aug–13 Sep | Tiers 10–13, 4 new specials, Lucky Fountain mode, score/chain revamp |
| 14–20 Sep | Testing blitz + bug fixes (see [testing.md](testing.md)), docs written up |

## 6. Main-mechanic pseudocode (merge loop — my own design)

```
on physics collisionstart(bodyA, bodyB):
  idA, idB = fruit ids from body labels (or null for walls/floor)
  if idA is null or idB is null: play landing/bounce feedback; return
  if idA == 'prismfruit' or idB == 'prismfruit':
      upgrade the NON-prism partner one tier; return
  if idA != idB: return                              // must match exactly
  if fruit(idA) has no mergeTarget: return            // max tier, nothing above
  enqueue merge pair (A, B)   // max 4 per frame; dedupe by body-id pair

each frame, for up to 4 queued pairs:
  if either partner gone: skip
  if distance(partners) > (rA + rB) * 3.2: skip      // anti-teleport
  remove both bodies
  spawn target fruit at midpoint with averaged velocity
  gap = now - lastMergeAt
  chain = (gap < 2600ms) ? chain + 1 : 1
  gained = baseScore × modeMult × (1 + (chain-1)×0.75) × (perfect ? 2.5 : 1)
  score += gained; coins += coinValue × (1 + (chain-1)×0.25)
```

## 7. Control structures (evidence)

- **State machine**: `menu → playing ⇄ paused → gameover → menu`.
- **Bounded loop**: merge queue drains max 4/frame so chain reactions can't
  spiral.
- **Timers**: drop cooldown, danger grace, combo window, power-up lockout.
- **Weighted random**: drop pool weights shift with Luck upgrades.
- **Functions**: systems split into `rollDrop / tryDrop / onCollide /
  enqueueMerge / doMerge / checkDanger / endRun` plus helpers.
