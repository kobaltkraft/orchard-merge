# Orchard Merge — Testing Evidence

## 1. Automated tests (run on every change)

| Suite | What it proves | Result |
|---|---|---|
| `tests/save` (3 tests) | Saves validate, repair, and round-trip (incl. corrupt-data repair) | ✅ pass |
| `tests/economy` (3 tests) | Coin/gem/XP math, upgrade costs, multiplier curves | ✅ pass |
| `tests/merging` (5 tests) | 14-tier chain fully linked, terminal tier ends, radii/scores strictly increase, chain walk always terminates (property test), adjacent tiers differ in size + hue | ✅ pass |
| `tests/e2e/offline.spec.ts` | Boots, plays, merges, shops, saves with **zero network** | ✅ pass |

```bash
npm test            # vitest unit + property tests
npm run test:e2e    # Playwright offline smoke (needs a preview server)
npm run offline:check  # fails the build if any remote request leaks
```

## 2. Manual QA passes (device: desktop Chrome + mobile viewport)

Each pass plays a full run: menu → mode → drops → merges → chains →
power-ups → pause/resume → game over → restart. Checked every pass:

- [x] Every fruit level merges into the correct next tier
- [x] Chain merges escalate (text, pitch, shake) and expire cleanly
- [x] Danger line warns → counts down → ends run; restart works
- [x] Pause / resume / restart / quit-to-menu, all buttons
- [x] All 6 power-ups trigger their effect + feedback
- [x] Coins/gems/XP persist across reload (IndexedDB)
- [x] Volumes sliders + mute apply live; reduced-motion disables juice
- [x] Menu scrolls on long tabs; no UI overlap at 480×800 or 1280×800
- [x] No console errors during 20-drop soak runs
- [x] Screenshots captured per pass (`docs/images/`)

## 3. Real bugs found by testing (and fixed)

| Bug | Symptom | Cause | Fix |
|---|---|---|---|
| PLAY CLASSIC dead on hover | Button teleported away from cursor, clicks missed | Hover handler closed over mutating `y` variable | Captured position in a `const` |
| Game froze on every merge | `TypeError: reading 'position'`, loop stalled | FX read `fruit.x` **after** `removeFruit()` destroyed the Matter body (whose `.x` is a getter) | Capture positions before removal |
| Menu wouldn't scroll | `scrollMax` always 0, content cut off | `Container.getBounds()` unreliable here | Manual per-child bounds union |
| Blank red error overlay | esbuild `Unexpected "else"` | Duplicated `else` line from an edit | Removed duplicate |
| E2E hit the wrong game | Screenshots showed another project | Ports 4173–4175 squatted by a second local project | Pinned QA to port 4188 |
| Chain/combo double labels | "CHAIN ×3" + "COMBO ×5" for one counter | Redundant `combo` field duplicating chain max | Deleted field, unified on CHAIN |

## 4. Performance notes

- Physics: 6 position / 4 velocity iterations, sleeping bodies enabled.
- Particles pooled (max ~36/burst) and quality-scaled; ambient FX capped
  (≤7 breathers, ≤4 orbiter sets, 3 concurrent blinks).
- 60 FPS target; `stats-gl` overlay available in DEV via `?debug=1`.
