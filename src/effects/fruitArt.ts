import Phaser from 'phaser';
import type { FruitDef } from '../config/fruitConfig';

// Polished procedural fruit textures — stylized mobile-game look.
// Each tier has a distinct silhouette accent + shading + gloss + speckle.
// Cached per id. All offline, no external assets.

const cache = new Set<string>();
export function fruitTextureKey(id: string): string { return `fruit_${id}`; }

/** Native texture size (px) for a fruit radius — texture includes transparent pad. */
export function fruitTextureSize(radius: number): number {
  const pad = Math.ceil(radius * 0.55 + 12);
  return Math.ceil(radius * 2 + pad * 2);
}

// Per-fruit accent hues for variety (speckles, stripes, crowns).
type Pattern = 'dots' | 'stripes' | 'star' | 'swirl' | 'rays' | 'constellation' | 'petals' | 'none';
const ACCENTS: Record<string, { speckle: string; gloss: number; pattern: Pattern; stem: boolean }> = {
  seed: { speckle: '#6b4a2f', gloss: 0.5, pattern: 'dots', stem: false },
  sproutpea: { speckle: '#2f7a3f', gloss: 0.7, pattern: 'dots', stem: true },
  dewberry: { speckle: '#d8ecff', gloss: 0.9, pattern: 'dots', stem: true },
  sunplum: { speckle: '#7a3fb0', gloss: 0.75, pattern: 'swirl', stem: true },
  honeyapricot: { speckle: '#c07a2a', gloss: 0.8, pattern: 'stripes', stem: true },
  ciderapple: { speckle: '#8f1f1f', gloss: 0.85, pattern: 'none', stem: true },
  emberpeach: { speckle: '#b03a1f', gloss: 0.8, pattern: 'swirl', stem: true },
  frostmelon: { speckle: '#1f7a6a', gloss: 0.9, pattern: 'stripes', stem: true },
  starpine: { speckle: '#8a6a00', gloss: 0.85, pattern: 'star', stem: false },
  auroramelon: { speckle: '#e8d45f', gloss: 1, pattern: 'star', stem: false },
  solarplum: { speckle: '#b03a1f', gloss: 0.9, pattern: 'rays', stem: true },
  cosmicfig: { speckle: '#e8ecff', gloss: 0.95, pattern: 'constellation', stem: true },
  everbloom: { speckle: '#8f2f5f', gloss: 0.95, pattern: 'petals', stem: true },
  worldseed: { speckle: '#e8d45f', gloss: 1, pattern: 'star', stem: false },
  bombfruit: { speckle: '#ff5f5f', gloss: 0.6, pattern: 'none', stem: false },
  icefruit: { speckle: '#5aa7e8', gloss: 1, pattern: 'none', stem: false },
  magnetfruit: { speckle: '#8f2f5f', gloss: 0.8, pattern: 'none', stem: false },
  prismfruit: { speckle: '#7a5fe8', gloss: 1, pattern: 'star', stem: false },
  goldenapple: { speckle: '#8a6a00', gloss: 1, pattern: 'rays', stem: true },
  ironplum: { speckle: '#3a3f4a', gloss: 0.5, pattern: 'stripes', stem: true },
  chronoberry: { speckle: '#e8d45f', gloss: 1, pattern: 'swirl', stem: true },
  ghostgrape: { speckle: '#ffffff', gloss: 0.9, pattern: 'dots', stem: true },
};

export function blinkTextureKey(id: string): string { return `fruit_${id}_blink`; }

