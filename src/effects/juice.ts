import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';

// Polished juice helpers honoring reduced-motion + user toggles.
// Circles are pooled per scene to avoid GC churn during big chains.

interface PooledDot { c: Phaser.GameObjects.Arc; busy: boolean }
const dotPools = new WeakMap<Phaser.Scene, PooledDot[]>();

function takeDot(scene: Phaser.Scene, x: number, y: number, r: number, color: number, alpha: number, depth: number): Phaser.GameObjects.Arc {
  let pool = dotPools.get(scene);
  if (!pool) { pool = []; dotPools.set(scene, pool); }
  for (const d of pool) {
    if (!d.busy && d.c.active) {
      d.busy = true;
      d.c.setPosition(x, y).setRadius(r).setFillStyle(color, alpha).setAlpha(alpha).setScale(1).setDepth(depth).setVisible(true);
      return d.c;
    }
  }
  const c = scene.add.circle(x, y, r, color, alpha).setDepth(depth);
  if (pool.length < 160) pool.push({ c, busy: true });
  else c.once('destroy', () => undefined);
  return c;
}

function freeDot(scene: Phaser.Scene, c: Phaser.GameObjects.Arc): void {
  const pool = dotPools.get(scene);
  const d = pool?.find(p => p.c === c);
  if (d) { d.busy = false; c.setVisible(false); }
  else { try { c.destroy(); } catch { /* ignore */ } }
}

export interface FxOpts {
  reduced: boolean;
  shakeOn?: boolean;
  flashOn?: boolean;
  quality?: string;
}

export function optsFromSettings(s: { reducedMotion: boolean; screenShake: boolean; screenFlash: boolean; quality: string }): FxOpts {
  return { reduced: s.reducedMotion, shakeOn: s.screenShake, flashOn: s.screenFlash, quality: s.quality };
}

export function popIn(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject & { scaleX: number; setScale: (x: number, y?: number) => void }, reduced: boolean): void {
  if (reduced) return;
  const s = obj.scaleX || 1;
  scene.tweens.add({ targets: obj, scaleX: s * 1.16, scaleY: s * 1.16, duration: 100, yoyo: true, ease: 'Quad.easeOut' });
}

export function squashStretch(scene: Phaser.Scene, obj: { setScale: (x: number, y: number) => void }, sx: number, sy: number, dur = 140): void {
  scene.tweens.add({ targets: obj, scaleX: sx, scaleY: sy, duration: dur / 2, yoyo: true, ease: 'Quad.easeOut', onComplete: () => {
    scene.tweens.add({ targets: obj, scaleX: 1, scaleY: 1, duration: dur / 2, ease: 'Back.easeOut' });
  } });
}

