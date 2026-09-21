# Orchard Merge — Wireframes

Sketched during planning week (late June). Fixed 480×800 portrait canvas.
`[ ]` = buttons, `( )` = preview/badge, `~~~` = decorative panels.

## Screen 1 — Title & Menu (tabs: Play)

```
+------------------------------------------------+
|  🍓  O R C H A R D   M E R G E                 |
|      Pocket Grove      [🟢 Offline Ready]      |
|------------------------------------------------|
| Level 3  [████████░░░░░░]  320 / 460 XP        |
| (🪙) 11.9K  [+]    (💎) 50  [+]                |
|------------------------------------------------|
| [▶ Play] [🛒 Orchard] [🍓 Index] [📜 Quests]   |
| [🏆 Medals] [📊 Stats] [⚙ Setup]               |
|------------------------------------------------|
|  ⭐ RECOMMENDED                                |
|   [🍎]  Quick Play                             |
|   [Best 204,270]  [2 runs]                     |
|   [ ▶  PLAY CLASSIC ]  (60px, biggest button)  |
|   [ Change Mode: Classic ]                     |
|------------------------------------------------|
|  — GAME MODES —                                |
| [🍎 Classic    NORMAL  best...]  [PLAY]        |
| [⏱️ Time Attack  FAST  ...    ]  [PLAY]        |
| ... (scrolls: Chill, Chaos, Hardcore...)       |
+------------------------------------------------+
```

## Screen 5 — Gameplay Jar (the core screen)

```
+------------------------------------------------+
| SCORE        [CLASSIC]  0:04         [NEXT] (o) |
| 12,540                        🍒      [⏸] 44px |
| + 40 coins                                     |
|------------------------------------------------|
| ..................(**********................. |  <- held fruit + guide
| :                :  . landing ghost .  :       |
| : - - - DANGER - - - - - - - - - - - - :       |  <- pulsing red dashes
| :                :             :       :       |
| :    (🍒)    (🍒)       (🍊)    :       :       |  <- stacked fruit
| :      (🍊)       (🍎)          :       :       |
| :________________(🍎 floor)____________:       |
| [🔨×2] [🔀×1] [❄️×3] [🧲×0] [✂️×1] [🍀×2]      |  <- power-up bar
+------------------------------------------------+
```

Notes carried into implementation:
- Score is the largest number; coins secondary; NEXT lives in a wooden
  badge; pause is a full 44px target.
- The drop guide brightens while moving; the ghost marks the true footprint.
- Danger line stays subtle when safe, pulses faster as grace runs out.

## Screen 5b — Pause overlay

```
+------------------------------------------------+
| ░░░░░░ dimmed frozen game ░░░░░░░░░░░░░░░      |
|   +--------------------------------------+     |
|   |  ⏸ PAUSED                            |     |
|   |  Score 12,540  •  3:12               |     |
|   |  [ ▶  RESUME ]  (primary)            |     |
|   |  [ ↻  RESTART ]                      |     |
|   |  [ 🔊 SOUND: ON ]  [ 🎵 MUSIC: ON ]  |     |
|   |  [ 🔈 MUTE (M) ]                     |     |
|   |  [ 🏠 QUIT TO MENU ]                 |     |
|   |  P / ESC to resume                   |     |
|   +--------------------------------------+     |
+------------------------------------------------+
```

## Screen 6 — Game Over

```
+------------------------------------------------+
|  🍂 Run Over                                   |
|  [ FINAL SCORE:  84,210 ]  (counts up)         |
|  ★ NEW BEST! (if beaten)  +1,240 🪙 earned     |
|  Best 84,210 • CLASSIC                         |
|  Best chain ×6  |  Merges 74  |  Highest: Star |
|  🌟 NEW DISCOVERY!  "You grew a Star Pineapple"|
|  [ ↻ ONE MORE RUN ]  [ 🏠 MENU / SHOP ]        |
|  Lv 13 — 1,135/1,540 XP  •  💎 50              |
+------------------------------------------------+
```

## Screen 4 — Shop (Orchard tab excerpt)

```
+------------------------------------------------+
| [🛒 SHOP] [⬆ UPGRADES]   ✨ TODAY: <item>      |
| [🍑 Ember Peach Stone — unlocks Ember drops]   |
|                                  [3,200 🪙]    |
| [🔨 Hammer ×1 — smash one fruit]               |
|                                  [300 🪙]      |
+------------------------------------------------+
```
