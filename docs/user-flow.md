# Orchard Merge — User Flow

Drawn before implementation (late June), updated as screens were added.
Same visual language as the reference example: circles = start/end,
rectangles = screens, diamonds = decisions, shaded boxes = user actions,
dashed lines = quit/exit paths.

```mermaid
flowchart TD
    start([Start:<br/>Launch App]) --> menu[Screen 1:<br/>Title & Menu]
    menu --> what{{Decision:<br/>What now?}}
    what -->|Play| modes[Screen 2:<br/>Mode Cards]
    what -->|How to Play| rules[Screen 3:<br/>How to Play]
    what -->|Shop / Upgrades| shop[Screen 4:<br/>Shop]
    what -.->|Quit| quit
    rules --> modes
    shop --> modes
    modes --> drop[Screen 5:<br/>Gameplay Jar]
    drop --> aim{{Decision:<br/>Where to drop?}}
    aim --> act[User Action:<br/>Move + Drop fruit]
    act --> settle[System:<br/>Physics settles fruit]
    settle --> match{{Decision:<br/>Matching pair<br/>touching?}}
    match -->|No| danger{{Decision:<br/>Above danger line<br/>past grace?}}
    match -->|Yes| merge[System:<br/>Merge → bigger fruit<br/>+ score × chain]
    merge --> chainq{{Decision:<br/>Another merge<br/>inside window?}}
    chainq -->|Yes| merge
    chainq -->|No| danger
    danger -->|Yes| over[Screen 6:<br/>Game Over + Stats]
    danger -->|No| aim
    over --> again{{Decision:<br/>Play again?}}
    again -->|Yes| modes
    again -->|No| quit([End:<br/>Quit])
    drop -.->|Pause menu → Quit| quit

    classDef action fill:#cfe3c2,stroke:#1d3a2a,stroke-width:2px;
    class act,merge,settle,over action;
```

## User Flow Key

| Shape | Meaning |
|---|---|
| 🟢 Circle (Start / End) | Entry and exit points |
| ⬜ Rectangle (Screen) | A screen the player sees |
| 🔷 Diamond (Decision) | A choice — player or system |
| 🟩 Shaded box (User Action / System) | Something that happens |
| ➖➖ Dashed line | Quit / exit path |

## Reading the flow

- The **core loop** is `aim → drop → settle → match? → merge → chain?` — the
  addictive middle the whole game is built around.
- **Every exit returns to a screen, never a dead end**: pause quits to menu,
  game over offers one-more-run or menu.
- **No-loss onboarding**: the first run shows a 5-step tutorial overlay before
  the danger line matters, so step 1–2 (aim, drop) are learned risk-free.
- **Economy loop (off the critical path)**: coins/gems earned in runs are
  spent in the Shop screen, which feeds back into runs via unlocks and
  power-ups — a second, slower loop around the core one.
