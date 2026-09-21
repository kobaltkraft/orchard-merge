# AI Documentation Log

**Student declaration:** the game concept, core mechanics (merge detection,
physics tuning, scoring and chain formulas, danger system, save system, game
modes and economy design), and all final code decisions are my own work.
AI assistance (Muse Spark, via the OpenCode agent) was used **only for the
visual and presentational polish tasks listed below**, during August–September.
Every AI-assisted change was playtested by me in-game (screenshots in
`docs/images/`) before keeping it.

## AI-assisted tasks (aesthetic / presentational only)

| Date | Task | What the AI did |
|---|---|---|
| Aug | Menu visual redesign | Hero header layout, gold-framed Quick Play card, mode-card accent spines, tab badges, footer; I approved each layout |
| Aug | Fruit art variety | Extra face styles (open/sleepy/sparkle eyes), pattern motifs (rays, constellation, petals), hue-spacing audit across tiers |
| Aug | High-tier silhouettes | Star-burst spikes, aurora skirt, solar corona rim, Saturn ring, blossom ring, cracked-egg finish — all drawn inside physics radius |
| Aug | Juice timing + feel | Announcement in/hold/out durations, shake ladder values, pop-scale easings, particle caps |
| Aug | HUD/menu styling | NEXT badge wooden frame, 44px pause button, pixel-panel borders, shared theme palette + type scale |
| Sep | Announcement restyle | Bigger type, impact ring, faster exit timing, rainbow tint on hot chains |
| Sep | Volume sliders UI | Draggable slider widget replacing −/+ steppers |
| Sep | Side panels + page dressing | Desktop evolution/companion panels, procedural night-orchard page background |
| Sep | README + docs wording | Structure and phrasing of this documentation pack |

## What AI did NOT do

Game design, the merge mechanic, physics configuration, scoring/chain
formulas, the save system, danger-line logic, drop probabilities, power-up
effects design, mode rules, economy balancing, and all bug diagnosis
decisions were mine. AI-suggested code was reviewed, tested in-game, and
edited by me before commit.

## Verification of AI-assisted work

- `npx tsc --noEmit` clean after every change
- `npm test` (11 tests) green
- Playwright soak runs with zero page errors
- Screenshot review per change (`docs/images/`)
