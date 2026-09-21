import Phaser from 'phaser';

// Shared cozy orchard theme: typefaces, palette, panels, buttons, tooltips.
// Used by Menu, Pause and Game Over so every screen feels like one game.
export const UI_FONT = '"Avenir Next", "Trebuchet MS", Verdana, sans-serif';
// Playful rounded display stack (all system fonts — offline safe).
export const DISPLAY_FONT = '"Arial Rounded MT Bold", "Helvetica Rounded", "Nunito", "Trebuchet MS", "Comic Sans MS", sans-serif';
// Tabular-figure stack for scores/coins/timers so numbers don't jitter.
export const NUM_FONT = '"Avenir Next", "Trebuchet MS", Verdana, sans-serif';

export const UI = {
  cream: '#fff8e8',
  creamDim: '#f5edd8',
  muted: '#cfe3c2',
  faint: '#a8bfa4',
  gold: '#ffd97a',
  goldDeep: '#e8d45f',
  pink: '#ffd2e8',
  sky: '#9ed8ff',
  berry: '#ff6b6b',
  berryDeep: '#e84f6f',
  wood: 0x8a6b46,
  woodDark: 0x4a2f1d,
  woodLight: 0xc9a06a,
  leaf: 0x7bc96f,
  panel: 0x1d3a28,
  panelDark: 0x12241a,
  bar: 0x060d09,
  green: 0x7bc96f,
  greenBright: 0x9ef0c8,
  plum: 0x4a2440,
} as const;

/** Pixel-orchard panel: dark fill, green double border, corner rivets. */
export function pixelPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts: { fill?: number; alpha?: number; border?: number } = {}): void {
  const fill = opts.fill ?? UI.panel;
  const alpha = opts.alpha ?? 0.97;
  const border = opts.border ?? UI.green;
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x - 4, y - 2, w + 8, h + 8, 10);
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(2, border, 0.75);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, 0xffffff, 0.14);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
  g.fillStyle(border, 0.9);
  const r = 3;
  g.fillCircle(x + 10, y + 10, r); g.fillCircle(x + w - 10, y + 10, r);
  g.fillCircle(x + 10, y + h - 10, r); g.fillCircle(x + w - 10, y + h - 10, r);
}

/** Standard themed button (rect + label). Returns both for tweening. */
export function pixelButton(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null,
  x: number, y: number, w: number, h: number, label: string,
  primary: boolean, cb: () => void,
  opts: { disabled?: boolean; fontSize?: number } = {},
): { bg: Phaser.GameObjects.Rectangle; tx: Phaser.GameObjects.Text } {
  const disabled = !!opts.disabled;
  const bg = scene.add.rectangle(x, y, w, h, disabled ? 0x2a3a2a : primary ? UI.green : 0x1d3a2a, 1)
    .setStrokeStyle(2, UI.green, disabled ? 0.35 : primary ? 1 : 0.7);
  if (!disabled) bg.setInteractive({ useHandCursor: true });
  const tx = scene.add.text(x, y, label, {
    fontSize: `${opts.fontSize ?? (primary ? 19 : 16)}px`, fontFamily: UI_FONT,
    color: disabled ? '#8a9a8a' : primary ? '#0e1f16' : UI.cream, fontStyle: 'bold',
  }).setOrigin(0.5);
  if (!disabled) {
    bg.on('pointerover', () => { bg.setScale(1.04); bg.y = y - 2; });
    bg.on('pointerout', () => { bg.setScale(1); bg.y = y; });
    bg.on('pointerdown', () => {
      scene.tweens.add({ targets: bg, scaleX: 0.95, scaleY: 0.95, duration: 70, yoyo: true });
      cb();
    });
  }
  if (parent) parent.add([bg, tx]);
  return { bg, tx };
}

/** Bright highlight sweep across a button (primary CTA sheen). */
export function sweepHighlight(scene: Phaser.Scene, x: number, y: number, w: number, h: number, reduced: boolean): void {
  if (reduced) return;
  const s = scene.add.rectangle(x - w / 2, y, 14, h, 0xffffff, 0.0).setDepth(61);
  scene.tweens.add({
    targets: s, x: x + w / 2, alpha: { from: 0.0, to: 0.35 },
    duration: 260, ease: 'Cubic.easeOut', yoyo: true,
    onComplete: () => s.destroy(),
  });
}

/** Hover tooltip (desktop) / tap-to-show hint. Caller owns show/hide. */
export function makeTooltip(scene: Phaser.Scene, depth = 95): {
  show: (x: number, y: number, msg: string) => void; hide: () => void; destroy: () => void;
} {
  const bg = scene.add.rectangle(0, 0, 10, 10, 0x0a140e, 0.95).setStrokeStyle(1, UI.green, 0.8).setOrigin(0.5).setDepth(depth).setVisible(false);
  const tx = scene.add.text(0, 0, '', { fontSize: '12px', color: UI.cream, fontFamily: UI_FONT, align: 'center', wordWrap: { width: 220 } }).setOrigin(0.5).setDepth(depth + 1).setVisible(false);
  return {
    show(x: number, y: number, msg: string): void {
      tx.setText(msg);
      const w = Math.min(240, Math.max(90, tx.width + 20));
      const h = tx.height + 14;
      const cx = Phaser.Math.Clamp(x, w / 2 + 6, 480 - w / 2 - 6);
      bg.setSize(w, h).setPosition(cx, y).setVisible(true);
      tx.setPosition(cx, y).setVisible(true);
    },
    hide(): void { bg.setVisible(false); tx.setVisible(false); },
    destroy(): void { bg.destroy(); tx.destroy(); },
  };
}

/** Smoothly count a numeric text toward a target (coins, XP, score). */
export function countUp(scene: Phaser.Scene, tx: Phaser.GameObjects.Text, from: number, to: number, fmtFn: (n: number) => string, dur = 600): void {
  if (from === to) { tx.setText(fmtFn(to)); return; }
  const o = { v: from };
  scene.tweens.add({
    targets: o, v: to, duration: dur, ease: 'Cubic.easeOut',
    onUpdate: () => tx.setText(fmtFn(Math.round(o.v))),
    onComplete: () => tx.setText(fmtFn(to)),
  });
}

/** Warm wooden frame: outer dark wood, inner light highlight, grain ticks. */
export function woodFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r = 12): void {
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x - 3, y, w + 6, h + 8, r + 2);
  g.fillStyle(UI.woodDark, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(UI.wood, 1);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, r - 3);
  g.lineStyle(2, UI.woodLight, 0.8);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, r - 3);
  // grain ticks
  g.lineStyle(1, UI.woodDark, 0.5);
  const n = Math.floor(w / 46);
  for (let i = 1; i < n; i++) {
    const gx = x + (w / n) * i;
    g.lineBetween(gx, y + 8, gx + 3, y + h - 8);
  }
  // top light catch
  g.lineStyle(2, 0xffffff, 0.22);
  g.lineBetween(x + 12, y + 5, x + w - 12, y + 5);
}