function paintFruit(scene: Phaser.Scene, def: FruitDef, key: string, closed: boolean): string {
  if (cache.has(key) || scene.textures.exists(key)) { cache.add(key); return key; }
  const r = def.radius;
  const size = fruitTextureSize(r);
  const g = scene.add.graphics();
  const cx = size / 2; const cy = size / 2 + 2;
  const acc = ACCENTS[def.id] ?? { speckle: '#000000', gloss: 0.7, pattern: 'dots' as const, stem: true };

  const c = Phaser.Display.Color.HexStringToColor(def.body);
  const dark = c.clone().darken(32);
  const mid = c.clone().darken(10);
  const light = c.clone().lighten(42);

  // Contact shadow (soft ellipse below)
  g.fillStyle(0x000000, 0.20);
  g.fillEllipse(cx, cy + r * 0.92, r * 1.5, r * 0.34);

  // Mythic aura
  if (def.id === 'auroramelon') {
    for (let i = 4; i >= 1; i--) {
      g.lineStyle(2, 0xe8d45f, 0.16 * (5 - i));
      g.strokeCircle(cx, cy, r + i * 5);
    }
  }
  if (def.id === 'worldseed') {
    // finale: radiant double aura + orbiting sparks
    for (let i = 6; i >= 1; i--) {
      g.lineStyle(2.5, i % 2 ? 0xe8d45f : 0xffffff, 0.14 * (7 - i));
      g.strokeCircle(cx, cy, r + i * 5);
    }
    g.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      g.fillCircle(cx + Math.cos(a) * (r + 34), cy + Math.sin(a) * (r + 34), 2.2);
    }
  }
  if (def.special === 'rainbow') {
    for (let i = 0; i < 6; i++) {
      g.lineStyle(3, [0xff5f5f, 0xf5a94b, 0xe8c832, 0x7bc96f, 0x5aa7e8, 0xb678e8][i], 0.5);
      g.strokeCircle(cx, cy, r + 3 + i * 1.6);
    }
  }

  // Body: layered spheres for depth
  g.fillStyle(dark.color, 1); g.fillCircle(cx, cy, r);
  g.fillStyle(mid.color, 1); g.fillCircle(cx, cy - r * 0.04, r * 0.93);
  g.fillStyle(c.color, 1); g.fillCircle(cx - r * 0.06, cy - r * 0.1, r * 0.82);

  // Pattern layer
  const sp = Phaser.Display.Color.HexStringToColor(acc.speckle);
  if (acc.pattern === 'dots') {
    g.fillStyle(sp.color, 0.35);
    const n = Math.max(4, Math.floor(r / 5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r;
      const d = r * (0.35 + ((i * 37) % 40) / 100);
      g.fillCircle(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, Math.max(1.2, r * 0.05));
    }
  } else if (acc.pattern === 'stripes') {
    g.lineStyle(Math.max(2, r * 0.08), sp.color, 0.4);
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.arc(cx, cy, r * 0.62, Math.PI * (0.15 + k * 0.14), Math.PI * (0.25 + k * 0.14));
      g.strokePath();
    }
  } else if (acc.pattern === 'swirl') {
    g.lineStyle(Math.max(1.6, r * 0.06), sp.color, 0.45);
    g.beginPath(); g.arc(cx - r * 0.1, cy, r * 0.5, 0.4, 2.6); g.strokePath();
    g.beginPath(); g.arc(cx + r * 0.1, cy + r * 0.1, r * 0.34, 2.8, 5.4); g.strokePath();
  } else if (acc.pattern === 'star') {
    // crown spikes for high tiers
    const spikes = def.tier >= 8 ? 8 : 5;
    g.fillStyle(sp.color, 0.55);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const x1 = cx + Math.cos(a) * r * 0.98; const y1 = cy + Math.sin(a) * r * 0.98;
      const x2 = cx + Math.cos(a + 0.22) * r * 0.68; const y2 = cy + Math.sin(a + 0.22) * r * 0.68;
      g.fillTriangle(cx, cy, x1, y1, x2, y2);
    }
  } else if (acc.pattern === 'rays') {
    // sunburst rays from center
    g.lineStyle(Math.max(2, r * 0.07), sp.color, 0.5);
    const rays = 10;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + 0.2;
      g.lineBetween(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    }
    g.fillStyle(0xffffff, 0.5); g.fillCircle(cx, cy, r * 0.16);
  } else if (acc.pattern === 'constellation') {
    // star dots joined by faint lines
    const pts: Array<[number, number]> = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.7;
      const d = r * (0.3 + ((i * 53) % 45) / 100);
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    }
    g.lineStyle(1.5, sp.color, 0.6);
    for (let i = 0; i < pts.length - 1; i++) g.lineBetween(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    g.fillStyle(sp.color, 0.9);
    for (const [px, py] of pts) g.fillCircle(px, py, Math.max(1.6, r * 0.045));
  } else if (acc.pattern === 'petals') {
    // blossom petals around center
    g.fillStyle(sp.color, 0.5);
    const petals = 6;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      g.fillEllipse(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.5, r * 0.28);
    }
    g.fillStyle(0xffffff, 0.75); g.fillCircle(cx, cy, r * 0.14);
  }

  // Blush (soft, offset)
  const bl = Phaser.Display.Color.HexStringToColor(def.blush);
  g.fillStyle(bl.color, 0.55);
  g.fillEllipse(cx + r * 0.34, cy + r * 0.34, r * 0.5, r * 0.36);
  g.fillStyle(bl.color, 0.4);
  g.fillEllipse(cx - r * 0.4, cy + r * 0.3, r * 0.34, r * 0.26);

  // Gloss highlight (arc reflection, upper-left)
  g.fillStyle(0xffffff, 0.42 * acc.gloss);
  g.fillEllipse(cx - r * 0.36, cy - r * 0.44, r * 0.52, r * 0.3);
  g.fillStyle(0xffffff, 0.65 * acc.gloss);
  g.fillCircle(cx - r * 0.42, cy - r * 0.5, Math.max(1.5, r * 0.09));

  // Rim light (bottom-right warm edge)
  g.lineStyle(Math.max(1.5, r * 0.05), 0xffffff, 0.28);
  g.beginPath(); g.arc(cx, cy, r * 0.9, Math.PI * 0.15, Math.PI * 0.55); g.strokePath();

  // Outline
  g.lineStyle(Math.max(2, r * 0.08), 0x241812, 0.95);
  g.strokeCircle(cx, cy, r * 0.99);

  // Stem + leaf (mythic tiers get a curled golden stem; big fruits a second leaf)
  const mythic = def.tier >= 9 && def.tier < 90;
  if (acc.stem && r >= 18) {
    if (mythic) {
      g.lineStyle(Math.max(2, r * 0.06), 0xe8d45f, 1);
      g.beginPath(); g.arc(cx - r * 0.1, cy - r - r * 0.1, r * 0.22, Math.PI * 0.9, Math.PI * 2.1); g.strokePath();
    } else {
      g.fillStyle(0x4a2f1d, 1);
      g.fillRoundedRect(cx - r * 0.05, cy - r - r * 0.22, r * 0.1, r * 0.3, 2);
    }
    const lf = Phaser.Display.Color.HexStringToColor(def.leaf);
    const lw = r * 0.62, lh = r * 0.3;
    const lx = cx + r * 0.24, ly = cy - r - r * 0.06;
    g.fillStyle(lf.clone().darken(18).color, 1);
    g.fillEllipse(lx, ly + 1.5, lw, lh);
    g.fillStyle(lf.color, 1);
    g.fillEllipse(lx, ly, lw, lh);
    g.lineStyle(1.2, 0x1d3a2a, 0.85);
    g.beginPath(); g.moveTo(lx - lw / 2, ly); g.lineTo(lx + lw / 2, ly); g.strokePath();
    if (r >= 46) {
      // second smaller leaf on the other side for big fruits
      const lx2 = cx - r * 0.3, ly2 = cy - r + r * 0.04;
      g.fillStyle(lf.clone().darken(28).color, 1);
      g.fillEllipse(lx2, ly2 + 1, lw * 0.55, lh * 0.55);
      g.fillStyle(lf.clone().lighten(10).color, 1);
      g.fillEllipse(lx2, ly2, lw * 0.55, lh * 0.55);
    }
  }
  if (def.id === 'starpine') {
    // pineapple crown
    const lf = Phaser.Display.Color.HexStringToColor(def.leaf);
    g.fillStyle(lf.color, 1);
    for (let i = -2; i <= 2; i++) {
      g.fillTriangle(cx + i * r * 0.12 - 6, cy - r - 2, cx + i * r * 0.12 + 6, cy - r - 2, cx + i * r * 0.16, cy - r - r * 0.34);
    }
  }
  if (def.id === 'worldseed') {
    // golden crown of the finale
    g.fillStyle(0xe8d45f, 1);
    const cw = r * 0.5;
    g.fillTriangle(cx - cw, cy - r + 4, cx - cw * 0.6, cy - r - r * 0.22, cx - cw * 0.2, cy - r + 4);
    g.fillTriangle(cx - cw * 0.2, cy - r + 4, cx, cy - r - r * 0.3, cx + cw * 0.2, cy - r + 4);
    g.fillTriangle(cx + cw * 0.2, cy - r + 4, cx + cw * 0.6, cy - r - r * 0.22, cx + cw, cy - r + 4);
    g.fillStyle(0xff5f5f, 1); g.fillCircle(cx, cy - r - r * 0.2, Math.max(2, r * 0.035));
    // cracked cosmic egg: light leaking from cracks
    g.lineStyle(Math.max(2, r * 0.03), 0xffffff, 0.9);
    const cracks: Array<Array<[number, number]>> = [
      [[0.1, -0.5], [0.22, -0.2], [0.12, 0.1], [0.3, 0.4]],
      [[-0.35, -0.3], [-0.25, 0.0], [-0.4, 0.3]],
      [[0.45, -0.1], [0.3, 0.15], [0.42, 0.42]],
    ];
    for (const path of cracks) {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(cx + px * r, cy + py * r); else g.lineTo(cx + px * r, cy + py * r); });
      g.strokePath();
      const [exx, eyy] = path[path.length - 1];
      g.fillStyle(0xfff3b0, 1); g.fillCircle(cx + exx * r, cy + eyy * r, Math.max(2, r * 0.03));
    }
  }
  if (def.id === 'starpine') {
    // second ring of smaller spikes: full star-burst silhouette
    g.fillStyle(sp.color, 0.45);
    for (let i = 0; i < 10; i++) {
      const a = ((i + 0.5) / 10) * Math.PI * 2;
      const x1 = cx + Math.cos(a) * r * 0.86; const y1 = cy + Math.sin(a) * r * 0.86;
      const x2 = cx + Math.cos(a + 0.12) * r * 0.62; const y2 = cy + Math.sin(a + 0.12) * r * 0.62;
      g.fillTriangle(cx, cy, x1, y1, x2, y2);
    }
  }
  if (def.id === 'auroramelon') {
    // aurora skirt: translucent wavy hem below the body
    g.fillStyle(Phaser.Display.Color.HexStringToColor(def.blush).color, 0.4);
    for (let i = -2; i <= 2; i++) {
      g.fillCircle(cx + i * r * 0.34, cy + r * 0.62, r * 0.24);
    }
    g.lineStyle(Math.max(1.5, r * 0.03), 0xffffff, 0.5);
    g.beginPath(); g.arc(cx, cy + r * 0.1, r * 0.78, Math.PI * 0.2, Math.PI * 0.8); g.strokePath();
  }
  if (def.id === 'solarplum') {
    // jagged flame corona rim
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const h = i % 2 ? r * 1.0 : r * 0.9;
      g.fillStyle(i % 2 ? 0xffd94d : 0xf2603d, 0.95);
      g.fillTriangle(
        cx + Math.cos(a - 0.13) * r * 0.82, cy + Math.sin(a - 0.13) * r * 0.82,
        cx + Math.cos(a) * h, cy + Math.sin(a) * h,
        cx + Math.cos(a + 0.13) * r * 0.82, cy + Math.sin(a + 0.13) * r * 0.82);
    }
  }
  if (def.id === 'cosmicfig') {
    // craters + tilted Saturn ring
    g.fillStyle(0x232a5f, 0.8);
    g.fillCircle(cx - r * 0.3, cy - r * 0.15, r * 0.16);
    g.fillCircle(cx + r * 0.25, cy + r * 0.2, r * 0.12);
    g.fillCircle(cx + r * 0.05, cy - r * 0.4, r * 0.09);
    // tilted Saturn ring: back half dim, front half bright
    const ringRx = r * 1.08, ringRy = r * 0.3, ringCy = cy + r * 0.12;
    g.lineStyle(Math.max(2, r * 0.045), 0x5a6ac8, 0.7);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI + (i / 24) * Math.PI;
      const px = cx + Math.cos(a) * ringRx, py = ringCy + Math.sin(a) * ringRy;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
    g.lineStyle(Math.max(2, r * 0.045), 0xe8ecff, 0.9);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      const px = cx + Math.cos(a) * ringRx, py = ringCy + Math.sin(a) * ringRy;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
    g.lineStyle(Math.max(1.2, r * 0.025), 0xe8d45f, 0.7);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      const px = cx + Math.cos(a) * ringRx, py = ringCy + Math.sin(a) * ringRy;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
  }
  if (def.id === 'everbloom') {
    // outer blossom ring beyond the body
    g.fillStyle(Phaser.Display.Color.HexStringToColor(def.blush).color, 0.75);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.fillEllipse(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95, r * 0.4, r * 0.24);
    }
    g.lineStyle(Math.max(1.5, r * 0.03), 0xffffff, 0.6);
    g.strokeCircle(cx, cy, r * 0.98);
  }

  // Face — personality per tier band; `closed` draws the blink variant.
  const faceAlpha = r > 55 ? 0.85 : 1;
  const ex = r * 0.3, ey = r * 0.02;
  const er = Math.max(1.6, Math.min(5, r * 0.075));
  if (closed) {
    // happy closed eyes (blink frame)
    g.lineStyle(Math.max(1.6, er * 0.7), 0x241812, faceAlpha);
    g.beginPath(); g.arc(cx - ex, cy + ey + er * 0.4, er, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
    g.beginPath(); g.arc(cx + ex, cy + ey + er * 0.4, er, Math.PI * 1.1, Math.PI * 1.9); g.strokePath();
  } else if (def.tier >= 8 && def.tier < 90) {
    // sleepy content giants: half-mast lids over dots
    g.fillStyle(0x241812, faceAlpha);
    g.fillCircle(cx - ex, cy + ey, er); g.fillCircle(cx + ex, cy + ey, er);
    g.fillStyle(0xffffff, faceAlpha);
    g.fillCircle(cx - ex + er * 0.3, cy + ey - er * 0.3, er * 0.38);
    g.fillCircle(cx + ex + er * 0.3, cy + ey - er * 0.3, er * 0.38);
    g.lineStyle(Math.max(2, er * 0.55), Phaser.Display.Color.HexStringToColor(def.body).color, 1);
    g.lineBetween(cx - ex - er * 1.2, cy + ey - er * 0.9, cx - ex + er * 1.2, cy + ey - er * 0.9);
    g.lineBetween(cx + ex - er * 1.2, cy + ey - er * 0.9, cx + ex + er * 1.2, cy + ey - er * 0.9);
  } else {
    g.fillStyle(0x241812, faceAlpha);
    g.fillCircle(cx - ex, cy + ey, er); g.fillCircle(cx + ex, cy + ey, er);
    g.fillStyle(0xffffff, faceAlpha);
    g.fillCircle(cx - ex + er * 0.3, cy + ey - er * 0.3, er * 0.38);
    g.fillCircle(cx + ex + er * 0.3, cy + ey - er * 0.3, er * 0.38);
    if (def.tier >= 10 && def.tier < 90) {
      // mythic sparkle eyes: tiny star glints
      g.fillStyle(0xffffff, 1);
      for (const sx of [cx - ex, cx + ex]) {
        const sr = er * 0.9;
        g.fillTriangle(sx - sr * 0.25, cy + ey - er * 1.4, sx + sr * 0.25, cy + ey - er * 1.4, sx, cy + ey - er * 0.6);
      }
    }
    if (def.id === 'ironplum') {
      // angry rivet brows
      g.lineStyle(Math.max(2, er * 0.6), 0x3a3f4a, 1);
      g.lineBetween(cx - ex - er * 1.3, cy + ey - er * 1.6, cx - ex + er * 1.1, cy + ey - er * 0.7);
      g.lineBetween(cx + ex - er * 1.1, cy + ey - er * 0.7, cx + ex + er * 1.3, cy + ey - er * 1.6);
    }
  }
  // Mouths vary by band: open joy (small) / smile (mid) / content (giants)
  g.lineStyle(Math.max(1.4, Math.min(3.4, r * 0.05)), 0x241812, faceAlpha);
  if (r <= 30 && def.tier < 90) {
    g.fillStyle(0x241812, faceAlpha);
    g.fillEllipse(cx, cy + r * 0.24, r * 0.2, r * 0.24);
    g.fillStyle(0xff8f8f, faceAlpha);
    g.fillEllipse(cx, cy + r * 0.32, r * 0.1, r * 0.08);
  } else {
    g.beginPath(); g.arc(cx, cy + r * 0.2, r * (r > 40 ? 0.14 : 0.18), 0.2 * Math.PI, 0.8 * Math.PI); g.strokePath();
  }
  // tier pips for high tiers (non-color cue for accessibility)
  if (def.tier >= 5 && def.tier < 90) {
    g.fillStyle(0xffffff, 0.85);
    const pips = Math.min(4, def.tier - 4);
    for (let i = 0; i < pips; i++) g.fillCircle(cx - (pips - 1) * 6 + i * 12, cy - r * 0.62, 2.4);
  }

  // Special icons
  if (def.special === 'bomb') {
    // fuse + skull tint
    g.lineStyle(2.5, 0x8a6a3a, 1);
    g.beginPath(); g.moveTo(cx, cy - r - 2); g.lineTo(cx + 6, cy - r - 12); g.strokePath();
    g.fillStyle(0xffe9a8, 1); g.fillCircle(cx + 7, cy - r - 13, 3.4);
    g.fillStyle(0x241812, 1);
    g.fillCircle(cx - 6, cy - 2, 3.4); g.fillCircle(cx + 6, cy - 2, 3.4);
    g.fillCircle(cx, cy + 7, 2.2);
  } else if (def.special === 'ice') {
    g.lineStyle(2, 0xffffff, 0.9);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      g.lineBetween(cx - Math.cos(a) * r * 0.5, cy - Math.sin(a) * r * 0.5, cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
    }
  } else if (def.special === 'magnet') {
    g.lineStyle(4, 0xffffff, 0.95);
    g.beginPath(); g.arc(cx, cy + 2, r * 0.32, 0, Math.PI); g.strokePath();
    g.fillStyle(0xff5f5f, 1); g.fillRect(cx - r * 0.32 - 3, cy - 4, 6, 8); g.fillRect(cx + r * 0.32 - 3, cy - 4, 6, 8);
  } else if (def.special === 'rainbow') {
    g.fillStyle(0xffffff, 0.95); g.fillCircle(cx, cy, r * 0.4);
    const cols = [0xff5f5f, 0xf5a94b, 0xe8c832, 0x7bc96f, 0x5aa7e8, 0xb678e8];
    for (let i = 0; i < 6; i++) {
      g.fillStyle(cols[i], 1);
      g.fillCircle(cx + Math.cos((i / 6) * Math.PI * 2) * r * 0.24, cy + Math.sin((i / 6) * Math.PI * 2) * r * 0.24, r * 0.1);
    }
  } else if (def.special === 'golden') {
    g.lineStyle(2, 0xfff3b0, 0.9);
    g.strokeCircle(cx, cy, r * 0.7);
  } else if (def.special === 'rich') {
    // coin medallion: star + rim
    g.lineStyle(2.5, 0x8a6a00, 0.95);
    g.strokeCircle(cx, cy, r * 0.52);
    g.fillStyle(0xfff3b0, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      g.fillTriangle(cx, cy,
        cx + Math.cos(a) * r * 0.34, cy + Math.sin(a) * r * 0.34,
        cx + Math.cos(a2) * r * 0.15, cy + Math.sin(a2) * r * 0.15);
      g.fillTriangle(cx, cy,
        cx + Math.cos(a2) * r * 0.15, cy + Math.sin(a2) * r * 0.15,
        cx + Math.cos(a + Math.PI / 5 * 2) * r * 0.34, cy + Math.sin(a + Math.PI / 5 * 2) * r * 0.34);
    }
  } else if (def.special === 'heavy') {
    // riveted iron bands
    g.lineStyle(Math.max(2, r * 0.09), 0x3a3f4a, 1);
    g.beginPath(); g.arc(cx, cy, r * 0.72, 0, Math.PI * 2); g.strokePath();
    g.fillStyle(0xc6ccd6, 0.95);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillCircle(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72, Math.max(1.6, r * 0.05));
    }
  } else if (def.special === 'ghost') {
    // spooky tail + pale glow
    g.fillStyle(0xffffff, 0.35);
    for (let i = -2; i <= 2; i++) {
      g.fillTriangle(cx + i * r * 0.22 - r * 0.11, cy + r * 0.55, cx + i * r * 0.22 + r * 0.11, cy + r * 0.55, cx + i * r * 0.22, cy + r * 0.85);
    }
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeCircle(cx, cy, r * 0.6);
  }

  g.generateTexture(key, size, size);
  g.destroy();
  cache.add(key);
  return key;
}

export function ensureFruitTexture(scene: Phaser.Scene, def: FruitDef): string {
  return paintFruit(scene, def, fruitTextureKey(def.id), false);
}

export function ensureBlinkTexture(scene: Phaser.Scene, def: FruitDef): string {
  return paintFruit(scene, def, blinkTextureKey(def.id), true);
}

/** Tiny 4-point sparkle for orbiters/trails. Generated once, pooled at runtime. */
export function ensureSparkTexture(scene: Phaser.Scene): string {
  const key = 'fx_spark';
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(7, 0, 9, 7, 5, 7);
  g.fillTriangle(7, 14, 9, 7, 5, 7);
  g.fillTriangle(0, 7, 7, 5, 7, 9);
  g.fillTriangle(14, 7, 7, 5, 7, 9);
  g.fillStyle(0xfff3b0, 1); g.fillCircle(7, 7, 2);
  g.generateTexture(key, 14, 14);
  g.destroy();
  return key;
}
