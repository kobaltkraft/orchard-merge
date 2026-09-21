import Phaser from 'phaser';
import Decimal from 'decimal.js';
import { gameConfig, type GameModeId } from '../config/gameConfig';
import { FRUITS, fruitById, dropPoolClassic } from '../config/fruitConfig';
import { MODES } from '../data/modes';
import { MILESTONES, ACHIEVEMENTS } from '../data/missions';
import { useMeta, coinMult, scoreMult, specialChance } from '../store/meta';
import { audio } from '../audio/AudioManager';
import { ensureFruitTexture, ensureBlinkTexture, ensureSparkTexture, blinkTextureKey, fruitTextureKey, fruitTextureSize } from '../effects/fruitArt';
import { floatText, burst, ring, shake, flash, announce, dust, hitStop, leafJuiceBurst, goldSparkle, snowPuff, crackBurst, magnetTrails } from '../effects/juice';
import { rngFrom, pickWeighted, dailySeed, clamp } from '../utils/Random';
import { fmt, fmtInt } from '../utils/NumberFormat';
import { THEMES } from '../config/graphicsConfig';
import { UI, UI_FONT, NUM_FONT, makeTooltip } from '../ui/theme';
import { pushPanelState } from '../ui/sidePanels';

interface FruitGO extends Phaser.Physics.Matter.Image {
  fruitId: string;
  merging: boolean;
  bornAt: number;
  lastSquash: number;
}

interface Queued { a: FruitGO; b: FruitGO; key: string }

const POWER_DEFS = [
  { id: 'hammer', icon: '🔨', name: 'Hammer', desc: 'Tap a fruit to smash it' },
  { id: 'shuffle', icon: '🔀', name: 'Shuffle', desc: 'Jolt every fruit' },
  { id: 'freeze', icon: '❄️', name: 'Freeze', desc: 'Slow motion 8s' },
  { id: 'magnet', icon: '🧲', name: 'Magnet', desc: 'Tug fruits together' },
  { id: 'prune', icon: '✂️', name: 'Prune', desc: 'Remove smallest +30' },
  { id: 'lucky', icon: '🍀', name: 'Lucky', desc: 'Next drop is huge' },
];

// Shared UI typeface lives in ui/theme (UI_FONT, NUM_FONT).

export class GameScene extends Phaser.Scene {
  mode: GameModeId = 'classic';
  private fruits: FruitGO[] = [];
  private bodyMap = new Map<number, FruitGO>();
  private queue: Queued[] = [];
  private queuedKeys = new Set<string>();
  private score = new Decimal(0);
  private shownScore = 0;
  private coinsEarned = new Decimal(0);
  private chain = 0; private lastMergeAt = 0;
  private dropTargetX = 240; private dropX = 240;
  private currentId = 'seed'; private nextIds: string[] = [];
  private canDrop = true; private over = false;
  private dangerStart = 0; private dangerActive = false;
  private rng: () => number = Math.random;
  private timeLeft = 0; private elapsed = 0;
  private frozenUntil = 0;
  private dblCoins = false; private dblScore = false; private luckyBoost = false; private calmBoost = false;
  private hammerArmed = false; private usedPowerup = false;
  private perfectsThisRun = 0; private mergesThisRun = 0; private bestTierThisRun = 0; private bestChainThisRun = 0;
  private hud!: Record<string, Phaser.GameObjects.Text>;
  private preview!: Phaser.GameObjects.Image;
  private ghost!: Phaser.GameObjects.Image;
  private guide!: Phaser.GameObjects.Graphics;
  private dangerGfx!: Phaser.GameObjects.Graphics;
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private dangerLabel!: Phaser.GameObjects.Text;
  private hammerHint!: Phaser.GameObjects.Text;
  private powerLabels: Record<string, Phaser.GameObjects.Text> = {};
  private powerBgs: Record<string, Phaser.GameObjects.Rectangle> = {};
  private nextImg!: Phaser.GameObjects.Image;
  private nextImg2!: Phaser.GameObjects.Image;
  private nextBadge!: Phaser.GameObjects.Graphics;
  private dangerLevel = 0; // 0 safe, 1 warning (stack near line), 2 critical (countdown)
  private dangerUrgency = 0; // 0..1 as grace runs out — drives pulse speed + glow
  private dropCooldown = 550;
  private dangerY = 230; private jarLeft = 40; private jarRight = 440; private jarTop = 150; private floorTop = 750;
  private dangerAcc = 0; private hudAcc = 0; private dashPhase = 0; private powerLockUntil = 0;
  private lastMoveAt = 0; // pointer recency — brightens the drop guide
  private guideShadow!: Phaser.GameObjects.Ellipse;
  private tutStep = -1; // -1 = off; 0..4 = onboarding steps
  private tutText: Phaser.GameObjects.Text | null = null;
  private tutRing: Phaser.GameObjects.Graphics | null = null;
  private tutSkip: Phaser.GameObjects.Text | null = null;
  private tutMark = 0; // progress marker (drops/merges seen)
  private scoreDirty = true; private coinsDirty = true;
  private quality = 'high';
  private dropsSinceSpecial = 0; // pity timer: forces a special after long droughts
  private nextScoreMarkIdx = 0; // index into the score-milestone ladder
  private lastMergeTier = 0; // widens the combo window after huge merges
  private runStartBestTier = 0; // lifetime best at run start (for discovery celebration)
  private runStartBestScore = 0; // lifetime best score at run start (mid-run fanfare)
  private passedBest = false;
  private blinkAcc = 0;
  private blinking: Array<{ f: FruitGO; until: number }> = [];
  private breathers: Array<{ f: FruitGO; phase: number }> = [];
  private breathAcc = 0;
  private orbitPool: Phaser.GameObjects.Image[] = [];
  private orbiters: Map<number, Phaser.GameObjects.Image[]> = new Map();
  private coachText!: Phaser.GameObjects.Text;
  private powerTip: { show: (x: number, y: number, msg: string) => void; hide: () => void; destroy: () => void } | null = null;
  private cooldownGfx!: Phaser.GameObjects.Graphics;
  private lastPowerId = '';
  private cooldownMs = 800;

  constructor() { super('game'); }

  init(data: { mode?: GameModeId }): void {
    this.mode = data.mode ?? 'classic';
    this.fruits = []; this.bodyMap.clear(); this.queue = []; this.queuedKeys.clear();
    this.score = new Decimal(0); this.shownScore = 0; this.coinsEarned = new Decimal(0);
    this.chain = 0; this.lastMergeAt = 0; this.over = false;
    this.dangerStart = 0; this.dangerActive = false; this.elapsed = 0;
    this.frozenUntil = 0; this.hammerArmed = false; this.usedPowerup = false;
    this.perfectsThisRun = 0; this.mergesThisRun = 0; this.bestTierThisRun = 0; this.bestChainThisRun = 0;
    this.dropX = 240; this.dropTargetX = 240; this.canDrop = true;
    this.dangerAcc = 0; this.hudAcc = 0; this.powerLockUntil = 0;
    this.scoreDirty = true; this.coinsDirty = true;
    this.powerLabels = {}; this.powerBgs = {};
    this.dropsSinceSpecial = 0; this.nextScoreMarkIdx = 0; this.lastMergeTier = 0; this.blinkAcc = 0; this.blinking = [];
    this.passedBest = false;
    this.breathers = []; this.breathAcc = 0; this.orbitPool = []; this.orbiters = new Map();
    const seed = this.mode === 'daily' ? dailySeed() : `run-${Date.now()}-${Math.random()}`;
    this.rng = rngFrom(seed);
  }