export function floatText(scene: Phaser.Scene, x: number, y: number, msg: string, color = '#ffffff', size = 20, dur = 900): void {
  const t = scene.add.text(x, y, msg, { fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#0a140e', strokeThickness: 4 }).setOrigin(0.5).setDepth(60);
  scene.tweens.add({ targets: t, y: y - 64, alpha: 0, scaleX: 1.08, scaleY: 1.08, duration: dur, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

/** Big center announcement — hard hit, fast exit, never stacks. */
let announceLock = 0;
/** Rainbow hue cycle for high-chain text. */
export function rainbowTint(timeMs: number, s = 0.85, v = 1): number {
  const h = ((timeMs / 9) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (h < 1) { r = c; g = x; } else if (h < 2) { r = x; g = c; }
  else if (h < 3) { g = c; b = x; } else if (h < 4) { g = x; b = c; }
  else if (h < 5) { r = x; b = c; } else { r = c; b = x; }
  const m = v - c;
  return ((r + m) * 255 << 16) | ((g + m) * 255 << 8) | ((b + m) * 255);
}
export function announce(scene: Phaser.Scene, msg: string, sub: string, color = '#ffe9a8', big = false, rainbow = false): void {
  const now = scene.time.now;
  if (now - announceLock < 250 && !big) return;
  announceLock = now;
  const cx = scene.scale.width / 2;
  const t = scene.add.text(cx, 300, msg, { fontSize: big ? '48px' : '36px', color, fontStyle: 'bold', stroke: '#0a140e', strokeThickness: 8 }).setOrigin(0.5).setDepth(70).setScale(0.55).setAlpha(0);
  if (rainbow) t.setTint(rainbowTint(now));
  // impact ring behind the text
  const gfx = scene.add.graphics().setDepth(69);
  gfx.lineStyle(5, rainbow ? 0xffffff : Phaser.Display.Color.HexStringToColor(color).color, 0.9);
  gfx.strokeCircle(cx, 300, 10);
  scene.tweens.add({ targets: gfx, scaleX: big ? 7 : 5, scaleY: big ? 7 : 5, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => gfx.destroy() });
  scene.tweens.add({ targets: t, scaleX: 1.7, scaleY: 1.7, alpha: 1, duration: 120, ease: 'Back.easeOut', onUpdate: () => { if (rainbow) t.setTint(rainbowTint(scene.time.now)); } });
  scene.tweens.add({ targets: t, scaleX: 1, scaleY: 1, duration: 130, delay: 120, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: t, scaleX: 0.7, scaleY: 0.7, alpha: 0, y: 250, delay: big ? 530 : 430, duration: 250, ease: 'Back.easeIn', onComplete: () => t.destroy() });
  if (sub) {
    const s = scene.add.text(cx, 348, sub, { fontSize: '16px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a140e', strokeThickness: 4 }).setOrigin(0.5).setDepth(70).setAlpha(0);
    scene.tweens.add({ targets: s, alpha: 1, duration: 120 });
    scene.tweens.add({ targets: s, alpha: 0, y: 330, delay: big ? 530 : 430, duration: 250, onComplete: () => s.destroy() });
  }
}

export function burst(scene: Phaser.Scene, x: number, y: number, color: number, n = 14, reduced = false, speed = 1): void {
  // Hard cap for perf: never more than 36 live particles per burst.
  const capped = Math.min(n, 36);
  const count = reduced ? Math.ceil(capped / 5) : capped;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = (26 + Math.random() * 70) * speed;
    const r = 2 + Math.random() * (n > 20 ? 5 : 3.5);
    const p = takeDot(scene, x, y, r, color, 1, 55);
    scene.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 14, alpha: 0, scaleX: 0.15, scaleY: 0.15, duration: 420 + Math.random() * 380, ease: 'Cubic.easeOut', onComplete: () => freeDot(scene, p) });
  }
}

/** Leaf + juice-droplet merge burst: green triangles arc out, droplets fall with gravity. */
export function leafJuiceBurst(scene: Phaser.Scene, x: number, y: number, leafColor: number, juiceColor: number, n = 12, reduced = false): void {
  if (reduced) { burst(scene, x, y, juiceColor, Math.ceil(n / 3), true); return; }
  const count = Math.min(n, 20);
  for (let i = 0; i < count; i++) {
    const leaf = i % 2 === 0;
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 70;
    if (leaf) {
      const t = scene.add.triangle(x, y, 0, -6, 5, 5, -5, 5, leafColor, 1).setDepth(56);
      scene.tweens.add({ targets: t, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 26, rotation: (Math.random() - 0.5) * 4, alpha: 0, duration: 480 + Math.random() * 300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    } else {
      const p = takeDot(scene, x, y, 2 + Math.random() * 2.5, juiceColor, 1, 56);
      scene.tweens.add({ targets: p, x: x + Math.cos(a) * d * 0.7, y: y + Math.abs(Math.sin(a)) * d * 0.9 + 20, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 420 + Math.random() * 280, ease: 'Quad.easeIn', onComplete: () => freeDot(scene, p) });
    }
  }
  burst(scene, x, y, 0xffffff, Math.ceil(count / 3), false, 0.8);
}

/** Gold sparkle fountain (coins, lucky, rewards). */
export function goldSparkle(scene: Phaser.Scene, x: number, y: number, n = 14, reduced = false): void {
  burst(scene, x, y, 0xffd97a, n, reduced, 1.1);
  burst(scene, x, y, 0xfff6d8, Math.ceil(n / 2), reduced, 0.7);
}

/** Snowfall puff for freeze. */
export function snowPuff(scene: Phaser.Scene, x: number, y: number, w: number, n = 16, reduced = false): void {
  const count = reduced ? 4 : Math.min(n, 22);
  for (let i = 0; i < count; i++) {
    const px = x + (Math.random() - 0.5) * w;
    const p = takeDot(scene, px, y - 10, 1.5 + Math.random() * 2.5, 0xdff4ff, 0.95, 57);
    scene.tweens.add({ targets: p, x: px + (Math.random() - 0.5) * 60, y: y + 60 + Math.random() * 120, alpha: 0, duration: 700 + Math.random() * 500, ease: 'Sine.easeIn', onComplete: () => freeDot(scene, p) });
  }
}

/** Jagged crack lines radiating from a point (hammer smash). */
export function crackBurst(scene: Phaser.Scene, x: number, y: number, color = 0xffe9a8, arms = 7, len = 46): void {
  const g = scene.add.graphics().setDepth(57);
  g.lineStyle(3, color, 0.95);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + Math.random() * 0.4;
    const lenI = len * (0.7 + Math.random() * 0.5);
    const ex = x + Math.cos(a) * lenI, ey = y + Math.sin(a) * lenI;
    g.lineBetween(x, y, (x + ex) / 2, (y + ey) / 2 - 4);
    g.lineBetween((x + ex) / 2, (y + ey) / 2 - 4, ex, ey);
  }
  scene.tweens.add({ targets: g, alpha: 0, scaleX: 1.25, scaleY: 1.25, duration: 320, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
}

/** Curved magnetic trails: dots arc from mates toward the magnet point. */
export function magnetTrails(scene: Phaser.Scene, tx: number, ty: number, from: Array<{ x: number; y: number }>, reduced: boolean): void {
  if (reduced) { ring(scene, tx, ty, 0xffc2dd, 90, 320); return; }
  for (const f of from.slice(0, 5)) {
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      const mx = f.x + (tx - f.x) * t;
      const my = f.y + (ty - f.y) * t - Math.sin(t * Math.PI) * 40;
      const p = takeDot(scene, f.x, f.y, 2.5, 0xffc2dd, 0.9, 57);
      scene.tweens.add({ targets: p, x: mx, y: my, duration: 120, delay: i * 70, ease: 'Quad.easeIn', onComplete: () => freeDot(scene, p) });
    }
  }
  ring(scene, tx, ty, 0xffc2dd, 90, 320);
}

/** Expanding impact ring. */
export function ring(scene: Phaser.Scene, x: number, y: number, color = 0xffffff, maxR = 70, dur = 380): void {
  const c = scene.add.circle(x, y, 8, color, 0).setDepth(56).setStrokeStyle(4, color, 0.9);
  scene.tweens.add({ targets: c, scaleX: maxR / 8, scaleY: maxR / 8, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
}

/** Soft dust puff on landing (subtle, low count). */
export function dust(scene: Phaser.Scene, x: number, y: number, n = 5): void {
  for (let i = 0; i < n; i++) {
    const p = scene.add.circle(x + (Math.random() - 0.5) * 18, y + Math.random() * 6, 2 + Math.random() * 3, 0xffffff, 0.45).setDepth(30);
    scene.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 44, y: p.y - 10 - Math.random() * 16, alpha: 0, duration: 380 + Math.random() * 220, onComplete: () => p.destroy() });
  }
}

export function shake(scene: Phaser.Scene, intensity = 0.004, dur = 180, reduced = false, shakeOn = true): void {
  if (reduced || !shakeOn || !scene.cameras.main) return;
  scene.cameras.main.shake(dur, intensity);
}

export function flash(scene: Phaser.Scene, dur = 90, flashOn = true): void {
  if (!flashOn) return;
  try { scene.cameras.main.flash(dur, 255, 250, 225); } catch { /* ignore */ }
}

/** Brief hit-stop / slow-mo for mythic merges. */
export function hitStop(scene: Phaser.Scene, ms = 120, scale = 0.25): void {
  try {
    const eng = (scene as unknown as { matter: { world: { engine: { timing: { timeScale: number } } } } }).matter.world.engine;
    const prev = eng.timing.timeScale || 1;
    eng.timing.timeScale = scale;
    scene.time.delayedCall(ms, () => { eng.timing.timeScale = prev; });
  } catch { /* ignore */ }
}

export function haptic(pattern: number | number[] = 20): void { audio.buzz(pattern); }
