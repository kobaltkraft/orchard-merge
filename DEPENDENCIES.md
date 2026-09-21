# DEPENDENCY AUDIT — Orchard Merge Pocket Grove

All runtime deps are bundled locally by Vite. No CDN, no remote assets, no analytics.

| PACKAGE | VERSION | PURPOSE | WHERE USED | OFFLINE | LICENSE |
|---|---|---|---|---|---|
| phaser | 4.2.1 | Renderer, scenes, Matter integration, tweens, input, cameras | scenes/*, main.ts | yes | MIT |
| typescript | ~5.5 | Strict types | all src | yes | Apache-2.0 |
| vite | ^6 | Dev + prod bundler | build | yes | MIT |
| matter-js | ^0.20 | Physics types/tuning alongside Phaser Matter | scenes/GameScene, physics config | yes | MIT |
| gsap | ^3.12 | Menu/shop/reward/title animations | scenes/MenuScene | yes | GreenSock |
| zustand | ^5 | Meta store (coins/gems/xp/upgrades/settings/unlocks) | store/meta.ts | yes | MIT |
| zod | ^3.23 | Save/settings validation + repair | persistence/SaveSchema | yes | MIT |
| idb-keyval | ^6 | IndexedDB saves | persistence/SaveManager | yes | Apache-2.0 |
| lz-string | ^1.5 | Compress large saves | persistence/SaveManager | yes | MIT |
| decimal.js | ^10.4 | Exact coin/score math | scenes, store, utils | yes | MIT |
| lodash-es | ^4.17 | (reserved) collection utils, tree-shaken named imports | utils/data ops | yes | MIT |
| seedrandom | ^3.0 | Seeded drops/shop/daily | utils/Random, GameScene | yes | MIT |
| simplex-noise | ^4.0 | (reserved) procedural bg variation | effects/backdrop | yes | MIT |
| culori | ^4.0 | (reserved) palette/rarity/gradient math | config/graphics | yes | MIT |
| nipplejs | ^0.10 | Optional joystick alt-mode flag | settings/input | yes | MIT |
| screenfull | ^6 | (reserved) fullscreen toggle hook | settings | yes | MIT |
| howler | ^2.2 | (reserved) layered audio path; current build uses WebAudio synth | audio/AudioManager | yes | MIT |
| vite-plugin-pwa | ^1.0 | Installable offline PWA, precache all | vite.config.ts | yes | MIT |
| tweakpane | ^4 (dev) | Dev physics/economy panel | src/dev (DEV only) | yes | MIT |
| stats-gl | ^3 (dev) | Dev FPS/physics/entity overlay | src/dev (DEV only) | yes | MIT |
| vitest | ^2 (dev) | Unit tests | tests/* | yes | MIT |
| fast-check | ^3 (dev) | Property tests | tests/* | yes | MIT |
| playwright | ^1.44 (dev) | Offline browser tests | tests/e2e | yes | Apache-2.0 |

## Offline verification
- `src/utils/netGuard.ts` (DEV): patches fetch/Image to log BLOCKED remote requests.
- `tests/e2e/offline.spec.ts`: asserts zero http(s) requests + renders with context offline.
- PWA workbox: `globPatterns` precache, `runtimeCaching: []`, `navigateFallback: index.html`.