  create(): void {
    const st = useMeta.getState();
    this.quality = st.settings.quality;
    audio.ensure();
    audio.applySettings(st.settings);
    audio.crossfade(this.mode === 'fountain' ? 'fountain' : 'game');
    this.runStartBestTier = st.stats.bestTier;
    this.runStartBestScore = st.stats.bestScore;

    const mode = MODES.find(m => m.id === this.mode)!;
    const W = gameConfig.width; const H = gameConfig.height;
    const cw = gameConfig.container.width * mode.widthMul;
    const cx = W / 2;
    const left = cx - cw / 2; const top = gameConfig.container.top;
    this.jarLeft = left; this.jarRight = left + cw; this.jarTop = top;
    this.floorTop = top + gameConfig.container.height;
    this.dropX = cx; this.dropTargetX = cx;

    // ---- backdrop: theme gradient + vignette + ambient motes ----
    const theme = THEMES.find(t => t.id === st.equipped.theme) ?? THEMES[0];
    this.cameras.main.setBackgroundColor(theme.bg0);
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(
      Phaser.Display.Color.HexStringToColor(theme.bg1).color, Phaser.Display.Color.HexStringToColor(theme.bg1).color,
      Phaser.Display.Color.HexStringToColor(theme.bg0).color, Phaser.Display.Color.HexStringToColor(theme.bg0).color, 1);
    bg.fillRect(0, 0, W, H);
    // soft radial glow behind jar
    bg.fillStyle(theme.accent as number, 0.07);
    bg.fillEllipse(cx, top + 320, cw + 120, 560);
    // moon glow top-center + faint side lights for depth
    bg.fillStyle(0xfff6d8, 0.05);
    bg.fillCircle(cx, -60, 150);
    bg.fillStyle(theme.accent as number, 0.05);
    bg.fillCircle(-40, H * 0.35, 110);
    bg.fillCircle(W + 40, H * 0.55, 130);
    // distant grove hills behind the jar (very dark, subdued)
    bg.fillStyle(0x000000, 0.28);
    bg.fillEllipse(cx - 190, H + 40, 420, 190);
    bg.fillEllipse(cx + 200, H + 60, 460, 210);
    bg.fillStyle(theme.accent as number, 0.05);
    bg.fillEllipse(cx - 190, H + 30, 420, 190);
    bg.fillEllipse(cx + 200, H + 50, 460, 210);
    // ambient motes (pooled, drifting)
    const motes = this.quality === 'low' ? 8 : this.quality === 'medium' ? 14 : 20;
    for (let i = 0; i < motes; i++) {
      const m = this.add.circle(this.rng() * W, this.rng() * H, 1 + this.rng() * 2.5, theme.accent as number, 0.14).setDepth(0);
      this.tweens.add({ targets: m, y: m.y - 24 - this.rng() * 30, x: m.x + (this.rng() - 0.5) * 24, duration: 2800 + this.rng() * 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: this.rng() * 2000 });
    }

    // ---- physics world (tuned iterations for 60fps) ----
    this.matter.world.setBounds(0, 0, W, H + 200);
    this.matter.world.engine.positionIterations = 6;
    this.matter.world.engine.velocityIterations = 4;
    this.matter.world.engine.enableSleeping = true;
    this.matter.world.setGravity(0, 1 * mode.gravityMul);

    const wallOpts = { isStatic: true, friction: 0.1, restitution: 0.05, label: 'wall' };
    this.matter.add.rectangle(left - 7, top + gameConfig.container.height / 2, 14, gameConfig.container.height + 40, wallOpts);
    this.matter.add.rectangle(left + cw + 7, top + gameConfig.container.height / 2, 14, gameConfig.container.height + 40, wallOpts);
    this.matter.add.rectangle(cx, this.floorTop + 7, cw + 40, 14, { isStatic: true, friction: 0.5, restitution: 0.05, label: 'floor' });

    this.drawArena(left, top, cw, theme.accent as number);

    // ---- danger line ----
    const safeBonus = (st.upgrades['safe_height'] ?? 0) * 8;
    this.dangerY = gameConfig.dangerY - safeBonus;
    this.zoneGfx = this.add.graphics().setDepth(1);
    this.dangerGfx = this.add.graphics().setDepth(6);
    this.dangerLabel = this.add.text(left + 10, this.dangerY - 26, 'DANGER', { fontSize: '12px', color: '#ff8f8f', fontStyle: 'bold', fontFamily: UI_FONT }).setDepth(6).setAlpha(0.38);

    // ---- collisions ----
    this.matter.world.on('collisionstart', (ev: { pairs: Array<{ bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }> }) => {
      for (const p of ev.pairs) this.onCollide(p.bodyA, p.bodyB);
    });

    // ---- run flags from boosts ----
    this.dblCoins = !!st.boosts['coins25'];
    this.dblScore = !!st.boosts['score50'];
    this.luckyBoost = !!st.boosts['luck'];
    this.calmBoost = !!st.boosts['calm'];

    // ---- drop queue ----
    this.dropCooldown = Math.max(220, gameConfig.dropCooldownMs * (1 - (st.upgrades['drop_speed'] ?? 0) * 0.08));
    const previewCount = 1 + (st.upgrades['preview'] ?? 0);
    this.nextIds = [];
    for (let i = 0; i < Math.max(2, previewCount + 1); i++) this.nextIds.push(this.rollDrop(mode));
    this.currentId = this.nextIds.shift()!;

    // ---- guide + preview + landing ghost (below HUD bar) ----
    this.guide = this.add.graphics().setDepth(2);
    this.ghost = this.add.image(this.dropX, 300, fruitTextureKey(this.currentId)).setAlpha(0.22).setDepth(2);
    this.preview = this.add.image(this.dropX, 122, fruitTextureKey(this.currentId)).setAlpha(0.95).setDepth(4);
    this.guideShadow = this.add.ellipse(this.dropX, 150, 40, 10, 0x000000, 0.3).setDepth(2);

    this.buildHud(mode);
    this.drawPowerBar();
    this.powerTip = makeTooltip(this);
    this.cooldownGfx = this.add.graphics().setDepth(12);
    this.updatePreviewTexture();
    this.refreshHud(true);

    // ---- input: immediate 1:1 aim follow + drop ----
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.dropTargetX = this.clampDrop(p.x);
      this.dropX = this.dropTargetX;
      this.lastMoveAt = this.time.now;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.ensure();
      this.dropTargetX = this.clampDrop(p.x);
      this.dropX = this.dropTargetX;
      this.lastMoveAt = this.time.now;
      if (this.hammerArmed) { this.tryHammer(p); return; }
      this.tryDrop();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.tryDrop());
    this.input.keyboard?.on('keydown-LEFT', () => { this.dropTargetX = this.clampDrop(this.dropTargetX - 22); this.lastMoveAt = this.time.now; });
    this.input.keyboard?.on('keydown-RIGHT', () => { this.dropTargetX = this.clampDrop(this.dropTargetX + 22); this.lastMoveAt = this.time.now; });
    this.input.keyboard?.on('keydown-P', () => this.openPause());
    this.input.keyboard?.on('keydown-ESC', () => this.openPause());
    this.input.keyboard?.on('keydown-M', () => this.toggleMute());
    this.input.keyboard?.on('keydown-ONE', () => this.usePowerIndexed(0));
    this.input.keyboard?.on('keydown-TWO', () => this.usePowerIndexed(1));
    this.input.keyboard?.on('keydown-THREE', () => this.usePowerIndexed(2));
    this.input.keyboard?.on('keydown-FOUR', () => this.usePowerIndexed(3));
    this.input.keyboard?.on('keydown-FIVE', () => this.usePowerIndexed(4));
    this.input.keyboard?.on('keydown-SIX', () => this.usePowerIndexed(5));

    if (mode.timeLimit) this.timeLeft = mode.timeLimit;
    st.bump(s => ({ stats: { ...s.stats, games: s.stats.games + 1 } }));
    audio.play('start');

    if (!st.seen.tutorial) {
      this.startTutorial();
    }
    this.cameras.main.fadeIn(280, 6, 13, 9);
  }

  private startTutorial(): void {
    this.tutStep = 0;
    this.tutMark = 0;
    this.tutRing = this.add.graphics().setDepth(75);
    this.tutText = this.add.text(240, 640, '', {
      fontSize: '16px', color: '#fff8e8', fontFamily: UI_FONT, fontStyle: 'bold', align: 'center',
      backgroundColor: '#0a140e', padding: { x: 14, y: 10 }, wordWrap: { width: 380 },
    }).setOrigin(0.5).setDepth(76);
    this.tutSkip = this.add.text(240, 700, 'SKIP TUTORIAL', { fontSize: '13px', color: UI.muted, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5).setDepth(76).setInteractive({ useHandCursor: true });
    this.tutSkip.on('pointerdown', () => this.endTutorial());
    this.renderTutStep();
  }

  private renderTutStep(): void {
    if (!this.tutText || !this.tutRing) return;
    const msgs = [
      '👆 1/5 — Move to aim the fruit',
      '👇 2/5 — Tap or press SPACE to drop',
      '🍎 3/5 — Match two alike to merge!',
      '⚠ 4/5 — Keep the stack BELOW the danger line',
      '🔨 5/5 — Boosts live down here. Spend wisely!',
    ];
    this.tutText.setText(msgs[this.tutStep] ?? '');
    this.tutRing.clear();
    if (this.tutStep === 0) {
      this.tutRing.lineStyle(3, 0x9ef0c8, 0.9);
      this.tutRing.strokeRoundedRect(this.jarLeft + 40, 100, this.jarRight - this.jarLeft - 80, 60, 10);
    } else if (this.tutStep === 3) {
      this.tutRing.lineStyle(3, 0xff6b6b, 0.9);
      this.tutRing.strokeRoundedRect(this.jarLeft + 10, this.dangerY - 34, this.jarRight - this.jarLeft - 20, 44, 8);
    } else if (this.tutStep === 4) {
      this.tutRing.lineStyle(3, 0xffd97a, 0.9);
      this.tutRing.strokeRoundedRect(14, 700, 452, 84, 12);
    }
  }

  private endTutorial(): void {
    this.tutStep = -1;
    try { this.tutText?.destroy(); this.tutRing?.destroy(); this.tutSkip?.destroy(); } catch { /* ignore */ }
    this.tutText = null; this.tutRing = null; this.tutSkip = null;
    useMeta.getState().bump(s => ({ seen: { ...s.seen, tutorial: true } }));
  }

  private updateTutorial(): void {
    if (this.tutStep < 0) return;
    if (this.tutStep === 0 && Math.abs(this.dropX - 240) > 60) { this.tutStep = 1; this.tutMark = this.mergesThisRun + this.fruits.length; this.renderTutStep(); }
    else if (this.tutStep === 1 && (this.mergesThisRun + this.fruits.length) > this.tutMark) { this.tutStep = 2; this.tutMark = this.mergesThisRun; this.renderTutStep(); }
    else if (this.tutStep === 2 && this.mergesThisRun > this.tutMark) {
      const owned = POWER_DEFS.reduce((a, d) => a + (useMeta.getState().powerups[d.id] ?? 0), 0);
      this.tutStep = 3; this.tutMark = this.time.now;
      void owned;
      this.renderTutStep();
    }
    else if (this.tutStep === 3 && this.time.now - this.tutMark > 4500) {
      const owned = POWER_DEFS.reduce((a, d) => a + (useMeta.getState().powerups[d.id] ?? 0), 0);
      if (owned > 0) { this.tutStep = 4; this.tutMark = useMeta.getState().stats.powerupsUsed; this.renderTutStep(); }
      else this.endTutorial();
    }
    else if (this.tutStep === 4 && useMeta.getState().stats.powerupsUsed > this.tutMark) this.endTutorial();
  }

  private clampDrop(x: number): number {
    const def = fruitById(this.currentId);
    const r = def?.radius ?? 20;
    return clamp(x, this.jarLeft + r + 4, this.jarRight - r - 4);
  }

  private drawArena(left: number, top: number, cw: number, accent: number): void {
    const H = gameConfig.container.height;
    const bot = this.floorTop;
    // outer drop shadow (grounds the jar)
    const sh = this.add.graphics().setDepth(0);
    sh.fillStyle(0x000000, 0.35);
    sh.fillRoundedRect(left - 20, top - 6, cw + 40, H + 26, 14);
    // soft ground shadow beneath the jar
    sh.fillStyle(0x000000, 0.3);
    sh.fillEllipse(left + cw / 2, bot + 26, cw * 0.9, 22);
    // jar glass
    const glass = this.add.graphics().setDepth(1);
    glass.fillStyle(0xffffff, 0.045); glass.fillRect(left, top, cw, H);
    glass.fillStyle(0xffffff, 0.06); glass.fillRect(left, top, 10, H); // left sheen
    // diagonal glass reflection streak
    glass.fillStyle(0xffffff, 0.05);
    glass.fillTriangle(left + cw * 0.18, top, left + cw * 0.34, top, left + cw * 0.1, bot);
    glass.fillTriangle(left + cw * 0.34, top, left + cw * 0.4, top, left + cw * 0.16, bot);
    glass.fillStyle(0x000000, 0.12); glass.fillRect(left + cw - 12, top, 12, H); // right inner shadow
    glass.fillStyle(0x000000, 0.14); glass.fillRect(left, top, cw, 14); // top inner shadow
    // faint orchard scenery behind the glass (never covers fruit)
    glass.fillStyle(0x1d3a2a, 0.5);
    glass.fillEllipse(left + cw * 0.2, bot - 30, cw * 0.55, 90);
    glass.fillEllipse(left + cw * 0.82, bot - 20, cw * 0.45, 70);
    glass.fillStyle(0x7bc96f, 0.1);
    for (let i = 0; i < 5; i++) {
      const tx = left + cw * (0.12 + i * 0.19);
      glass.fillCircle(tx, bot - 44 - (i % 2) * 12, 7);
      glass.fillRect(tx - 1.5, bot - 44 - (i % 2) * 12, 3, 16);
    }
    // empty-state interior: bottom glow + faint arcs + wall measure ticks
    glass.fillStyle(0xfff6d8, 0.05);
    glass.fillEllipse(left + cw / 2, bot - 26, cw * 0.8, 60);
    glass.lineStyle(2, 0xffffff, 0.055);
    for (let i = 0; i < 3; i++) {
      glass.beginPath();
      glass.arc(left + cw / 2, bot + 60, 120 + i * 46, Math.PI * 1.15, Math.PI * 1.85);
      glass.strokePath();
    }
    glass.lineStyle(2, 0xffffff, 0.09); // measure ticks, right wall
    for (let y = top + 60; y < bot - 40; y += 52) {
      glass.lineBetween(left + cw - 16, y, left + cw - 5, y);
    }
    // floor: wooden plank surface with seam, grain + front 3D edge
    const rim = this.add.graphics().setDepth(5);
    rim.fillStyle(0x4a2f1d, 1); rim.fillRoundedRect(left - 16, bot, cw + 32, 15, 6);
    rim.fillStyle(0x8a6b46, 1); rim.fillRoundedRect(left - 16, bot, cw + 32, 5, 2);
    rim.lineStyle(1, 0xc9a06a, 0.5); // grain highlights
    rim.lineBetween(left - 10, bot + 7, left + cw * 0.3 - 20, bot + 6);
    rim.lineBetween(left + cw * 0.4 - 10, bot + 9, left + cw + 6, bot + 8);
    rim.lineStyle(1.5, 0x2e1c10, 0.8); // plank seams
    rim.lineBetween(left + cw * 0.33 - 16, bot + 2, left + cw * 0.33 - 16, bot + 13);
    rim.lineBetween(left + cw * 0.7 - 16, bot + 2, left + cw * 0.7 - 16, bot + 13);
    rim.fillStyle(0x2e1c10, 1); rim.fillRoundedRect(left - 16, bot + 13, cw + 32, 5, 2); // front face
    // walls: two-tone posts with rounded top caps + grain
    rim.fillStyle(0x6b4a2f, 1);
    rim.fillRoundedRect(left - 16, top - 10, 15, H + 10, 6);
    rim.fillRoundedRect(left + cw + 1, top - 10, 15, H + 10, 6);
    rim.fillStyle(0x8a6b46, 1); // inner edge highlight
    rim.fillRoundedRect(left - 4, top - 10, 4, H + 10, 2);
    rim.fillRoundedRect(left + cw + 1, top - 10, 4, H + 10, 2);
    rim.lineStyle(1, 0x4a2f1d, 0.6); // post grain
    for (let gy = top + 20; gy < bot - 10; gy += 44) {
      rim.lineBetween(left - 13, gy, left - 4, gy + 6);
      rim.lineBetween(left + cw + 4, gy + 6, left + cw + 13, gy);
    }
    rim.fillStyle(0xc9a06a, 1); // top caps catch the light
    rim.fillCircle(left - 8.5, top - 10, 7.5);
    rim.fillCircle(left + cw + 8.5, top - 10, 7.5);
    // wall accent light
    rim.lineStyle(2, accent, 0.5);
    rim.lineBetween(left - 9, top + 12, left - 9, bot);
    rim.lineBetween(left + cw + 9, top + 12, left + cw + 9, bot);
    void accent;
  }

  private buildHud(mode: { name: string; timeLimit?: number }): void {
    const W = gameConfig.width;
    const bar = this.add.graphics().setDepth(9);
    bar.fillStyle(0x060d09, 0.88); bar.fillRect(0, 0, W, 96);
    bar.lineStyle(1, 0x7bc96f, 0.3); bar.lineBetween(0, 96, W, 96);
    bar.fillStyle(0x7bc96f, 0.06); bar.fillRect(0, 0, W, 3); // top light edge
    const label = { fontSize: '11px', color: '#9ec8a8', fontStyle: 'bold' as const, fontFamily: UI_FONT };
    this.hud = {
      scoreLabel: this.add.text(12, 4, 'SCORE', label).setDepth(10),
      score: this.add.text(12, 16, '0', { fontSize: '40px', color: '#fff8e8', fontStyle: 'bold', fontFamily: NUM_FONT }).setDepth(10),
      coins: this.add.text(14, 62, '🪙 +0', { fontSize: '15px', color: '#ffd97a', fontStyle: 'bold', fontFamily: NUM_FONT }).setDepth(10),
      best: this.add.text(14, 84, '', { fontSize: '11px', color: UI.faint, fontFamily: UI_FONT }).setDepth(10),
      nextLabel: this.add.text(W - 64, 4, 'NEXT', label).setOrigin(0.5, 0).setDepth(10),
      mode: this.add.text(W / 2, 6, mode.name.toUpperCase(), { fontSize: '12px', color: '#0e1f16', fontStyle: 'bold', fontFamily: UI_FONT, backgroundColor: '#7bc96f', padding: { x: 8, y: 2 } }).setOrigin(0.5, 0).setDepth(10),
      timer: this.add.text(W / 2, 30, '', { fontSize: '20px', color: '#ffe9a8', fontStyle: 'bold', fontFamily: NUM_FONT }).setOrigin(0.5, 0).setDepth(10),
    };
    const best = useMeta.getState().stats.bestScore;
    if (best > 0) this.hud.best.setText(`BEST ${best.toLocaleString('en-US')}`);
    // NEXT badge: framed circular container, clearly part of the HUD
    this.nextBadge = this.add.graphics().setDepth(9);
    this.drawNextBadge(0.65);
    this.nextImg = this.add.image(W - 64, 54, fruitTextureKey(this.currentId)).setDepth(10);
    this.nextImg2 = this.add.image(W - 30, 78, fruitTextureKey(this.currentId)).setDepth(10).setAlpha(0.85);
    // pause (home lives in the pause menu — keeps the header clean). 44px target.
    const bg = this.add.circle(W - 26, 26, 22, 0x1d3a2a, 0.95).setStrokeStyle(2, 0x7bc96f, 0.6).setDepth(10).setInteractive({ useHandCursor: true });
    const t = this.add.text(W - 26, 26, '⏸', { fontSize: '20px' }).setOrigin(0.5).setDepth(11);
    bg.on('pointerover', () => bg.setScale(1.12));
    bg.on('pointerout', () => bg.setScale(1));
    bg.on('pointerdown', () => { audio.play('click'); this.openPause(); });
    void t;
    this.hammerHint = this.add.text(W / 2, 560, '', { fontSize: '16px', color: '#ffe9a8', fontStyle: 'bold', fontFamily: UI_FONT, stroke: '#0a140e', strokeThickness: 4 }).setOrigin(0.5).setDepth(10).setAlpha(0);
  }

  private drawNextBadge(alpha: number): void {
    const g = this.nextBadge;
    g.clear();
    const bx = gameConfig.width - 64; const by = 54;
    // polished circular wooden frame with leafy inner ring
    g.fillStyle(0x000000, 0.45); g.fillCircle(bx, by, 34);
    g.fillStyle(UI.woodDark, 1); g.fillCircle(bx, by, 33);
    g.fillStyle(UI.wood, 1); g.fillCircle(bx, by, 30);
    g.lineStyle(2, UI.woodLight, 0.9); g.strokeCircle(bx, by, 29);
    g.fillStyle(0x1d3a2a, 0.95); g.fillCircle(bx, by, 26);
    g.lineStyle(2, 0x7bc96f, alpha); g.strokeCircle(bx, by, 26);
    g.lineStyle(1, 0xffffff, 0.18); g.strokeCircle(bx, by, 22);
    // wood highlight tick
    g.lineStyle(2, 0xffffff, 0.3);
    g.beginPath(); g.arc(bx, by, 31, Math.PI * 1.1, Math.PI * 1.35); g.strokePath();
  }

  private drawPowerBar(): void {
    const H = gameConfig.height;
    const top = H - 88;
    // one unified control panel with rounded top — part of the game, not an overlay
    const bg = this.add.graphics().setDepth(9);
    bg.fillStyle(0x060d09, 0.92);
    bg.fillRoundedRect(8, top, gameConfig.width - 16, 80, { tl: 14, tr: 14, bl: 0, br: 0 });
    bg.lineStyle(1.5, 0x7bc96f, 0.4);
    bg.strokeRoundedRect(8, top, gameConfig.width - 16, 80, { tl: 14, tr: 14, bl: 0, br: 0 });
    bg.fillStyle(0x7bc96f, 0.08); bg.fillRect(8, top + 2, gameConfig.width - 16, 2);
    POWER_DEFS.forEach((d, i) => {
      const st = useMeta.getState();
      const n = st.powerups[d.id] ?? 0;
      const owned = n > 0;
      const x = 48 + i * 68; const y = top + 42;
      const rect = this.add.rectangle(x, y, 66, 70, owned ? 0x24543a : 0x1d3a2a, 0.97).setStrokeStyle(2.5, owned ? 0x9ef0c8 : 0x7bc96f, owned ? 0.9 : 0.22).setDepth(10).setInteractive({ useHandCursor: true });
      if (!owned) rect.setAlpha(0.45);
      this.add.text(x, y - 21, d.icon, { fontSize: '26px' }).setOrigin(0.5).setDepth(11);
      this.add.text(x, y + 7, d.name.toUpperCase(), { fontSize: '9px', color: owned ? '#eaffdf' : '#8aa892', fontStyle: 'bold', fontFamily: UI_FONT }).setOrigin(0.5).setDepth(11);
      const c = this.add.text(x + 24, y - 27, `×${n}`, { fontSize: '13px', color: '#0e1f16', fontStyle: 'bold', fontFamily: UI_FONT, backgroundColor: owned ? '#ffd97a' : '#5a6a5a', padding: { x: 4, y: 1 } }).setOrigin(0.5).setDepth(11);
      this.powerBgs[d.id] = rect; this.powerLabels[d.id] = c;
      rect.on('pointerover', () => {
        if ((useMeta.getState().powerups[d.id] ?? 0) > 0) rect.setScale(1.07);
        this.powerTip?.show(x, y - 62, `${d.icon} ${d.name} (×${useMeta.getState().powerups[d.id] ?? 0})\n${d.desc}`);
      });
      rect.on('pointerout', () => { rect.setScale(1); this.powerTip?.hide(); });
      rect.on('pointerdown', () => {
        this.tweens.add({ targets: rect, scaleX: 0.9, scaleY: 0.9, duration: 70, yoyo: true });
        this.powerTip?.hide();
        try {
          if (window.matchMedia('(pointer: coarse)').matches) floatText(this, x, y - 52, d.name, '#eaffdf', 14, 800);
        } catch { /* ignore */ }
        this.usePower(d.id, x, y);
      });
    });
    // first-use coach hint (per run until the first powerup is spent)
    this.coachText = this.add.text(240, top - 22, '👆 TAP A BOOST TO USE IT', { fontSize: '15px', color: '#ffe9a8', fontStyle: 'bold', fontFamily: UI_FONT, stroke: '#0a140e', strokeThickness: 4 }).setOrigin(0.5).setDepth(11).setAlpha(0);
  }

  private openPause(): void {
    if (this.over || !this.scene.isActive('game')) return;
    audio.play('click');
    this.scene.pause('game');
    this.scene.launch('pause', { mode: this.mode, score: Math.floor(this.score.toNumber()), elapsed: this.elapsed });
  }

  /** Master mute toggle (M key): flips settings.muted, preserving volume levels. */
  private toggleMute(): void {
    const s = useMeta.getState();
    const next = !s.settings.muted;
    s.setSetting('muted', next);
    audio.setMuted(next);
    floatText(this, 240, 300, next ? '🔇 Muted (M)' : '🔊 Sound on', '#eaffdf', 16, 800);
  }

  private rollDrop(mode: { poolCap: number; specialMul: number }): string {
    const st = useMeta.getState();
    const chance = specialChance(st) * mode.specialMul + (this.luckyBoost ? 0.008 : 0);
    // pity timer: no one should wait forever for a little magic
    if (this.dropsSinceSpecial >= 60 || this.rng() < chance) {
      this.dropsSinceSpecial = 0;
      const pool = ['bombfruit', 'icefruit', 'magnetfruit', 'prismfruit', 'goldenapple', 'ironplum', 'chronoberry', 'ghostgrape'];
      return pool[Math.floor(this.rng() * pool.length)];
    }
    this.dropsSinceSpecial++;
    const luck = st.upgrades['luck'] ?? 0;
    const unlocked = new Set(st.unlockedFruits);
    const pool = (dropPoolClassic as readonly string[]).slice(0, mode.poolCap).filter(id => unlocked.has(id) || ['seed', 'sproutpea', 'dewberry'].includes(id));
    const weights = pool.map((id, i) => {
      const base = [34, 28, 20, 12, 6, 4][i] ?? 5;
      return base * (1 - luck * 0.03) + (i >= 3 ? luck * 1.6 : 0);
    });
    return pickWeighted(this.rng, pool, weights);
  }

  private updatePreviewTexture(): void {
    const def = fruitById(this.currentId);
    if (!def) return;
    ensureFruitTexture(this, def);
    const key = fruitTextureKey(def.id);
    // Preview renders at true landing size — what you see is what drops.
    const native = fruitTextureSize(def.radius);
    this.preview.setTexture(key);
    this.preview.setDisplaySize(native, native);
    // Landing ghost stays true-size — it marks the real footprint.
    this.ghost.setTexture(key);
    this.ghost.setDisplaySize(native, native);
    this.nextImg.setTexture(fruitTextureKey(this.nextIds[0] ?? this.currentId));
    const n0 = fruitById(this.nextIds[0]);
    const s0 = n0 ? Math.min(54, n0.radius * 2) : 40;
    this.nextImg.setDisplaySize(s0, s0);
    // pop when the queue advances
    if (!useMeta.getState().settings.reducedMotion) {
      const bx = this.nextImg.scaleX; const by = this.nextImg.scaleY;
      this.tweens.killTweensOf(this.nextImg);
      this.nextImg.setScale(bx * 1.28, by * 1.28);
      this.tweens.add({ targets: this.nextImg, scaleX: bx, scaleY: by, duration: 200, ease: 'Back.easeOut' });
      this.drawNextBadge(1);
      this.time.delayedCall(220, () => this.drawNextBadge(0.65));
    }
    const n1id = this.nextIds[1];
    if (n1id && (useMeta.getState().upgrades['preview'] ?? 0) > 0) {
      const n1 = fruitById(n1id);
      const s1 = n1 ? Math.min(30, n1.radius * 2) : 24;
      this.nextImg2.setVisible(true).setTexture(fruitTextureKey(n1id));
      this.nextImg2.setDisplaySize(s1, s1);
    } else {
      this.nextImg2.setVisible(false);
    }
  }

  private tryDrop(): void {
    if (!this.canDrop || this.over) return;
    const st = useMeta.getState();
    const def = fruitById(this.currentId);
    if (!def) return;
    ensureFruitTexture(this, def);
    const mode = MODES.find(m => m.id === this.mode)!;
    this.canDrop = false;
    audio.play('drop'); audio.play('spawn', { pitch: 0.9 + def.tier * 0.04 }); audio.buzz(8);
    const img = this.matter.add.image(this.dropX, 118, fruitTextureKey(def.id), undefined, {
      shape: { type: 'circle', radius: def.radius },
      restitution: def.restitution, friction: def.friction, frictionStatic: def.frictionStatic, frictionAir: def.frictionAir,
      density: def.density, label: 'fruit',
    }) as FruitGO;
    // NOTE: texture is native size (fruit circle == physics radius). No setDisplaySize shrink.
    (img.body as MatterJS.BodyType).label = `fruit:${def.id}`;
    img.fruitId = def.id; img.merging = false; img.bornAt = this.time.now; img.lastSquash = 0;
    img.setDepth(3);
    img.setAngularVelocity((this.rng() - 0.5) * 0.04);
    this.fruits.push(img);
    const bodyId = (img.body as unknown as { id: number }).id;
    this.bodyMap.set(bodyId, img);
    if (!st.settings.reducedMotion) {
      img.setScale(1.14, 0.86);
      this.tweens.add({ targets: img, scaleX: 1, scaleY: 1, duration: 170, ease: 'Back.easeOut' });
    }
    this.preview.setAlpha(0.3);
    st.bump(s => ({ stats: { ...s.stats, dropped: s.stats.dropped + 1 } }));
    if (def.special) {
      st.bump(s => ({ stats: { ...s.stats, specialsSeen: [...new Set([...s.stats.specialsSeen, def.id])] } }));
    }
    if (def.id === 'chronoberry') this.time.delayedCall(600, () => this.triggerIce(10000));
    else if (def.special === 'ice') this.time.delayedCall(600, () => this.triggerIce());
    if (def.special === 'magnet') this.time.delayedCall(600, () => this.triggerMagnet(img));
    if (def.special === 'bomb') this.time.delayedCall(700, () => this.triggerBomb(img));
    if (def.special === 'rich') this.time.delayedCall(600, () => this.triggerGolden(img));
    if (def.special === 'ghost') this.time.delayedCall(100, () => this.triggerGhost(img));
    if (this.fruits.length > gameConfig.maxBodies) {
      const small = [...this.fruits].filter(f => !f.merging).sort((a, b) => (fruitById(a.fruitId)?.radius ?? 99) - (fruitById(b.fruitId)?.radius ?? 99))[0];
      if (small) { dust(this, small.x, small.y, 4); this.removeFruit(small, false); }
    }
    this.currentId = this.nextIds.shift()!;
    this.nextIds.push(this.rollDrop(mode));
    if (st.powerups['luckyNext']) { this.currentId = 'emberpeach'; st.bump(s => ({ powerups: { ...s.powerups, luckyNext: 0 } })); }
    this.dropTargetX = this.clampDrop(this.dropTargetX);
    this.updatePreviewTexture();
    this.time.delayedCall(this.dropCooldown, () => { this.canDrop = true; this.preview.setAlpha(0.95); audio.play('spawn', { pitch: 1.1 }); });
    this.coinsDirty = true;
  }

  private bodyOf(o: unknown): FruitGO | undefined {
    const id = (o as { id?: number })?.id;
    if (typeof id === 'number') return this.bodyMap.get(id);
    return undefined;
  }

  private onCollide(a: MatterJS.BodyType, b: MatterJS.BodyType): void {
    if (this.over) return;
    const A = this.bodyOf(a); const B = this.bodyOf(b);
    // landing squash + sound for fruit hitting floor / hard fruit impact
    if (A && !B && b.label === 'floor') this.landFx(A);
    else if (B && !A && a.label === 'floor') this.landFx(B);
    else if (A && B && !A.merging && !B.merging) {
      const rvx = Math.abs((a as unknown as { velocity: { x: number } }).velocity.x - (b as unknown as { velocity: { x: number } }).velocity.x);
      const rvy = Math.abs((a as unknown as { velocity: { y: number } }).velocity.y - (b as unknown as { velocity: { y: number } }).velocity.y);
      if (rvx + rvy > 5.5) {
        this.squash(A); this.squash(B);
        audio.play('bounce', { pitch: 0.85 + Math.random() * 0.3 });
      }
    }
    if (!A || !B || A === B || A.merging || B.merging) return;
    // Rainbow wild: prism merges with anything (consumes prism, upgrades partner)
    if (A.fruitId === 'prismfruit' || B.fruitId === 'prismfruit') {
      const prism = A.fruitId === 'prismfruit' ? A : B;
      const other = prism === A ? B : A;
      if (other.merging || prism.merging) return;
      const odef = fruitById(other.fruitId);
      if (!odef || odef.tier >= 90) return;
      const idx = FRUITS.findIndex(f => f.id === odef.id);
      if (idx < 0 || idx + 1 >= FRUITS.length) return;
      this.enqueueMerge(prism, other);
      return;
    }
    if (A.fruitId !== B.fruitId) return;
    const def = fruitById(A.fruitId);
    if (!def || !def.mergeTarget) return; // max tier or special
    this.enqueueMerge(A, B);
  }

  private enqueueMerge(a: FruitGO, b: FruitGO): void {
    const ida = (a.body as unknown as { id: number }).id; const idb = (b.body as unknown as { id: number }).id;
    const key = ida < idb ? `${ida}_${idb}` : `${idb}_${ida}`;
    if (this.queuedKeys.has(key)) return;
    a.merging = b.merging = true;
    this.queuedKeys.add(key);
    this.queue.push({ a, b, key });
  }

  private squash(f: FruitGO): void {
    const st = useMeta.getState();
    if (st.settings.reducedMotion) return;
    const now = this.time.now;
    if (now - f.lastSquash < 350) return;
    f.lastSquash = now;
    this.tweens.killTweensOf(f);
    f.setScale(1.12, 0.88);
    this.tweens.add({ targets: f, scaleX: 1, scaleY: 1, duration: 150, ease: 'Back.easeOut' });
  }

  private landFx(f: FruitGO): void {
    const vy = Math.abs((f.body as unknown as { velocity: { y: number } }).velocity?.y ?? 0);
    if (vy > 3.2) {
      this.squash(f);
      if (f.fruitId === 'ironplum') {
        audio.play('land', { pitch: 0.5 });
        shake(this, 0.003, 150, useMeta.getState().settings.reducedMotion, useMeta.getState().settings.screenShake);
        floatText(this, f.x, f.y - 30, 'CLANG!', '#c6ccd6', 18);
      } else {
        audio.play('land', { pitch: 0.9 + Math.random() * 0.2 });
      }
      if (this.quality !== 'low') dust(this, f.x, f.y + (fruitById(f.fruitId)?.radius ?? 20) * 0.8, 3);
    } else if (vy > 1.4) {
      audio.play('bounce', { pitch: 0.85 + Math.random() * 0.3 });
    }
  }

  override update(_t: number, delta: number): void {
    if (this.over) return;
    const st = useMeta.getState();
    const dt = Math.min(delta, 50);
    this.elapsed += dt / 1000;
    this.updateTutorial();
    // immediate aim follow — the preview sticks to the cursor with zero smoothing lag
    this.dropTargetX = this.clampDrop(this.dropTargetX);
    this.dropX = this.dropTargetX;
    // frozen slow-mo
    const frozen = this.time.now < this.frozenUntil;
    this.matter.world.engine.timing.timeScale = frozen ? 0.35 : 1;
    if (frozen && this.quality !== 'low' && Math.random() < 0.06) dust(this, this.dropX + (Math.random() - 0.5) * 200, 400 + Math.random() * 200, 1);
    // time attack
    const mode = MODES.find(m => m.id === this.mode)!;
    if (mode.timeLimit) {
      this.timeLeft -= dt / 1000;
      if (this.timeLeft <= 10 && this.timeLeft + dt / 1000 > 10) audio.play('warn');
      if (this.timeLeft <= 0) { this.endRun(true); return; }
    }
    // chain decay (huge merges buy extra rhythm time)
    const window = Math.min(4, 2.2 + (st.upgrades['combo_window'] ?? 0) * 0.4 + Math.max(0, this.lastMergeTier - 7) * 0.15);
    if (this.time.now - this.lastMergeAt > window * 1000) {
      this.chain = 0;
    }
    // preview follow + wobble + bob (non-physics image, safe to animate)
    this.preview.x = this.dropX;
    if (st.settings.reducedMotion) {
      this.preview.rotation = 0;
      this.preview.y = 122;
    } else {
      this.preview.rotation = Math.sin(this.time.now / 400) * 0.07;
      this.preview.y = 122 + Math.sin(this.time.now / 550) * 4;
    }
    this.drawGuide();
    this.updateGhost();
    if (!st.settings.reducedMotion) { this.updateBlinks(dt); this.updateBreathers(this.time.now); if (this.quality !== 'low') this.updateOrbiters(); }
    // process merges (bounded per frame)
    if (this.queue.length) {
      const batch = this.queue.splice(0, 4);
      for (const q of batch) { this.queuedKeys.delete(q.key); this.doMerge(q.a, q.b); }
    }
    // danger check at 7Hz + line animation
    this.dangerAcc += dt;
    this.dashPhase += dt;
    if (this.dangerAcc > 140) { this.dangerAcc = 0; if (mode.id !== 'chill') this.checkDanger(); this.drawDanger(); }
    // score count-up animation (fast: the number should race, not crawl)
    const target = this.score.toNumber();
    if (Math.abs(this.shownScore - target) > 0.5) {
      this.shownScore += (target - this.shownScore) * Math.min(1, dt / 80);
      if (Math.abs(target - this.shownScore) < 1) this.shownScore = target;
      this.hud.score.setText(fmt(Math.floor(this.shownScore)));
    } else if (this.scoreDirty) {
      this.shownScore = target;
      this.hud.score.setText(fmt(this.score));
      this.scoreDirty = false;
    }
    // throttled HUD text
    this.hudAcc += dt;
    if (this.hudAcc > 120) {
      this.hudAcc = 0;
      if (this.coinsDirty) { this.hud.coins.setText(`🪙 +${fmt(this.coinsEarned)}`); this.coinsDirty = false; }
      // power-bar glow pulse on usable cards + first-use coach hint
      if (!st.settings.reducedMotion && !this.over) {
        const pulse = 0.75 + 0.25 * Math.sin(this.time.now / 380);
        for (const d of POWER_DEFS) {
          const bg = this.powerBgs[d.id];
          if (!bg) continue;
          if (d.id === 'hammer' && this.hammerArmed) { bg.setStrokeStyle(3, 0xffd97a, 1); continue; }
          const has = (st.powerups[d.id] ?? 0) > 0;
          bg.setStrokeStyle(2.5, has ? 0x9ef0c8 : 0x7bc96f, has ? pulse : 0.22);
        }
        const owned = POWER_DEFS.reduce((a, d) => a + (st.powerups[d.id] ?? 0), 0);
        const showCoach = st.stats.powerupsUsed === 0 && owned > 0;
        this.coachText?.setAlpha(showCoach ? 0.75 + 0.25 * Math.sin(this.time.now / 300) : 0);
      }
      // cooldown ring on the most recently used power-up
      this.cooldownGfx.clear();
      const remainMs = this.powerLockUntil - this.time.now;
      if (remainMs > 0 && this.lastPowerId && this.powerBgs[this.lastPowerId] && !this.over) {
        const bg = this.powerBgs[this.lastPowerId];
        const frac = remainMs / this.cooldownMs;
        this.cooldownGfx.lineStyle(3, 0xffffff, 0.85);
        this.cooldownGfx.beginPath();
        this.cooldownGfx.arc(bg.x, bg.y, 38, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        this.cooldownGfx.strokePath();
      }
      if (mode.timeLimit) this.hud.timer.setText(`${Math.max(0, Math.ceil(this.timeLeft))}s`);
      else if (this.mode === 'chill') this.hud.timer.setText('ZEN');
      else this.hud.timer.setText(`${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`);
      // desktop side-panel companion (no-op on narrow screens)
      pushPanelState({
        screen: 'game', score: Math.floor(this.score.toNumber()),
        best: useMeta.getState().stats.bestScore, merges: this.mergesThisRun,
        chain: this.chain, tierName: this.bestTierThisRun > 0 ? `Top T${this.bestTierThisRun}` : undefined,
        modeName: mode.name,
      });
    }
  }

  /** Ambient life: settled fruits blink, and occasionally wiggle (a squash). */
  private updateBlinks(dt: number): void {
    const now = this.time.now;
    // restore finished blinks
    for (let i = this.blinking.length - 1; i >= 0; i--) {
      const b = this.blinking[i];
      if (now >= b.until) {
        if (this.fruits.includes(b.f) && !b.f.merging) {
          try { b.f.setTexture(fruitTextureKey(b.f.fruitId)); } catch { /* gone */ }
        }
        this.blinking.splice(i, 1);
      }
    }
    this.blinkAcc += dt;
    if (this.blinkAcc < 1100 || this.blinking.length >= 4) return;
    this.blinkAcc = 0;
    const settled = this.fruits.filter(f => {
      if (f.merging || now - f.bornAt < 2000) return false;
      const v = (f.body as unknown as { velocity?: { x: number; y: number } }).velocity;
      return v && Math.abs(v.x) + Math.abs(v.y) < 0.5;
    });
    if (!settled.length) return;
    // blink up to two fruits at once so the life is actually visible
    for (let k = 0; k < 2 && settled.length; k++) {
      const pick = settled.splice(Math.floor(this.rng() * settled.length), 1)[0];
      if (this.rng() < 0.45) { this.squash(pick); continue; } // wiggle instead of blink
      try {
        ensureBlinkTexture(this, fruitById(pick.fruitId)!);
        pick.setTexture(blinkTextureKey(pick.fruitId));
        this.blinking.push({ f: pick, until: now + 280 });
      } catch { /* texture hiccup: skip */ }
    }
  }

  /** Ambient breathing: a rotating cast of settled fruits gently swells. Display-only scale. */
  private updateBreathers(now: number): void {
    for (let i = this.breathers.length - 1; i >= 0; i--) {
      const b = this.breathers[i];
      if (!this.fruits.includes(b.f) || b.f.merging || now - b.f.lastSquash < 400 || now - b.f.bornAt < 1500) {
        try { if (this.fruits.includes(b.f) && !b.f.merging) b.f.setScale(1, 1); } catch { /* gone */ }
        this.breathers.splice(i, 1);
      }
    }
    this.breathAcc += 1;
    if (this.breathers.length < 7 && this.breathAcc % 45 === 0) {
      const busy = new Set(this.breathers.map(b => b.f));
      const settled = this.fruits.filter(f => {
        if (f.merging || busy.has(f) || now - f.bornAt < 2000 || now - f.lastSquash < 400) return false;
        const v = (f.body as unknown as { velocity?: { x: number; y: number } }).velocity;
        return v && Math.abs(v.x) + Math.abs(v.y) < 0.5;
      });
      if (settled.length) this.breathers.push({ f: settled[Math.floor(this.rng() * settled.length)], phase: this.rng() * Math.PI * 2 });
    }
    for (const b of this.breathers) {
      const a = 0.05 * Math.sin(now / 450 + b.phase);
      try { b.f.setScale(1 + a, 1 - a); } catch { /* gone */ }
    }
  }

  /** Orbiting sparks around high-tier fruits (tiers 9+). Pooled, world-space, cheap. */
  private updateOrbiters(): void {
    const now = this.time.now;
    // prune fruits that left (sprites return to the pool)
    for (const [id, sprites] of this.orbiters) {
      const f = this.bodyMap.get(id);
      if (!f || !this.fruits.includes(f) || f.merging) {
        for (const s of sprites) { s.setVisible(false); this.orbitPool.push(s); }
        this.orbiters.delete(id);
      }
    }
    if (this.orbiters.size < 4) {
      for (const f of this.fruits) {
        if (this.orbiters.size >= 4) break;
        const def = fruitById(f.fruitId);
        if (!def || def.tier < 9 || def.tier >= 90 || f.merging || now - f.bornAt < 1500) continue;
        const id = (f.body as unknown as { id: number }).id;
        if (this.orbiters.has(id)) continue;
        const sprites: Phaser.GameObjects.Image[] = [];
        for (let k = 0; k < 3; k++) {
          let s = this.orbitPool.pop();
          if (!s) {
            ensureSparkTexture(this);
            s = this.add.image(0, 0, 'fx_spark').setDepth(4);
          }
          s.setVisible(true).setAlpha(0.9).setScale(0.8 + k * 0.15);
          sprites.push(s);
        }
        this.orbiters.set(id, sprites);
      }
    }
    for (const [id, sprites] of this.orbiters) {
      const f = this.bodyMap.get(id);
      if (!f) continue;
      const fr = fruitById(f.fruitId)?.radius ?? 40;
      sprites.forEach((s, k) => {
        const a = now / 900 + k * (Math.PI * 2 / 3) + (id % 10) * 0.3;
        s.setPosition(f.x + Math.cos(a) * fr * 1.18, f.y + Math.sin(a) * fr * 1.18 * 0.55);
        s.setAlpha(0.55 + 0.35 * Math.sin(now / 300 + k * 2));
      });
    }
  }

  private drawGuide(): void {
    const g = this.guide;
    g.clear();
    // soft shadow anchored under the held fruit
    const def = fruitById(this.currentId);
    const pr = def?.radius ?? 20;
    this.guideShadow.setPosition(this.dropX, 128 + pr * 0.9).setSize(pr * 1.6, pr * 0.4).setAlpha(this.canDrop && !this.over ? 0.3 : 0);
    if (this.over || !this.canDrop) return;
    // bright guide that flares right after the player moves
    const fresh = Phaser.Math.Clamp(1 - (this.time.now - this.lastMoveAt) / 900, 0, 1);
    const alpha = 0.22 + fresh * 0.35;
    g.fillStyle(0xffffff, alpha);
    for (let y = 138; y < this.floorTop; y += 16) g.fillCircle(this.dropX, y, 1.8 + fresh);
    // movement-range brackets at the top of the jar
    const r = pr + 4;
    const x0 = this.jarLeft + r, x1 = this.jarRight - r;
    g.lineStyle(2, 0x9ef0c8, 0.5);
    g.beginPath(); g.moveTo(x0, 132); g.lineTo(x0 - 8, 132); g.lineTo(x0 - 8, 142); g.strokePath();
    g.beginPath(); g.moveTo(x1, 132); g.lineTo(x1 + 8, 132); g.lineTo(x1 + 8, 142); g.strokePath();
  }

  private updateGhost(): void {
    const def = fruitById(this.currentId);
    if (!def) { this.ghost.setVisible(false); return; }
    if (!this.canDrop || this.over) { this.ghost.setVisible(false); return; }
    this.ghost.setVisible(true);
    const now = this.time.now;
    let landY = this.floorTop - def.radius;
    for (const f of this.fruits) {
      if (f.merging) continue;
      // Ignore fruits that are still falling in (just dropped/merged) —
      // otherwise the ghost rides down with the falling fruit.
      if (now - f.bornAt < 900) continue;
      const fr = fruitById(f.fruitId)?.radius ?? 20;
      if (Math.abs(f.x - this.dropX) < fr + def.radius - 4) {
        const top = f.y - fr - def.radius;
        if (top < landY && top > this.jarTop) landY = top;
      }
    }
    this.ghost.x = this.dropX; this.ghost.y = landY;
    // gentle pulse so the landing mark reads as alive, not a stuck sprite
    this.ghost.setAlpha(0.18 + (this.time.now % 900 < 450 ? 0.07 : 0));
  }

  private drawDanger(): void {
    const g = this.dangerGfx; const z = this.zoneGfx;
    g.clear(); z.clear();
    const w = this.jarRight - this.jarLeft;
    const lvl = this.dangerLevel;
    // pulse quickens as grace runs out; warning glow only when fruit is near/over
    const speed = lvl === 2 ? 120 - this.dangerUrgency * 70 : lvl === 1 ? 420 : 900;
    const pulse = lvl === 2 ? 0.8 + 0.2 * Math.sin(this.time.now / speed)
      : lvl === 1 ? 0.62 + 0.14 * Math.sin(this.time.now / speed)
        : 0.5 + 0.06 * Math.sin(this.time.now / speed);
    z.fillStyle(0xff3b3b, lvl === 2 ? 0.14 : lvl === 1 ? 0.08 : 0.04);
    z.fillRect(this.jarLeft, this.jarTop, w, Math.max(0, this.dangerY - this.jarTop));
    const dash = 14; const gap = 10;
    const off = (this.dashPhase / 60) % (dash + gap);
    g.lineStyle(lvl === 2 ? 6 : 5, 0xff3b3b, (lvl === 0 ? 0.16 : 0.24) * pulse + 0.08);
    g.lineBetween(this.jarLeft, this.dangerY, this.jarRight, this.dangerY);
    g.lineStyle(2.5, lvl === 2 ? 0xff8080 : 0xff6b6b, (lvl === 0 ? 0.55 : 0.95) * pulse + 0.1);
    for (let x = this.jarLeft - off; x < this.jarRight; x += dash + gap) {
      g.lineBetween(Math.max(x, this.jarLeft), this.dangerY, Math.min(x + dash, this.jarRight), this.dangerY);
    }
  }

  private doMerge(a: FruitGO, b: FruitGO): void {
    if (!this.fruits.includes(a) || !this.fruits.includes(b)) { a.merging = false; b.merging = false; return; }
    const st = useMeta.getState();
    const reduced = st.settings.reducedMotion;
    let targetId: string | null = null;
    let partnerTier = 0;
    if (a.fruitId === 'prismfruit' || b.fruitId === 'prismfruit') {
      const other = a.fruitId === 'prismfruit' ? b : a;
      const odef = fruitById(other.fruitId)!;
      const idx = FRUITS.findIndex(f => f.id === odef.id);
      targetId = idx >= 0 && idx + 1 < FRUITS.length ? FRUITS[idx + 1].id : null;
      partnerTier = odef.tier;
      if (!targetId) { a.merging = b.merging = false; return; }
    } else {
      const def = fruitById(a.fruitId)!;
      targetId = def.mergeTarget;
      partnerTier = def.tier;
      if (!targetId) { a.merging = b.merging = false; return; }
    }
    // sanity: partners must still be near each other (anti-teleport)
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const ra = fruitById(a.fruitId)?.radius ?? 24; const rb = fruitById(b.fruitId)?.radius ?? 24;
    if (dist > (ra + rb) * 3.2) { a.merging = b.merging = false; return; }
    const tdef = fruitById(targetId)!;
    const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
    // Capture partner positions NOW — removeFruit() destroys the bodies,
    // after which MatterImage.x/y getters throw (body is gone).
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    const avx = (((a.body as unknown as { velocity: { x: number } }).velocity?.x ?? 0) + ((b.body as unknown as { velocity: { x: number } }).velocity?.x ?? 0)) / 2;
    const avy = (((a.body as unknown as { velocity: { y: number } }).velocity?.y ?? 0) + ((b.body as unknown as { velocity: { y: number } }).velocity?.y ?? 0)) / 2;
    this.removeFruit(a, false); this.removeFruit(b, false);

    ensureFruitTexture(this, tdef);
    const img = this.matter.add.image(mx, my - 4, fruitTextureKey(tdef.id), undefined, {
      shape: { type: 'circle', radius: tdef.radius },
      restitution: tdef.restitution, friction: tdef.friction, frictionStatic: tdef.frictionStatic, frictionAir: tdef.frictionAir,
      density: tdef.density, label: 'fruit',
    }) as FruitGO;
    (img.body as MatterJS.BodyType).label = `fruit:${tdef.id}`;
    img.fruitId = tdef.id; img.merging = false; img.bornAt = this.time.now; img.lastSquash = 0; img.setDepth(3);
    img.setVelocity(avx * 0.45, Math.min(avy * 0.45, -1.2));
    img.setAngularVelocity((this.rng() - 0.5) * 0.06);
    this.fruits.push(img);
    this.bodyMap.set((img.body as unknown as { id: number }).id, img);
    if (!reduced) { img.setScale(1.32); this.tweens.add({ targets: img, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' }); }
    // gentle recoil: push neighbours apart so stacks settle fairly
    for (const f of this.fruits) {
      if (f === img || f.merging || !f.body) continue;
      const d = Phaser.Math.Distance.Between(mx, my, f.x, f.y);
      if (d < 130 && d > 1) {
        const push = Math.min(2.2, (1.2 + tdef.tier * 0.22) * (1 - d / 130));
        const vx = (f.body.velocity?.x ?? 0) + ((f.x - mx) / d) * push;
        const vy = (f.body.velocity?.y ?? 0) + ((f.y - my) / d) * push - 0.4;
        f.setVelocity(vx, vy);
      }
    }

    // scoring
    const now = this.time.now;
    const gap = now - this.lastMergeAt;
    this.chain = gap < 2600 ? this.chain + 1 : 1;
    this.bestChainThisRun = Math.max(this.bestChainThisRun, this.chain);
    this.lastMergeAt = now;
    const mode = MODES.find(m => m.id === this.mode)!;
    const comboMul = 1 + Math.max(0, this.chain - 1) * 0.75;
    const perfect = gap < 1200 && this.chain >= 1;
    if (perfect) this.perfectsThisRun++;
    const gained = new Decimal(tdef.score).times(scoreMult(st)).times(mode.scoreMul).times(this.dblScore ? 1.5 : 1).times(comboMul).times(perfect ? 2.5 : 1);
    this.score = this.score.plus(gained);
    const coins = new Decimal(tdef.coinValue).times(coinMult(st)).times(1 + (this.chain - 1) * 0.25).times(this.dblCoins ? 1.25 : 1);
    this.coinsEarned = this.coinsEarned.plus(coins);
    this.mergesThisRun++;
    this.bestTierThisRun = Math.max(this.bestTierThisRun, tdef.tier);
    this.lastMergeTier = tdef.tier;
    this.scoreDirty = true; this.coinsDirty = true;

    // escalating feedback
    const tier = tdef.tier;
    const small = tier <= 2; const big = tier >= 6; const mythic = tier >= 8;
    const fxColor = Phaser.Display.Color.HexStringToColor(tdef.body).color;
    const qScale = this.quality === 'low' ? 0.4 : this.quality === 'medium' ? 0.7 : this.quality === 'ultra' ? 1.2 : 1;
    const n = Math.round((small ? 10 + tier * 4 : big ? 22 + tier * 3 : 14 + tier * 4) * qScale);
    const shakeOn = st.settings.screenShake; const flashOn = st.settings.screenFlash;
    burst(this, mx, my, fxColor, n, reduced);
    burst(this, mx, my, 0xffffff, Math.round(n / 3), reduced, 0.7);
    // midpoint converge: two sparks fly into the merge point, then leaf+juice bloom
    // (ax/ay/bx/by were captured before removeFruit destroyed the bodies)
    if (!reduced) {
      for (const [sx, sy] of [[ax, ay], [bx, by]] as Array<[number, number]>) {
        const p = this.add.circle(sx, sy, 4, 0xffffff, 1).setDepth(57);
        this.tweens.add({ targets: p, x: mx, y: my, scaleX: 0.2, scaleY: 0.2, duration: 140, ease: 'Quad.easeIn', onComplete: () => p.destroy() });
      }
      const leafN = Math.round((tier >= 6 ? 16 : 8 + tier) * qScale);
      leafJuiceBurst(this, mx, my, 0x7bc96f, fxColor, leafN, false);
      goldSparkle(this, mx, my - 10, Math.round((this.chain >= 3 ? 12 : 5) * qScale), false);
    }
    if (!reduced) ring(this, mx, my, big ? 0xffe9a8 : 0xffffff, big ? 110 : 60 + tier * 6, 380);
    const multLabel = this.chain >= 2 ? ` ×${comboMul.toFixed(comboMul >= 10 ? 0 : 1)}` : '';
    const popColor = this.chain >= 3 ? '#ffe9a8' : perfect ? '#ffe9a8' : '#ffffff';
    const popSize = big ? 28 : this.chain >= 3 ? 24 : small ? 17 : 20;
    floatText(this, mx, my - tdef.radius - 8, `+${fmt(gained)}${multLabel}`, popColor, popSize);
    // punch the HUD score itself so every gain lands physically
    if (!reduced) {
      this.tweens.killTweensOf(this.hud.score);
      this.hud.score.setScale(big || this.chain >= 3 ? 1.3 : 1.18);
      this.tweens.add({ targets: this.hud.score, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeOut' });
    }
    // score milestone flashes — big round numbers feel like events
    const marks = [10000, 50000, 100000, 250000, 500000, 1000000, 5000000, 10000000, 50000000, 250000000];
    while (this.nextScoreMarkIdx < marks.length && this.score.gte(marks[this.nextScoreMarkIdx])) {
      const mark = marks[this.nextScoreMarkIdx];
      this.nextScoreMarkIdx++;
      announce(this, `${fmtInt(mark)} POINTS!`, tier >= 6 ? `${tdef.name} shower!` : 'Keep growing!', '#e8d45f', true);
      audio.play('achieve'); audio.buzz([20, 40, 20]);
      goldSparkle(this, 120, 60, 22, reduced);
    }
    if (coins.gt(0)) floatText(this, mx, my + tdef.radius + 10, `+${fmt(coins)} 🪙`, '#ffd97a', 14, 800);
    if (!this.passedBest && this.runStartBestScore > 0 && this.score.gt(this.runStartBestScore)) {
      this.passedBest = true;
      announce(this, 'NEW BEST!', `You beat ${fmtInt(this.runStartBestScore)}`, '#e8d45f', true);
      audio.play('highscore'); audio.buzz([30, 50, 30]);
      goldSparkle(this, mx, my - 30, 20, reduced);
    }
    if (perfect && this.chain <= 2) floatText(this, mx, my - tdef.radius - 32, 'PERFECT ×2.5', '#ffd97a', 15);
    if (this.chain === 2) announce(this, `CHAIN ×${this.chain}!`, `+${fmt(gained)}`, '#bfe0ff');
    if (this.chain === 3 || this.chain === 4) announce(this, `CHAIN ×${this.chain}!`, `+${fmt(gained)}`, '#bfe0ff');
    else if (this.chain === 5) announce(this, `CHAIN ×${this.chain}!`, 'Keep it rolling!', '#9ef0c8');
    else if (this.chain >= 6) announce(this, this.chain >= 8 ? 'FRENZY!' : 'MEGA MERGE!', `CHAIN ×${this.chain}  •  +${fmt(gained)}`, '#ffe9a8', true, true);
    else if (mythic) announce(this, tdef.name.toUpperCase() + '!', `+${fmt(gained)}`, '#e8d45f', true);
    else if (big && this.chain < 3) announce(this, `${tdef.name}!`, `+${fmt(gained)}`, '#ffe9a8');
    if (!reduced) {
      if (tier >= 13) {
        // WORLDSEED: full celebration
        shake(this, 0.009, 340, reduced, shakeOn); if (flashOn) flash(this, 160, true); hitStop(this, 160, 0.2);
        burst(this, mx, my, 0xe8d45f, 36, reduced, 1.4);
        burst(this, mx, my, 0xffffff, 24, reduced, 1.1);
        ring(this, mx, my, 0xe8d45f, 200, 600);
        announce(this, 'WORLDSEED!', `+${fmt(gained)}`, '#e8d45f', true);
      }
      else if (this.chain >= 8 || mythic) { shake(this, 0.007, 280, reduced, shakeOn); if (flashOn) flash(this, 110, true); hitStop(this, 110, 0.3); }
      else if (this.chain >= 6) { shake(this, 0.006, 240, reduced, shakeOn); if (flashOn) flash(this, 90, true); }
      else if (big) shake(this, 0.0035, 170, reduced, shakeOn);
      else if (this.chain >= 3) shake(this, 0.002, 120, reduced, shakeOn);
    }

    const chainPitch = 1 + Math.min(this.chain, 10) * 0.06;
    if (big || this.chain >= 3) { audio.play('big', { tier, pitch: chainPitch }); audio.play('coin', { pitch: chainPitch }); audio.buzz([20, 40, 30]); }
    else if (this.chain >= 2) audio.play('chain', { tier, pitch: chainPitch });
    else audio.play('merge', { tier });

    st.bump(s => {
      const per = { ...s.stats.perFruitMerges }; per[tdef.id] = (per[tdef.id] ?? 0) + 1;
      return { stats: { ...s.stats, merges: s.stats.merges + 1, perfects: s.stats.perfects + (perfect ? 1 : 0), specials: s.stats.specials + (tdef.special ? 1 : 0), bestCombo: Math.max(s.stats.bestCombo, this.chain), bestTier: Math.max(s.stats.bestTier, tdef.tier), perFruitMerges: per } };
    });
    if (!st.unlockedFruits.includes(tdef.id) && tdef.tier < 90) st.bump(s => ({ unlockedFruits: [...s.unlockedFruits, tdef.id] }));
    const { leveled } = st.addXp(5 + tdef.tier * 8 + this.chain * 4);
    if (leveled) { audio.play('levelup'); floatText(this, 240, 200, `LEVEL ${useMeta.getState().level}!`, '#9ef0c8', 24); }
    this.checkMilestonesAchievements(tdef.tier);
    void partnerTier;
  }

  private removeFruit(f: FruitGO, juice = true): void {
    this.fruits = this.fruits.filter(x => x !== f);
    const id = (f.body as unknown as { id?: number })?.id;
    if (typeof id === 'number') this.bodyMap.delete(id);
    if (juice) { const d = fruitById(f.fruitId); if (d) burst(this, f.x, f.y, Phaser.Display.Color.HexStringToColor(d.body).color, 10, useMeta.getState().settings.reducedMotion); }
    try { this.matter.world.remove(f.body as unknown as MatterJS.BodyType); } catch { /* already gone */ }
    try { f.destroy(); } catch { /* ignore */ }
  }

  private triggerBomb(self: FruitGO): void {
    if (!this.fruits.includes(self) || this.over) return;
    const st = useMeta.getState();
    audio.play('big', { tier: 4 }); shake(this, 0.005, 220, st.settings.reducedMotion, st.settings.screenShake);
    burst(this, self.x, self.y, 0xff5f5f, 26, st.settings.reducedMotion);
    ring(this, self.x, self.y, 0xff8f8f, 120, 420);
    floatText(this, self.x, self.y - 30, 'POP!', '#ffb3b3', 22);
    const smalls = this.fruits.filter(f => f !== self && (fruitById(f.fruitId)?.radius ?? 99) <= 31 && Phaser.Math.Distance.Between(self.x, self.y, f.x, f.y) < 190);
    for (const s of smalls.slice(0, 5)) {
      const dx = s.x - self.x; const dy = s.y - self.y - 20;
      const d = Math.max(30, Math.hypot(dx, dy));
      s.setVelocity((dx / d) * 7, (dy / d) * 7 - 2.5);
      this.coinsEarned = this.coinsEarned.plus(3);
      this.score = this.score.plus(50);
    }
    this.scoreDirty = true; this.coinsDirty = true;
    this.removeFruit(self);
    st.bump(s => ({ stats: { ...s.stats, specials: s.stats.specials + 1 } }));
  }
  private triggerIce(ms = 5000): void {
    if (this.over) return;
    this.frozenUntil = this.time.now + ms;
    audio.play('power'); floatText(this, 240, 300, `❄ CHILL ${Math.round(ms / 1000)}s`, '#bfeaff', 22);
  }
  private triggerGolden(self: FruitGO): void {
    if (!this.fruits.includes(self) || this.over) return;
    const st = useMeta.getState();
    const def = fruitById(self.fruitId);
    const bonus = new Decimal(def?.coinValue ?? 150).times(coinMult(st));
    audio.play('sparkle'); audio.play('coin'); audio.buzz([15, 30, 15]);
    burst(this, self.x, self.y, 0xe8d45f, 30, st.settings.reducedMotion, 1.2);
    ring(this, self.x, self.y, 0xffe9a8, 110, 420);
    floatText(this, self.x, self.y - 30, `+${fmt(bonus)} 🪙`, '#ffd97a', 24);
    this.coinsEarned = this.coinsEarned.plus(bonus);
    this.score = this.score.plus(def?.score ?? 800);
    this.scoreDirty = true; this.coinsDirty = true;
    this.removeFruit(self);
    st.bump(s => ({ stats: { ...s.stats, specials: s.stats.specials + 1 } }));
  }
  private triggerGhost(self: FruitGO): void {
    if (!this.fruits.includes(self) || this.over) return;
    const st = useMeta.getState();
    const body = self.body as unknown as { collisionFilter?: { mask: number } };
    audio.play('power', { pitch: 1.4 }); audio.buzz(15);
    floatText(this, self.x, self.y - 30, '👻 phase!', '#d9ccff', 18);
    burst(this, self.x, self.y, 0xc6b8e8, 16, st.settings.reducedMotion, 0.8);
    try { if (body.collisionFilter) body.collisionFilter.mask = 0; } catch { /* ignore */ }
    let solid = false;
    const solidify = () => {
      if (solid || !this.fruits.includes(self) || this.over) return;
      solid = true;
      try { if (body.collisionFilter) body.collisionFilter.mask = 0xffffffff; } catch { /* ignore */ }
      // keep it drifting down so it settles instead of hanging mid-air
      try { const vv = (self.body as unknown as { velocity?: { x: number; y: number } } | null)?.velocity; self.setVelocity((vv?.x ?? 0) * 0.3, Math.max(vv?.y ?? 0, 2.5)); } catch { /* ignore */ }
      audio.play('pop'); burst(this, self.x, self.y, 0xffffff, 12, st.settings.reducedMotion, 0.7);
    };
    // safety: never phase past the floor — solidify on arrival instead
    this.time.delayedCall(450, () => {
      if (!this.fruits.includes(self) || this.over) return;
      const r = fruitById(self.fruitId)?.radius ?? 24;
      if (self.y >= this.floorTop - r - 10) solidify();
    });
    this.time.delayedCall(800, solidify);
  }
  private triggerMagnet(self: FruitGO): void {
    if (!this.fruits.includes(self) || this.over) return;
    const mates = this.fruits.filter(f => f !== self && f.fruitId !== 'prismfruit' && (fruitById(f.fruitId)?.tier ?? 90) < 90).slice(0, 4);
    for (const m of mates) {
      const dx = self.x - m.x; const dy = self.y - m.y;
      m.setVelocity(dx * 0.03, dy * 0.03 - 1);
    }
    floatText(this, self.x, self.y - 30, '🧲 tug!', '#ffc2dd', 18);
  }

  private usePower(id: string, bx = 240, by = 600): void {
    const st = useMeta.getState();
    if (this.over || this.time.now < this.powerLockUntil) return;
    const n = st.powerups[id] ?? 0;
    if (n <= 0) { audio.play('warn'); floatText(this, 240, 600, 'None left — visit Shop', '#ffb3b3', 15); return; }
    audio.play('power'); audio.buzz(25); this.usedPowerup = true;
    this.coachText?.setAlpha(0);
    this.lastPowerId = id;
    if (!st.settings.reducedMotion) ring(this, bx, by, 0xffd97a, 64, 300);
    this.powerLockUntil = this.time.now + 800;
    st.bump(s => ({ powerups: { ...s.powerups, [id]: (s.powerups[id] ?? 1) - 1 }, stats: { ...s.stats, powerupsUsed: s.stats.powerupsUsed + 1 } }));
    const left = (st.powerups[id] ?? 1) - 1;
    this.powerLabels[id]?.setText(`×${left}`);
    if (left <= 0) this.powerBgs[id]?.setAlpha(0.45);
    else this.powerBgs[id]?.setStrokeStyle(2.5, 0x9ef0c8, 0.9);
    if (id === 'hammer') {
      this.hammerArmed = !this.hammerArmed;
      if (this.hammerArmed) {
        this.powerBgs[id]?.setStrokeStyle(3, 0xffd97a, 1);
        this.hammerHint.setText('🔨 Tap a fruit to smash — tap 🔨 again to cancel').setAlpha(1);
      } else {
        this.hammerHint.setAlpha(0);
      }
      return;
    }
    if (id === 'shuffle') {
      for (const f of this.fruits) {
        f.setVelocity((this.rng() - 0.5) * 7, -3 - this.rng() * 3.5);
        if (!st.settings.reducedMotion) dust(this, f.x, f.y, 2); // swirl trails on every fruit
      }
      floatText(this, 240, 600, 'Shuffled!', '#ffffff', 18);
    }
    else if (id === 'freeze') {
      this.frozenUntil = this.time.now + 8000;
      floatText(this, 240, 600, '❄ Frozen 8s', '#bfeaff', 18);
      if (!st.settings.reducedMotion) {
        snowPuff(this, 240, 200, 380, 22, false); // frosted-glass snowfall
        try { this.cameras.main.flash(120, 190, 230, 255); } catch { /* ignore */ }
      }
    }
    else if (id === 'magnet') {
      const big = [...this.fruits].sort((a, b) => b.y - a.y)[0];
      if (big) {
        if (!st.settings.reducedMotion) magnetTrails(this, big.x, big.y, this.fruits.filter(f => f !== big).slice(0, 5).map(f => ({ x: f.x, y: f.y })), false);
        this.triggerMagnet(big);
      }
    }
    else if (id === 'prune') {
      const s = [...this.fruits].sort((a, b) => (fruitById(a.fruitId)?.radius ?? 99) - (fruitById(b.fruitId)?.radius ?? 99))[0];
      if (s) {
        if (!st.settings.reducedMotion) leafJuiceBurst(this, s.x, s.y, 0x7bc96f, 0xcfe8c8, 12, false); // clean snip + leaf burst
        this.removeFruit(s); this.score = this.score.plus(30); this.scoreDirty = true;
        floatText(this, 240, 600, 'Pruned ✂ +30', '#cfe8c8', 18);
      }
    }
    else if (id === 'lucky') {
      st.bump(s => ({ powerups: { ...s.powerups, luckyNext: 1 } }));
      goldSparkle(this, 240, 580, 18, st.settings.reducedMotion); // clover glow + gold reward burst
      floatText(this, 240, 600, '🍀 Next drop: EMBER PEACH!', '#d2ffb3', 18);
    }
  }

  /** Keyboard power-up access (1–6) with a visible focus ring. */
  private usePowerIndexed(i: number): void {
    const d = POWER_DEFS[i];
    if (!d) return;
    this.focusPower(i);
    const bg = this.powerBgs[d.id];
    this.usePower(d.id, bg?.x ?? 240, bg?.y ?? 600);
  }

  private focusPower(i: number): void {
    POWER_DEFS.forEach((d, k) => {
      const bg = this.powerBgs[d.id];
      if (!bg) return;
      if (k === i) {
        bg.setStrokeStyle(3, 0xffffff, 1);
        this.time.delayedCall(600, () => {
          if (d.id === 'hammer' && this.hammerArmed) bg.setStrokeStyle(3, 0xffd97a, 1);
          else bg.setStrokeStyle(2.5, 0x9ef0c8, 0.9);
        });
      }
    });
    const d = POWER_DEFS[i];
    if (d) floatText(this, 240, 640, d.name, '#eaffdf', 14, 700);
  }

  private tryHammer(p: Phaser.Input.Pointer): void {
    const hit = this.fruits.filter(f => Phaser.Math.Distance.Between(p.x, p.y, f.x, f.y) < (fruitById(f.fruitId)?.radius ?? 24) + 12).sort((a, b) => a.y - b.y)[0];
    this.hammerArmed = false;
    this.hammerHint.setAlpha(0);
    this.powerBgs['hammer']?.setStrokeStyle(2.5, 0x9ef0c8, 0.9);
    if (!hit) return;
    this.score = this.score.plus(fruitById(hit.fruitId)?.score ?? 10);
    this.scoreDirty = true;
    floatText(this, hit.x, hit.y - 20, 'SMASH!', '#ffd97a', 20);
    if (!useMeta.getState().settings.reducedMotion) crackBurst(this, hit.x, hit.y, 0xffe9a8, 8, 52);
    burst(this, hit.x, hit.y, 0xffd97a, 16, useMeta.getState().settings.reducedMotion);
    audio.play('big', { tier: 2 });
    this.removeFruit(hit);
  }

  private checkDanger(): void {
    const calm = this.calmBoost;
    const now = this.time.now;
    const offenders = this.fruits.filter(f => {
      if (f.merging) return false;
      if (f.y >= this.dangerY) return false;
      if (now - f.bornAt <= 1500) return false;
      const v = (f.body as unknown as { velocity?: { y: number } }).velocity;
      return v && Math.abs(v.y) < 0.7;
    });
    if (offenders.length === 0) {
      if (this.dangerActive) { this.dangerActive = false; }
      this.dangerUrgency = 0;
      // WARNING level: stack settled near (but not over) the line
      let top = Infinity;
      for (const f of this.fruits) {
        if (f.merging || now - f.bornAt <= 1500) continue;
        const fr = fruitById(f.fruitId)?.radius ?? 20;
        top = Math.min(top, f.y - fr);
      }
      const near = top < this.dangerY + 70;
      const lvl = near ? 1 : 0;
      if (lvl !== this.dangerLevel) {
        this.dangerLevel = lvl;
        this.dangerLabel.setText('DANGER').setAlpha(lvl === 1 ? 0.8 : 0.38);
      }
      return;
    }
    if (!this.dangerActive) { this.dangerActive = true; this.dangerStart = now; audio.play('warn'); }
    this.dangerLevel = 2;
    const grace = (gameConfig.dangerGraceSec + (useMeta.getState().upgrades['safe_height'] ?? 0) * 0.5 + (calm ? 1.5 : 0)) * 1000;
    const remain = Math.max(0, grace - (now - this.dangerStart));
    this.dangerUrgency = Phaser.Math.Clamp(1 - remain / Math.max(1, grace), 0, 1);
    this.dangerLabel.setText(`⚠ DANGER ${(remain / 1000).toFixed(1)}s`).setAlpha(1);
    if (remain < 1000 && remain > 0) audio.play('warn'); // accelerating ticks (gated)
    if (remain <= 0) this.endRun(true);
  }

  private refreshHud(force = false): void {
    this.hud.score.setText(fmt(this.score));
    this.shownScore = this.score.toNumber();
    this.hud.coins.setText(`🪙 +${fmt(this.coinsEarned)}`);
    void force;
  }

  private checkMilestonesAchievements(tier: number): void {
    const st = useMeta.getState();
    const score = this.score.toNumber();
    const grant = (coins: number, gems: number, xp: number) => {
      if (coins) st.addCoins(coins);
      if (gems) st.addGems(gems);
      if (xp) st.addXp(xp);
    };
    const checks: Array<[string, number]> = [
      ['m_merge20', st.stats.merges], ['m_merge200', st.stats.merges], ['m_merge1500', st.stats.merges],
      ['m_score10k', score], ['m_score100k', score], ['m_score1m', score], ['m_chain5', this.chain],
      ['m_perfect3', st.stats.perfects], ['m_tier7', tier], ['m_tier10', tier], ['m_coins5k', Number(st.stats.coinsEarned)],
      ['m_powerup', st.stats.powerupsUsed], ['m_special', st.stats.specials], ['m_games10', st.stats.games],
    ];
    for (const m of MILESTONES) {
      const cur = checks.find(c => c[0] === m.id)?.[1] ?? 0;
      const key = `ms:${m.id}`;
      if (cur >= m.target && !st.achievements[key]) {
        st.bump(s => ({ achievements: { ...s.achievements, [key]: true } }));
        grant(m.rewardCoins, m.rewardGems, m.rewardXp);
        floatText(this, 240, 200, `✔ ${m.name} +${m.rewardCoins}🪙`, '#d2ffb3', 17);
        audio.play('achieve');
      }
    }
    const unlock = (id: string) => {
      if (st.achievements[id]) return;
      const def = ACHIEVEMENTS.find(a => a.id === id)!;
      st.bump(s => ({ achievements: { ...s.achievements, [id]: true } }));
      grant(def.coins, def.gems, def.xp);
      floatText(this, 240, 170, `🏆 ${def.name}`, '#ffe9a8', 19);
      audio.play('achieve'); audio.buzz([30, 50, 30]);
    };
    if (st.stats.merges >= 1) unlock('first_merge');
    if (this.chain >= 2) unlock('first_chain');
    if (tier >= 5) unlock('big_fruit');
    if (tier >= 8) unlock('fruit_master');
    if (tier >= 10) unlock('solar_born');
    if (this.chain >= 6) unlock('mega_combo');
    if (this.chain >= 8) unlock('frenzy');
    if (tier >= 13) unlock('massive_merge');
    if (this.perfectsThisRun >= 1) unlock('perfect_run');
    if (Number(st.coins) >= 10000) unlock('coin_hoarder');
    if (score >= 20000 && !this.usedPowerup) unlock('no_powerups');
    if (this.elapsed >= 360) unlock('marathon');
    if (this.mode === 'daily') unlock('daily_dabbler');
    const seen = new Set(st.stats.specialsSeen);
    if (['bombfruit', 'icefruit', 'magnetfruit', 'prismfruit', 'goldenapple', 'ironplum', 'chronoberry', 'ghostgrape'].every(id => seen.has(id))) unlock('specialist');
    const fruitCount = new Set([...st.unlockedFruits]).size;
    if (fruitCount >= 12) unlock('collector');
  }

  private endRun(timeout: boolean): void {
    if (this.over) return;
    this.over = true;
    if (timeout) {
      // danger game-over: brief red pulse before fading out
      try { this.cameras.main.flash(180, 255, 70, 70); } catch { /* ignore */ }
    }
    this.cameras.main.fadeOut(220, 6, 13, 9);
    const st = useMeta.getState();
    const scoreN = Math.floor(this.score.toNumber());
    const coinsN = this.coinsEarned.toString();
    const prevBest = st.stats.bestScore;
    const isBest = scoreN > prevBest && scoreN > 0;
    const isNewTier = this.bestTierThisRun > this.runStartBestTier;
    if (scoreN > 0) st.addCoins(coinsN);
    st.bump(s => ({
      stats: { ...s.stats, bestScore: Math.max(s.stats.bestScore, scoreN), bestByMode: { ...s.stats.bestByMode, [this.mode]: Math.max(s.stats.bestByMode[this.mode] ?? 0, scoreN) }, playSec: s.stats.playSec + Math.floor(this.elapsed) },
      boosts: { ...s.boosts, coins25: 0, score50: 0, luck: 0, calm: 0 },
    }));
    if (this.mode === 'daily') st.bump(s => ({ daily: { day: dailySeed(), score: Math.max(s.daily.score, scoreN), played: true } }));
    void timeout;
    audio.play('over');
    if (isBest) this.time.delayedCall(500, () => audio.play('highscore'));
    this.time.delayedCall(240, () => {
      this.scene.start('gameover', { score: scoreN, coins: coinsN, combo: this.bestChainThisRun, mode: this.mode, bestTier: this.bestTierThisRun, merges: this.mergesThisRun, isBest, isNewTier });
    });
  }
}
