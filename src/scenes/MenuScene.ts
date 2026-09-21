import Phaser from 'phaser';
import Decimal from 'decimal.js';
import gsap from 'gsap';
import { useMeta, coinMult, scoreMult } from '../store/meta';
import { audio } from '../audio/AudioManager';
import { MODES } from '../data/modes';
import { SHOP_ITEMS } from '../data/shopItems';
import { MILESTONES, ACHIEVEMENTS, DAILY_POOL } from '../data/missions';
import { FRUITS } from '../config/fruitConfig';
import { upgradeDefs } from '../config/economyConfig';
import { THEMES, RARITY_COLORS } from '../config/graphicsConfig';
import { ensureFruitTexture, fruitTextureKey } from '../effects/fruitArt';
import { dailySeed } from '../utils/Random';
import { fmt, fmtInt } from '../utils/NumberFormat';
import { fruitById } from '../config/fruitConfig';
import { clearSave } from '../persistence/SaveManager';
import { pushPanelState } from '../ui/sidePanels';
import { pixelPanel, pixelButton, makeTooltip, countUp, sweepHighlight, UI_FONT, DISPLAY_FONT, NUM_FONT, UI } from '../ui/theme';
import type { GameModeId } from '../config/gameConfig';

type Tab = 'play'|'orchard'|'coll'|'miss'|'ach'|'stats'|'set';
const TABS: Array<{ id: Tab; icon: string; label: string; tip: string }> = [
  { id:'play', icon:'▶', label:'Play', tip:'Quick play and game modes' },
  { id:'orchard', icon:'🛒', label:'Orchard', tip:'Shop, fruit unlocks and upgrades' },
  { id:'coll', icon:'🍓', label:'Index', tip:'Fruit collection' },
  { id:'miss', icon:'📜', label:'Quests', tip:'Daily tasks and milestones' },
  { id:'ach', icon:'🏆', label:'Medals', tip:'Achievements' },
  { id:'stats', icon:'📊', label:'Stats', tip:'Lifetime statistics' },
  { id:'set', icon:'⚙', label:'Setup', tip:'Settings and save' },
];
const MODE_FRUIT: Record<string, string> = { classic:'ciderapple', time:'sunplum', chill:'frostmelon', chaos:'prismfruit', hardcore:'ironplum', daily:'dewberry', fountain:'goldenapple' };

export class MenuScene extends Phaser.Scene {
  private tab: Tab = 'play';
  private root!: Phaser.GameObjects.Container;
  private top!: Phaser.GameObjects.Container;
  private shopFilter: string = 'fruits';
  private orchardSection: 'shop'|'up' = 'shop';
  private quickMode: GameModeId = 'classic';
  private tip: { show: (x: number, y: number, msg: string) => void; hide: () => void; destroy: () => void } | null = null;
  private scrollY = 0;
  private scrollMax = 0;
  private dragStart: { y: number; scroll: number } | null = null;

  constructor() { super('menu'); }
  create(): void {
    const st = useMeta.getState();
    pushPanelState({ screen: 'menu' });
    try { (window as unknown as { __menu?: MenuScene }).__menu = this; } catch { /* ignore */ }
    audio.ensure();
    audio.applySettings(st.settings);
    audio.crossfade('menu');
    this.cameras.main.setBackgroundColor('#0e1f16');
    this.drawBackdrop();
    this.top = this.add.container(0, 0).setDepth(10);
    this.root = this.add.container(0, 0).setDepth(5);
    this.tip?.destroy();
    this.tip = makeTooltip(this);
    this.scrollY = 0; this.scrollMax = 0; this.dragStart = null;
    this.setupScroll();
    this.renderTop();
    this.renderTab();
    // animate title with gsap
    const title = this.top.getByName('title') as Phaser.GameObjects.Text;
    if (title) gsap.fromTo(title, { scale: 0.8 }, { scale: 1, duration: 0.6, ease: 'back.out(2)', yoyo: false });
  }

  /** Tap (not drag): fires only if press+release stay within a few px. Lets
   *  drag-scrolling coexist with buttons — a swipe starting on a button won't trigger it. */
  private onTap(obj: Phaser.GameObjects.GameObject, cb: () => void): void {
    let sx = 0; let sy = 0; let down = false;
    obj.on('pointerdown', (p: Phaser.Input.Pointer) => { sx = p.x; sy = p.y; down = true; });
    obj.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (down && Math.hypot(p.x - sx, p.y - sy) < 14) cb();
      down = false;
    });
    obj.on('pointerout', () => { down = false; });
  }

  private onWheel = (e: WheelEvent): void => {
    if (this.scrollMax <= 0 || !this.scene.isActive('menu')) return;
    e.preventDefault();
    this.scrollY = Phaser.Math.Clamp(this.scrollY + (e.deltaY > 0 ? 48 : -48), 0, this.scrollMax);
    this.applyScroll();
  };

  private setupScroll(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStart = { y: p.y, scroll: this.scrollY };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown || this.scrollMax <= 0) return;
      const dy = p.y - this.dragStart.y;
      if (Math.abs(dy) > 8) {
        this.scrollY = Phaser.Math.Clamp(this.dragStart.scroll - dy, 0, this.scrollMax);
        this.applyScroll();
      }
    });
    this.input.on('pointerup', () => { this.dragStart = null; });
    window.addEventListener('wheel', this.onWheel, { passive: false });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('wheel', this.onWheel));
  }

  private applyScroll(): void {
    if (this.root) this.root.setY(-this.scrollY);
  }

  /** Measure tab content and clamp the scroll range. Call at the end of renderTab(). */
  private layoutScroll(): void {
    if (!this.root) return;
    this.root.setY(0);
    try {
      // Manual union over flat children: Container.getBounds is unreliable here.
      let bottom = 0;
      const kids = this.root.getAll() as Phaser.GameObjects.GameObject[];
      for (const k of kids) {
        try {
          const gb = (k as unknown as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds?.();
          if (gb && Number.isFinite(gb.bottom)) bottom = Math.max(bottom, gb.bottom);
        } catch { /* skip odd child */ }
      }
      this.scrollMax = Math.max(0, Math.ceil(bottom) - 800 + 28);
    } catch { this.scrollMax = 0; }
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.scrollMax);
    this.applyScroll();
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1d3a2a, 0x1d3a2a, 0x0e1f16, 0x0e1f16, 1);
    g.fillRect(0, 0, 480, 800);
    for (let i = 0; i < 26; i++) {
      this.add.circle(Math.random() * 480, Math.random() * 800, 1 + Math.random() * 4, 0x7bc96f, 0.1);
    }
  }

  private renderTop(): void {
    this.top.removeAll(true);
    const st = useMeta.getState();
    // hero: emblem + big display title + subtitle + status pill
    const logoDef = fruitById('starpine')!;
    ensureFruitTexture(this, logoDef);
    const logo = this.add.image(88, 40, fruitTextureKey(logoDef.id)).setDisplaySize(44, 44).setName('logo');
    if (!st.settings.reducedMotion) this.tweens.add({ targets: logo, y: 36, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const title = this.add.text(252, 38, 'ORCHARD MERGE', { fontSize: '36px', color: UI.cream, fontFamily: DISPLAY_FONT, fontStyle: 'bold', stroke: '#0a140e', strokeThickness: 6 }).setOrigin(0.5).setName('title');
    const sub = this.add.text(240, 66, 'Pocket Grove', { fontSize: '14px', color: UI.muted, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    // status pill: offline ready
    const pill = this.add.rectangle(240, 88, 150, 22, 0x1d3a2a, 1).setStrokeStyle(1, 0x7bc96f, 0.7);
    const pillT = this.add.text(240, 88, '🟢 Offline Ready', { fontSize: '11px', color: UI.creamDim, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    pill.setInteractive({ useHandCursor: true });
    pill.on('pointerover', () => this.tip?.show(240, 116, 'Progress saves on this device only. No accounts, no network.'));
    pill.on('pointerout', () => this.tip?.hide());
    // player status card: level + XP bar + coins + gems
    const need = 100 + (st.level - 1) * 120;
    const lvl = this.add.text(16, 108, `Level ${st.level}`, { fontSize: '15px', color: '#d2ffb3', fontFamily: UI_FONT, fontStyle: 'bold' });
    const xbg = this.add.rectangle(16, 130, 200, 14, 0x0a140e, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x7bc96f, 0.5);
    const xfg = this.add.rectangle(17, 130, 198 * Math.min(1, st.xp / Math.max(1, need)), 12, 0x7bc96f, 1).setOrigin(0, 0.5);
    const xpt = this.add.text(224, 130, `${st.xp.toLocaleString('en-US')} / ${need.toLocaleString('en-US')} XP`, { fontSize: '11px', color: UI.muted, fontFamily: NUM_FONT }).setOrigin(0, 0.5);
    const coins = this.add.text(16, 150, `🪙 ${fmt(st.coins)}`, { fontSize: '18px', color: UI.gold, fontFamily: NUM_FONT, fontStyle: 'bold' }).setName('coins');
    const coinPlus = this.add.text(150, 150, '+', { fontSize: '18px', color: UI.gold, fontFamily: UI_FONT, fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    coinPlus.on('pointerover', () => this.tip?.show(170, 176, 'Earn coins by merging. Spend in Orchard.'));
    coinPlus.on('pointerout', () => this.tip?.hide());
    this.onTap(coinPlus, () => { this.scrollY = 0; audio.play('click'); this.tab = 'orchard'; this.orchardSection = 'shop'; this.renderTop(); this.renderTab(); });
    const gems = this.add.text(240, 150, `💎 ${fmt(st.gems)}`, { fontSize: '18px', color: '#9ed8ff', fontFamily: NUM_FONT, fontStyle: 'bold' }).setName('gems');
    const gemBtn = this.add.text(370, 150, '+', { fontSize: '20px', color: '#9ed8ff', fontFamily: UI_FONT, fontStyle: 'bold' }).setInteractive({ useHandCursor: true });
    gemBtn.on('pointerover', () => this.tip?.show(380, 176, 'Trade 2,000 coins for 2 gems. Gems buy rare cosmetics.'));
    gemBtn.on('pointerout', () => this.tip?.hide());
    const ver = this.add.text(464, 108, `v1.0.0 • local save`, { fontSize: '10px', color: UI.faint, fontFamily: UI_FONT }).setOrigin(1, 0);
    this.onTap(gemBtn, () => { // offline earn: convert 2000 coins -> 2 gems (no IAP)
      const s = useMeta.getState();
      if (new Decimal(s.coins).gte(2000)) { s.spendCoins(2000); s.addGems(2); audio.play('purchase'); this.renderTop(); this.renderTab(); }
      else { audio.play('warn'); }
    });
    // nav tabs: icon + label, badges, tooltips, min 44px targets
    const badges = this.tabBadges();
    TABS.forEach((t, i) => {
      const x = 14 + i * 66;
      const sel = t.id === this.tab;
      const b = this.add.rectangle(x + 26, 196, 62, 48, sel ? 0x7bc96f : 0x1d3a2a, 1).setStrokeStyle(2, sel ? 0xeaffdf : 0x7bc96f, sel ? 1 : 0.7).setInteractive({ useHandCursor: true });
      const ic = this.add.text(x + 26, 188, t.icon, { fontSize: '16px' }).setOrigin(0.5);
      const l = this.add.text(x + 26, 208, t.label, { fontSize: '11px', color: sel ? '#0e1f16' : '#cfe8c8', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
      if (sel) {
        const gl = this.add.rectangle(x + 26, 222, 62, 4, 0xeaffdf, 1);
        this.top.add(gl);
      }
      const bd = badges[t.id] ?? 0;
      if (bd > 0) {
        const bb = this.add.circle(x + 50, 176, 10, 0xe84f4f, 1).setStrokeStyle(1, 0xffffff, 0.8);
        const bt = this.add.text(x + 50, 176, bd > 9 ? '9+' : String(bd), { fontSize: '10px', color: '#fff', fontFamily: NUM_FONT, fontStyle: 'bold' }).setOrigin(0.5);
        this.top.add([bb, bt]);
      }
      b.on('pointerover', () => { if (!sel) b.setScale(1.05); this.tip?.show(x + 26, 246, t.tip); });
      b.on('pointerout', () => { b.setScale(1); this.tip?.hide(); });
      this.onTap(b, () => { audio.play('click'); this.tip?.hide(); this.scrollY = 0; this.tab = t.id; this.renderTop(); this.renderTab(); });
      void l; void ic;
    });
    this.top.add([logo, title, sub, pill, pillT, lvl, xbg, xfg, xpt, coins, coinPlus, gems, gemBtn, ver]);
  }

  /** Real notification counts: affordable shop items + unclaimed daily/streak. */
  private tabBadges(): Record<string, number> {
    const st = useMeta.getState();
    let affordable = 0;
    for (const item of SHOP_ITEMS) {
      if (this.isOwned(item.id)) continue;
      const ok = item.cur === 'coins' ? new Decimal(st.coins).gte(item.price) : new Decimal(st.gems).gte(item.price);
      if (ok) affordable++;
    }
    const day = dailySeed();
    const hasDaily = st.missions.daily.some(m => m.id === `d_${day}_` || m.day === day);
    void hasDaily;
    const dailyEntry = this.dailyEntry();
    const dailyOpen = dailyEntry && (dailyEntry.prog >= dailyEntry.d.target) && !(dailyEntry.entry?.claimed) ? 1 : 0;
    const streakOpen = this.streakClaimable() ? 1 : 0;
    return { orchard: Math.min(9, affordable), miss: dailyOpen + streakOpen };
  }

  private clearRoot(): void { this.root.removeAll(true); }
  private y0 = 238;

  private renderTab(): void {
    this.clearRoot();
    if (this.tab === 'play') this.renderPlay();
    else if (this.tab === 'orchard') this.renderOrchard();
    else if (this.tab === 'coll') this.renderCollection();
    else if (this.tab === 'miss') this.renderMissions();
    else if (this.tab === 'ach') this.renderAch();
    else if (this.tab === 'stats') this.renderStats();
    else this.renderSettings();
    this.layoutScroll();
  }

  private renderOrchard(): void {
    // section switch: shop items vs upgrades (all existing functionality kept)
    const secs: Array<'shop'|'up'> = ['shop', 'up'];
    secs.forEach((s, i) => {
      const sel = this.orchardSection === s;
      const b = this.add.rectangle(130 + i * 220, this.y0, 200, 40, sel ? 0x7bc96f : 0x1d3a2a, 1).setStrokeStyle(2, 0x7bc96f, sel ? 1 : 0.6).setInteractive({ useHandCursor: true });
      const l = this.add.text(130 + i * 220, this.y0, s === 'shop' ? '🛒 SHOP' : '⬆ UPGRADES', { fontSize: '14px', color: sel ? '#0e1f16' : '#cfe8c8', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
      this.onTap(b, () => { audio.play('click'); this.orchardSection = s; this.renderTab(); });
      this.root.add([b, l]);
    });
    const keep = this.y0;
    this.y0 = this.y0 + 56;
    if (this.orchardSection === 'shop') this.renderShop();
    else this.renderUpgrades();
    this.y0 = keep;
  }

  private dayKey(d = new Date()): string {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  private fmtCountdown(ms: number): string {
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  private msToMidnight(): number {
    const n = new Date();
    const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0);
    return Math.max(0, mid.getTime() - n.getTime());
  }

  /** Shared daily-challenge lookup for play tab + quests tab. */
  private dailyEntry(): { d: { id: string; name: string; desc: string; target: number; coins: number; xp: number }; entry: { progress: number; claimed: boolean } | undefined; prog: number } | null {
    const day = dailySeed();
    const idx = day.length % DAILY_POOL.length;
    const d = DAILY_POOL[(idx + day.charCodeAt(day.length - 1)) % DAILY_POOL.length];
    const st = useMeta.getState();
    const entry = st.missions.daily.find(m => m.id === `d_${day}_${d.id}`);
    return { d, entry, prog: entry?.progress ?? 0 };
  }

  /** 7-day streak: claimable once per calendar day; breaks on a missed day. */
  private streakState(): { count: number; claimable: boolean; day: string } {
    const st = useMeta.getState();
    const day = this.dayKey();
    const { count, lastDay } = st.stats.streak;
    if (lastDay === day) return { count, claimable: false, day };
    return { count, claimable: true, day };
  }

  private streakClaimable(): boolean {
    return this.streakState().claimable;
  }

  private claimStreak(): void {
    const cur = this.streakState();
    if (!cur.claimable) return;
    const st = useMeta.getState();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const continued = st.stats.streak.lastDay === this.dayKey(y);
    const count = continued ? st.stats.streak.count + 1 : 1;
    const reward = 50 + 50 * Math.min(count, 7);
    st.addCoins(reward); st.addXp(20);
    st.bump(s => ({ stats: { ...s.stats, streak: { count, lastDay: cur.day } } }));
    audio.play('achieve'); audio.buzz(30);
    this.renderTop(); this.renderTab();
  }

  /** Nearest uncompleted milestones by progress ratio (top 3) for the teaser. */
  private nearestMilestones(): Array<{ name: string; prog: number; target: number }> {
    const st = useMeta.getState();
    const vals: Record<string, number> = {
      m_merge20: st.stats.merges, m_merge200: st.stats.merges, m_merge1500: st.stats.merges,
      m_score10k: st.stats.bestScore, m_score100k: st.stats.bestScore, m_score1m: st.stats.bestScore,
      m_chain5: st.stats.bestCombo, m_perfect3: st.stats.perfects,
      m_tier7: st.stats.bestTier, m_tier10: st.stats.bestTier,
      m_coins5k: Number(st.stats.coinsEarned), m_powerup: st.stats.powerupsUsed,
      m_special: st.stats.specials, m_games10: st.stats.games,
    };
    return MILESTONES
      .filter(m => !st.achievements[`ms:${m.id}`])
      .map(m => ({ name: m.name, prog: Math.min(vals[m.id] ?? 0, m.target), target: m.target }))
      .sort((a, b) => (b.prog / b.target) - (a.prog / a.target))
      .slice(0, 3);
  }

  private card(y: number, h: number): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(240, y, 448, h, 0x14301f, 0.95).setStrokeStyle(2, 0x7bc96f, 0.45);
  }

  private btn(x: number, y: number, label: string, cb: () => void, opts: { w?: number; green?: boolean; disabled?: boolean } = {}): void {
    const w = opts.w ?? 200;
    const r = this.add.rectangle(x, y, w, 44, opts.disabled ? 0x2a3a2a : opts.green === false ? 0x4a2440 : 0x7bc96f, 1).setInteractive({ useHandCursor: !opts.disabled });
    const t = this.add.text(x, y, label, { fontSize: '16px', color: opts.disabled ? '#8a9a8a' : opts.green === false ? '#ffd2e8' : '#0e1f16', fontStyle: 'bold' }).setOrigin(0.5);
    if (!opts.disabled) {
      r.on('pointerover', () => { r.setScale(1.03); r.y = y - 2; t.y = y - 2; });
      r.on('pointerout', () => { r.setScale(1); r.y = y; t.y = y; });
      this.onTap(r, cb);
    }
    this.root.add([r, t]);
  }

  private renderPlay(): void {
    const st = useMeta.getState();
    let y = this.y0;
    const qm = MODES.find(m => m.id === this.quickMode) ?? MODES[0];
    // featured quick-play hero
    const hg = this.add.graphics(); pixelPanel(hg, 16, y - 5, 448, 158, { border: qm.accent });
    this.root.add(hg);
    const c = this.card(y + 66, 146); this.root.add(c);
    const illId = MODE_FRUIT[qm.id] ?? 'ciderapple';
    const illDef = fruitById(illId);
    if (illDef) {
      ensureFruitTexture(this, illDef);
      const ill = this.add.image(76, y + 66, fruitTextureKey(illDef.id)).setDisplaySize(72, 72);
      if (!st.settings.reducedMotion) this.tweens.add({ targets: ill, y: y + 58, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.root.add(ill);
    }
    this.root.add(this.add.text(240, y + 12, '⭐ RECOMMENDED', { fontSize: '11px', color: UI.gold, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5));
    this.root.add(this.add.text(240, y + 34, 'Quick Play', { fontSize: '24px', color: '#fff', fontFamily: DISPLAY_FONT, fontStyle: 'bold' }).setOrigin(0.5));
    this.root.add(this.add.text(240, y + 62, `Best ${fmtInt(st.stats.bestScore)}`, { fontSize: '14px', color: UI.gold, fontFamily: NUM_FONT, fontStyle: 'bold', backgroundColor: '#0e1f16', padding: { x: 8, y: 2 } }).setOrigin(0.5));
    this.root.add(this.add.text(240, y + 84, `${st.stats.games} runs`, { fontSize: '12px', color: UI.muted, fontFamily: UI_FONT }).setOrigin(0.5));
    const playLabel = `▶  PLAY ${qm.name.toUpperCase()}`;
    const pby = y + 122; // capture: y keeps mutating below, closures must not use it
    const pb = this.add.rectangle(240, pby, 300, 60, 0x7bc96f, 1).setStrokeStyle(3, 0xeaffdf, 1).setInteractive({ useHandCursor: true });
    const pt = this.add.text(240, pby, playLabel, { fontSize: '20px', color: '#0e1f16', fontFamily: DISPLAY_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    pb.on('pointerover', () => { pb.setScale(1.03); pb.y = pby - 2; });
    pb.on('pointerout', () => { pb.setScale(1); pb.y = pby; });
    this.onTap(pb, () => {
      this.tweens.add({ targets: pb, scaleX: 0.96, scaleY: 0.96, duration: 80, yoyo: true });
      audio.play('start'); audio.buzz(20);
      sweepHighlight(this, 240, pby, 300, 60, st.settings.reducedMotion);
      this.time.delayedCall(140, () => this.scene.start('game', { mode: this.quickMode }));
    });
    const cb = this.add.rectangle(240, y + 162, 220, 34, 0x1d3a2a, 1).setStrokeStyle(1, 0x7bc96f, 0.7).setInteractive({ useHandCursor: true });
    const ct = this.add.text(240, y + 162, `Change Mode: ${qm.name}`, { fontSize: '12px', color: UI.creamDim, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    this.onTap(cb, () => {
      audio.play('click');
      const i = MODES.findIndex(m => m.id === this.quickMode);
      this.quickMode = MODES[(i + 1) % MODES.length].id;
      this.renderTab();
    });
    this.root.add([pb, pt, cb, ct]);
    y += 196;
    // mode cards
    this.root.add(this.add.text(240, y, '— GAME MODES —', { fontSize: '13px', color: UI.gold, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5));
    y += 28;
    MODES.forEach((m) => {
      const card = this.card(y + 46, 96); this.root.add(card);
      // accent spine
      const spine = this.add.rectangle(22, y + 46, 6, 88, m.accent, 1);
      this.root.add(spine);
      const fdef = fruitById(MODE_FRUIT[m.id] ?? 'ciderapple');
      if (fdef) {
        ensureFruitTexture(this, fdef);
        const fi = this.add.image(62, y + 46, fruitTextureKey(fdef.id)).setDisplaySize(52, 52);
        this.root.add(fi);
      }
      this.root.add(this.add.text(96, y + 12, `${m.icon}  ${m.name}`, { fontSize: '16px', color: '#fff', fontFamily: DISPLAY_FONT, fontStyle: 'bold' }).setOrigin(0, 0));
      this.root.add(this.add.text(96, y + 36, m.desc, { fontSize: '12px', color: UI.muted, fontFamily: UI_FONT, wordWrap: { width: 220 } }).setOrigin(0, 0));
      const mb = st.stats.bestByMode[m.id] ?? 0;
      const rec = m.id === 'chill' ? `largest T${st.stats.bestTier}` : mb > 0 ? `best ${fmtInt(mb)}` : 'no record yet';
      this.root.add(this.add.text(96, y + 66, rec, { fontSize: '11px', color: UI.gold, fontFamily: NUM_FONT, fontStyle: 'bold' }).setOrigin(0, 0));
      const diff = this.add.text(330, y + 14, m.difficulty.toUpperCase(), { fontSize: '10px', color: '#0e1f16', fontFamily: UI_FONT, fontStyle: 'bold', backgroundColor: '#eaffdf', padding: { x: 6, y: 2 } }).setOrigin(0.5, 0);
      this.root.add(diff);
      if (m.id === 'chaos' || m.id === 'fountain') this.root.add(this.add.text(330, y + 36, '★ WILD', { fontSize: '11px', color: '#ffd2e8', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5, 0));
      if (m.id === 'hardcore') this.root.add(this.add.text(330, y + 36, '⚠ EXTREME', { fontSize: '11px', color: '#ff8f8f', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5, 0));
      const b = this.add.rectangle(396, y + 46, 96, 44, 0x7bc96f, 1).setInteractive({ useHandCursor: true });
      const l = this.add.text(396, y + 46, 'PLAY', { fontSize: '15px', color: '#0e1f16', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
      const go = () => { audio.play('click'); this.quickMode = m.id; this.scene.start('game', { mode: m.id }); };
      this.onTap(b, go);
      card.setInteractive({ useHandCursor: true });
      this.onTap(card, go);
      this.root.add([b, l]);
      if (m.id === 'daily') {
        const done = st.daily.day === dailySeed() && st.daily.played;
        this.root.add(this.add.text(240, y + 76, done ? `done • ${fmtInt(st.daily.score)}` : 'seeded • 1/day', { fontSize: '11px', color: UI.gold, fontFamily: UI_FONT }).setOrigin(0.5));
      }
      y += 104;
    });
    y += 8;
    // Today in the Orchard: daily challenge + streak
    this.root.add(this.add.text(240, y, '— TODAY IN THE ORCHARD —', { fontSize: '13px', color: UI.gold, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5));
    y += 28;
    const de = this.dailyEntry();
    if (de) {
      const dc = this.card(y + 52, 108); this.root.add(dc);
      this.root.add(this.add.text(240, y + 14, `📅 ${de.d.name}: ${de.d.desc.replace('{t}', String(de.d.target))}`, { fontSize: '14px', color: '#fff', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5));
      const ratio = Math.min(1, de.prog / Math.max(1, de.d.target));
      const pbg = this.add.rectangle(60, y + 42, 220, 14, 0x0a140e, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x7bc96f, 0.5);
      const pfg = this.add.rectangle(61, y + 42, 218 * ratio, 12, 0x7bc96f, 1).setOrigin(0, 0.5);
      this.root.add([pbg, pfg]);
      this.root.add(this.add.text(290, y + 42, `${Math.min(de.prog, de.d.target)} / ${de.d.target}`, { fontSize: '12px', color: UI.creamDim, fontFamily: NUM_FONT, fontStyle: 'bold' }).setOrigin(0, 0.5));
      this.root.add(this.add.text(60, y + 62, `Reward: +${de.d.coins}🪙  •  ends in ${this.fmtCountdown(this.msToMidnight())}`, { fontSize: '12px', color: UI.gold, fontFamily: UI_FONT }).setOrigin(0, 0.5));
      this.btn(370, y + 72, 'PLAY CHALLENGE', () => this.scene.start('game', { mode: 'daily' }), { w: 180 });
      y += 116;
    }
    // streak widget
    {
      const sc = this.card(y + 40, 84); this.root.add(sc);
      const ss = this.streakState();
      this.root.add(this.add.text(40, y + 14, `🔥 ${ss.count}-day streak`, { fontSize: '15px', color: '#fff', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0, 0));
      for (let i = 0; i < 7; i++) {
        const dx = 40 + i * 34;
        const lit = i < Math.min(ss.count, 7);
        const today = i === Math.min(ss.count, 7) && ss.claimable;
        const dot = this.add.circle(dx + 12, y + 48, 11, lit ? 0x7bc96f : 0x1d3a2a, 1).setStrokeStyle(2, lit ? 0xeaffdf : 0x7bc96f, lit ? 1 : 0.5);
        if (today) {
          dot.setFillStyle(0xe8d45f, 1);
          if (!st.settings.reducedMotion) this.tweens.add({ targets: dot, scaleX: 1.2, scaleY: 1.2, duration: 500, yoyo: true, repeat: -1 });
        }
        this.root.add(dot);
        this.root.add(this.add.text(dx + 12, y + 48, `${i + 1}`, { fontSize: '10px', color: lit || today ? '#0e1f16' : '#8aa892', fontFamily: NUM_FONT, fontStyle: 'bold' }).setOrigin(0.5));
      }
      const can = ss.claimable;
      const sb = this.add.rectangle(380, y + 40, 110, 44, can ? 0x7bc96f : 0x2a3a2a, 1).setInteractive({ useHandCursor: can });
      const sl = this.add.text(380, y + 40, can ? `CLAIM +${50 + 50 * Math.min((ss.count + (ss.claimable ? 1 : 0)), 7)}🪙` : 'CLAIMED ✔', { fontSize: '12px', color: can ? '#0e1f16' : '#8a9a8a', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
      if (can) this.onTap(sb, () => this.claimStreak());
      this.root.add([sb, sl]);
      y += 92;
    }
    // quests teaser (max 3) + view all
    {
      const near = this.nearestMilestones();
      this.root.add(this.add.text(240, y, '— NEXT UP —', { fontSize: '13px', color: UI.gold, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5));
      y += 26;
      const collPct = Math.round((st.unlockedFruits.length / FRUITS.length) * 100);
      this.root.add(this.add.text(40, y, `🍓 Collection ${collPct}%  •  🏆 ${ACHIEVEMENTS.filter(a => st.achievements[a.id]).length}/${ACHIEVEMENTS.length} medals`, { fontSize: '12px', color: UI.muted, fontFamily: UI_FONT }).setOrigin(0, 0));
      y += 22;
      near.forEach(n => {
        this.root.add(this.add.text(40, y, `○ ${n.name} (${n.prog}/${n.target})`, { fontSize: '12px', color: UI.creamDim, fontFamily: UI_FONT }).setOrigin(0, 0));
        y += 20;
      });
      this.btn(240, y + 20, 'VIEW ALL QUESTS', () => { this.tab = 'miss'; this.renderTop(); this.renderTab(); }, { w: 240 });
      y += 52;
    }
    // footer
    this.root.add(this.add.text(240, y + 6, 'v1.0.0  •  Saved locally ✓  •  100% offline', { fontSize: '11px', color: UI.faint, fontFamily: UI_FONT }).setOrigin(0.5));
    const foot: Array<[string, () => void]> = [
      ['Credits', () => this.showModal('Credits', 'Orchard Merge — Pocket Grove.\nMade with Phaser, Matter.js and WebAudio.\nFruit art is 100% procedural.\nThanks for playing!')],
      ['Access', () => { this.tab = 'set'; this.renderTop(); this.renderTab(); }],
      ['Privacy', () => this.showModal('Privacy', 'Everything stays on this device:\ncoins, gems, upgrades, stats.\nNo accounts. No tracking. No network\ncalls during play. Reset anytime\nfrom Setup.')],
      ['Backup', () => this.copySaveBackup()],
    ];
    foot.forEach(([label, cb], i) => {
      const fx = 70 + i * 114;
      const fb = this.add.text(fx, y + 28, label, { fontSize: '12px', color: UI.muted, fontFamily: UI_FONT, fontStyle: 'bold', backgroundColor: '#1d3a2a', padding: { x: 10, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.onTap(fb, () => { audio.play('click'); cb(); });
      this.root.add(fb);
    });
  }

  private showModal(title: string, body: string): void {
    const m = this.add.container(0, 0).setDepth(60);
    const dim = this.add.rectangle(240, 400, 480, 800, 0x000000, 0.6).setInteractive({ useHandCursor: true });
    const g = this.add.graphics(); pixelPanel(g, 60, 220, 360, 320);
    const t = this.add.text(240, 260, title, { fontSize: '22px', color: UI.cream, fontFamily: DISPLAY_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    const b = this.add.text(240, 360, body, { fontSize: '14px', color: UI.creamDim, fontFamily: UI_FONT, align: 'center', lineSpacing: 6, wordWrap: { width: 300 } }).setOrigin(0.5);
    const { bg, tx } = pixelButton(this, null, 240, 490, 200, 48, 'CLOSE', true, () => m.destroy());
    dim.on('pointerdown', () => m.destroy());
    this.onTap(bg, () => m.destroy());
    m.add([dim, g, t, b, bg, tx]);
  }

  private copySaveBackup(): void {
    try {
      const raw = localStorage.getItem('grove.save.v1') ?? '{}';
      void navigator.clipboard?.writeText(raw).then(
        () => this.showModal('Backup', 'Save copied to clipboard!\nPaste it somewhere safe.'),
        () => this.showModal('Backup', 'Clipboard blocked by browser.\nYour save lives in this\nbrowser\'s local storage.'),
      );
    } catch { this.showModal('Backup', 'Clipboard unavailable.'); }
  }

  private renderShop(): void {
    const filters = ['fruits', 'powerups', 'cosmetics', 'boosts'];
    filters.forEach((f, i) => {
      const b = this.add.rectangle(60 + i * 110, this.y0, 100, 34, this.shopFilter === f ? 0x7bc96f : 0x1d3a2a, 1).setStrokeStyle(1, 0x7bc96f, 0.6).setInteractive({ useHandCursor: true });
      const l = this.add.text(60 + i * 110, this.y0, f.toUpperCase(), { fontSize: '12px', color: this.shopFilter === f ? '#0e1f16' : '#cfe8c8', fontStyle: 'bold' }).setOrigin(0.5);
      this.onTap(b, () => { this.shopFilter = f; this.renderTab(); });
      this.root.add([b, l]);
    });
    // daily rotation banner (seeded, offline)
    const st0 = useMeta.getState();
    void st0;
    const day = dailySeed();
    const rot = SHOP_ITEMS.filter(s => s.tab === this.shopFilter).slice(0, 12);
    let y = this.y0 + 40;
    // deterministic featured today
    let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const featured = rot[h % Math.max(1, rot.length)];
    if (featured) {
      const fc = this.card(y + 30, 60); this.root.add(fc);
      this.root.add(this.add.text(240, y + 12, `✨ TODAY: ${featured.name} — ${featured.price}${featured.cur === 'gems' ? '💎' : '🪙'}`, { fontSize: '13px', color: '#ffe9a8', fontStyle: 'bold' }).setOrigin(0.5));
      this.root.add(this.add.text(240, y + 32, featured.desc, { fontSize: '12px', color: '#cfe8c8' }).setOrigin(0.5));
      y += 70;
    }
    for (const item of rot) {
      const st = useMeta.getState();
      const owned = this.isOwned(item.id);
      const afford = item.cur === 'coins' ? new Decimal(st.coins).gte(item.price) : new Decimal(st.gems).gte(item.price);
      const card = this.card(y + 44, 88); this.root.add(card);
      this.root.add(this.add.text(34, y + 16, `${item.icon}  ${item.name}`, { fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0));
      this.root.add(this.add.text(34, y + 40, item.desc, { fontSize: '12px', color: '#9ec8a8', wordWrap: { width: 250 } }).setOrigin(0, 0));
      const label = owned ? 'OWNED' : `${item.price}${item.cur === 'gems' ? '💎' : '🪙'}`;
      const b = this.add.rectangle(380, y + 44, 110, 40, owned ? 0x2a3a2a : afford ? 0x7bc96f : 0x4a3a2a, 1).setInteractive({ useHandCursor: !owned });
      const l = this.add.text(380, y + 44, label, { fontSize: '13px', color: owned ? '#8a9a8a' : '#0e1f16', fontStyle: 'bold' }).setOrigin(0.5);
      if (!owned) this.onTap(b, () => this.buy(item.id));
      else if (item.tab === 'cosmetics' && item.id.startsWith('theme_')) {
        const th = item.id.replace('theme_', '');
        this.onTap(b, () => { useMeta.getState().bump(s => ({ equipped: { ...s.equipped, theme: th } })); audio.play('click'); this.renderTab(); });
        l.setText(useMeta.getState().equipped.theme === th ? 'ACTIVE' : 'EQUIP');
      }
      this.root.add([b, l]);
      y += 96;
      if (y > 1500) break;
    }
  }

  private isOwned(id: string): boolean {
    const st = useMeta.getState();
    if (id.startsWith('unlock_')) {
      const map: Record<string, string> = { unlock_sunplum: 'sunplum', unlock_honeyapricot: 'honeyapricot', unlock_ciderapple: 'ciderapple', unlock_emberpeach: 'emberpeach', unlock_frostmelon: 'frostmelon', unlock_solarplum: 'solarplum', unlock_cosmicfig: 'cosmicfig', unlock_everbloom: 'everbloom', unlock_worldseed: 'worldseed' };
      return st.unlockedFruits.includes(map[id] ?? id);
    }
    if (id.startsWith('theme_') || id.startsWith('trail_') || id.startsWith('fx_')) return st.ownedCosmetics.includes(id.replace('theme_', '').replace('trail_', 'trail_').replace('fx_', 'fx_')) || st.ownedCosmetics.includes(id);
    return false;
  }

  private buy(id: string): void {
    const item = SHOP_ITEMS.find(s => s.id === id)!;
    const st = useMeta.getState();
    const ok = item.cur === 'coins' ? st.spendCoins(item.price) : st.spendGems(item.price);
    if (!ok) { audio.play('warn'); return; }
    audio.play('purchase'); audio.buzz(30);
    if (id.startsWith('unlock_')) {
      const map: Record<string, string> = { unlock_sunplum: 'sunplum', unlock_honeyapricot: 'honeyapricot', unlock_ciderapple: 'ciderapple', unlock_emberpeach: 'emberpeach', unlock_frostmelon: 'frostmelon', unlock_solarplum: 'solarplum', unlock_cosmicfig: 'cosmicfig', unlock_everbloom: 'everbloom', unlock_worldseed: 'worldseed' };
      const fid = map[id];
      st.bump(s => ({ unlockedFruits: [...new Set([...s.unlockedFruits, fid])] }));
    } else if (id.startsWith('pu_')) {
      const map: Record<string, string> = { pu_hammer: 'hammer', pu_shuffle: 'shuffle', pu_freeze: 'freeze', pu_magnet: 'magnet', pu_clear: 'prune', pu_lucky: 'lucky' };
      const pid = map[id];
      st.bump(s => ({ powerups: { ...s.powerups, [pid]: (s.powerups[pid] ?? 0) + 1 } }));
    } else if (id.startsWith('theme_') || id.startsWith('trail_') || id.startsWith('fx_')) {
      st.bump(s => ({ ownedCosmetics: [...new Set([...s.ownedCosmetics, id, id.replace('theme_', '')])] }));
      if (id.startsWith('theme_')) st.bump(s => ({ equipped: { ...s.equipped, theme: id.replace('theme_', '') } }));
    } else if (id.startsWith('boost_')) {
      const map: Record<string, string> = { boost_coins25: 'coins25', boost_score50: 'score50', boost_luck: 'luck', boost_calm: 'calm' };
      st.bump(s => ({ boosts: { ...s.boosts, [map[id]]: 1 } }));
    }
    st.bump(s => ({ achievements: s.achievements })); // persist
    // purchase pop
    const t = this.add.text(240, 300, `✔ ${item.name}!`, { fontSize: '20px', color: '#d2ffb3', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: 240, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    this.renderTop(); this.renderTab();
  }

  private renderUpgrades(): void {
    const st = useMeta.getState();
    this.root.add(this.add.text(240, this.y0 - 8, `Coins mult ×${coinMult(st).toFixed(2)}  •  Score mult ×${scoreMult(st).toFixed(2)}`, { fontSize: '12px', color: '#ffd97a' }).setOrigin(0.5));
    let y = this.y0 + 20;
    for (const u of upgradeDefs) {
      const lvl = st.upgrades[u.id] ?? 0;
      const maxed = lvl >= u.max;
      const cost = Math.floor(u.base * Math.pow(u.growth, lvl));
      const card = this.card(y + 44, 92); this.root.add(card);
      this.root.add(this.add.text(34, y + 12, `${u.name}  Lv ${lvl}/${u.max}`, { fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0));
      this.root.add(this.add.text(34, y + 36, u.desc, { fontSize: '12px', color: '#9ec8a8' }).setOrigin(0, 0));
      const b = this.add.rectangle(380, y + 48, 110, 40, maxed ? 0x2a3a2a : 0x7bc96f, 1).setInteractive({ useHandCursor: !maxed });
      const l = this.add.text(380, y + 48, maxed ? 'MAX' : `${cost}🪙`, { fontSize: '13px', color: maxed ? '#8a9a8a' : '#0e1f16', fontStyle: 'bold' }).setOrigin(0.5);
      if (!maxed) this.onTap(b, () => {
        const s = useMeta.getState();
        if (s.spendCoins(cost)) { s.setUpgrade(u.id, lvl + 1); audio.play('upgrade'); audio.buzz(25); this.renderTop(); this.renderTab(); }
        else audio.play('warn');
      });
      this.root.add([b, l]);
      y += 100;
    }
  }

  private renderCollection(): void {
    const st = useMeta.getState();
    let y = this.y0;
    for (const f of FRUITS) {
      const known = st.unlockedFruits.includes(f.id);
      const merges = st.stats.perFruitMerges[f.id] ?? 0;
      const card = this.card(y + 40, 84); this.root.add(card);
      if (known) {
        ensureFruitTexture(this, f);
        this.root.add(this.add.image(52, y + 40, fruitTextureKey(f.id)).setDisplaySize(52, 52));
      } else {
        this.root.add(this.add.text(52, y + 40, '❓', { fontSize: '30px' }).setOrigin(0.5));
      }
      const col = RARITY_COLORS[f.rarity] ?? 0xffffff;
      this.root.add(this.add.text(90, y + 12, known ? f.name : '???', { fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(0, 0));
      this.root.add(this.add.text(90, y + 36, known ? `${f.rarity} • T${f.tier} • ${merges} merges • ${f.desc}` : `Unlock at level ${f.unlockLevel}`, { fontSize: '11px', color: '#9ec8a8', wordWrap: { width: 320 } }).setOrigin(0, 0));
      this.root.add(this.add.circle(420, y + 24, 8, col));
      y += 92;
    }
  }

  private renderMissions(): void {
    const st = useMeta.getState();
    let y = this.y0;
    this.root.add(this.add.text(240, y, '— Daily (local date, offline) —', { fontSize: '13px', color: '#ffe9a8', fontStyle: 'bold' }).setOrigin(0.5));
    y += 26;
    const day = dailySeed();
    const idx = day.length % DAILY_POOL.length;
    const d = DAILY_POOL[(idx + day.charCodeAt(day.length - 1)) % DAILY_POOL.length];
    const entry = st.missions.daily.find(m => m.id === `d_${day}_${d.id}`);
    const prog = entry?.progress ?? 0;
    const card = this.card(y + 34, 72); this.root.add(card);
    this.root.add(this.add.text(240, y + 12, `${d.name}: ${d.desc.replace('{t}', String(d.target))}  (${Math.min(prog, d.target)}/${d.target})`, { fontSize: '13px', color: '#fff' }).setOrigin(0.5));
    const canClaim = prog >= d.target && !(entry?.claimed);
    this.btn(240, y + 48, canClaim ? `CLAIM +${d.coins}🪙` : entry?.claimed ? 'CLAIMED ✔' : 'IN PROGRESS…', () => {
      const s = useMeta.getState();
      s.addCoins(d.coins); s.addXp(d.xp);
      s.bump(prev => ({ missions: { ...prev.missions, daily: prev.missions.daily.map(m => m.id === `d_${day}_${d.id}` ? { ...m, claimed: true } : m) } }));
      audio.play('achieve'); this.renderTop(); this.renderTab();
    }, { disabled: !canClaim });
    y += 84;
    this.root.add(this.add.text(240, y, '— Milestones —', { fontSize: '13px', color: '#ffe9a8', fontStyle: 'bold' }).setOrigin(0.5));
    y += 26;
    for (const m of MILESTONES) {
      const done = !!st.achievements[`ms:${m.id}`];
      const c = this.card(y + 30, 64); this.root.add(c);
      this.root.add(this.add.text(34, y + 8, `${done ? '✔' : '○'} ${m.name} — ${m.desc}`, { fontSize: '13px', color: done ? '#8a9a8a' : '#fff' }).setOrigin(0, 0));
      this.root.add(this.add.text(34, y + 30, `+${m.rewardCoins}🪙 +${m.rewardGems}💎 +${m.rewardXp}xp`, { fontSize: '12px', color: '#ffd97a' }).setOrigin(0, 0));
      y += 72;
      if (y > 1600) break;
    }
  }

  private renderAch(): void {
    const st = useMeta.getState();
    let y = this.y0;
    for (const a of ACHIEVEMENTS) {
      const got = !!st.achievements[a.id];
      const c = this.card(y + 30, 64); this.root.add(c);
      this.root.add(this.add.text(34, y + 8, `${got ? '🏆' : '🔒'} ${a.name}`, { fontSize: '14px', color: got ? '#ffe9a8' : '#8a9a8a', fontStyle: 'bold' }).setOrigin(0, 0));
      this.root.add(this.add.text(34, y + 30, `${a.desc}  •  +${a.coins}🪙 +${a.gems}💎`, { fontSize: '12px', color: '#9ec8a8' }).setOrigin(0, 0));
      y += 72;
    }
  }

  private renderStats(): void {
    const st = useMeta.getState();
    const rows: Array<[string, string]> = [
      ['Runs', String(st.stats.games)], ['Merges', String(st.stats.merges)], ['Dropped', String(st.stats.dropped)],
      ['Best score', fmtInt(st.stats.bestScore)], ['Best chain', `×${st.stats.bestCombo}`], ['Best tier', `T${st.stats.bestTier}`],
      ['Coins earned', fmt(st.stats.coinsEarned)], ['Gems earned', fmt(st.stats.gemsEarned)],
      ['Play time', `${Math.floor(st.stats.playSec / 60)}m ${st.stats.playSec % 60}s`],
      ['Perfects', String(st.stats.perfects)], ['Specials', String(st.stats.specials)], ['Power-ups used', String(st.stats.powerupsUsed)],
      ['Level', String(st.level)], ['Fruits found', `${st.unlockedFruits.length}/${FRUITS.length}`],
    ];
    let y = this.y0;
    rows.forEach(([k, v]) => {
      const c = this.card(y + 20, 44); this.root.add(c);
      this.root.add(this.add.text(40, y + 20, k, { fontSize: '14px', color: '#9ec8a8' }).setOrigin(0, 0.5));
      this.root.add(this.add.text(420, y + 20, v, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0.5));
      y += 52;
    });
    // theme equip quick row
    y += 10;
    this.root.add(this.add.text(240, y, 'Backdrop', { fontSize: '14px', color: '#ffe9a8', fontStyle: 'bold' }).setOrigin(0.5));
    y += 30;
    THEMES.forEach((t, i) => {
      const owned = st.ownedCosmetics.includes(t.id) || t.price === 0;
      const col = i % 3; const row = Math.floor(i / 3);
      const x = 80 + col * 160; const yy = y + row * 52;
      const b = this.add.rectangle(x, yy, 140, 42, st.equipped.theme === t.id ? 0x7bc96f : 0x1d3a2a, 1).setStrokeStyle(1, 0x7bc96f, 0.6).setInteractive({ useHandCursor: true });
      const l = this.add.text(x, yy, owned ? t.name : `${t.name} 🔒`, { fontSize: '11px', color: st.equipped.theme === t.id ? '#0e1f16' : '#cfe8c8', fontStyle: 'bold' }).setOrigin(0.5);
      this.onTap(b, () => { if (owned) { useMeta.getState().bump(s => ({ equipped: { ...s.equipped, theme: String(t.id) } })); audio.play('click'); this.renderTab(); } });
      this.root.add([b, l]);
    });
  }

  private renderSettings(): void {
    const st = useMeta.getState();
    const rows: Array<{ k: 'sound'|'music'|'ambience'|'muted'|'haptics'|'reducedMotion'|'colorSafe'|'assist'|'screenShake'|'screenFlash'; label: string }> = [
      { k: 'sound', label: 'Sound FX' }, { k: 'music', label: 'Music' }, { k: 'ambience', label: 'Orchard ambience' }, { k: 'muted', label: 'Master mute' }, { k: 'haptics', label: 'Haptics' },
      { k: 'reducedMotion', label: 'Reduced motion' }, { k: 'colorSafe', label: 'Colour-safe + labels' },
      { k: 'assist', label: 'Drop assist' }, { k: 'screenShake', label: 'Screen shake' }, { k: 'screenFlash', label: 'Screen flash' },
    ];
    let y = this.y0;
    rows.forEach((r) => {
      const on = !!st.settings[r.k];
      const c = this.card(y + 22, 48); this.root.add(c);
      this.root.add(this.add.text(40, y + 22, r.label, { fontSize: '14px', color: '#fff' }).setOrigin(0, 0.5));
      const b = this.add.rectangle(380, y + 22, 100, 34, on ? 0x7bc96f : 0x4a2440, 1).setInteractive({ useHandCursor: true });
      const l = this.add.text(380, y + 22, on ? 'ON' : 'OFF', { fontSize: '13px', color: on ? '#0e1f16' : '#ffd2e8', fontStyle: 'bold' }).setOrigin(0.5);
      this.onTap(b, () => {
        const s = useMeta.getState();
        s.setSetting(r.k, !on as never);
        audio.applySettings({ ...useMeta.getState().settings });
        if (r.k === 'muted') audio.setMuted(!on);
        if (useMeta.getState().settings.music) audio.crossfade('menu');
        audio.play('click'); this.renderTab();
      });
      this.root.add([b, l]);
      y += 56;
    });
    // volume sliders (draggable, persistent, applied live)
    const vols: Array<{ k: 'masterVol'|'musicVol'|'sfxVol'; label: string }> = [
      { k: 'masterVol', label: 'Master' }, { k: 'musicVol', label: 'Music vol' }, { k: 'sfxVol', label: 'SFX vol' },
    ];
    vols.forEach((v) => {
      const val = st.settings[v.k] ?? 0.8;
      const c = this.card(y + 24, 52); this.root.add(c);
      this.root.add(this.add.text(40, y + 24, v.label, { fontSize: '14px', color: '#fff' }).setOrigin(0, 0.5));
      const trackX = 165; const trackW = 185; const cy = y + 24;
      const pct = this.add.text(425, cy, `${Math.round(val * 100)}%`, { fontSize: '13px', color: '#ffd97a', fontStyle: 'bold' }).setOrigin(0.5);
      // wide invisible hit zone so the slider is easy to grab
      const zone = this.add.rectangle(trackX + trackW / 2, cy, trackW + 16, 40, 0xffffff, 0).setInteractive({ useHandCursor: true });
      const trackBg = this.add.graphics();
      const drawSlider = (t: number) => {
        if (!trackBg.active) return;
        trackBg.clear();
        trackBg.fillStyle(0x0a140e, 1);
        trackBg.fillRoundedRect(trackX, cy - 6, trackW, 12, 6);
        trackBg.lineStyle(1, 0x7bc96f, 0.6);
        trackBg.strokeRoundedRect(trackX, cy - 6, trackW, 12, 6);
        if (t > 0.005) {
          trackBg.fillStyle(v.k === 'musicVol' ? 0x9ed8ff : v.k === 'sfxVol' ? 0xffd97a : 0x7bc96f, 1);
          trackBg.fillRoundedRect(trackX + 2, cy - 4, Math.max(4, (trackW - 4) * t), 8, 4);
        }
        trackBg.fillStyle(0xeaffdf, 1);
        trackBg.fillCircle(trackX + trackW * t, cy, 11);
        trackBg.lineStyle(2, 0x7bc96f, 1);
        trackBg.strokeCircle(trackX + trackW * t, cy, 11);
        pct.setText(`${Math.round(t * 100)}%`);
      };
      drawSlider(val);
      let dragging = false;
      const commit = (pointerX: number, preview: boolean) => {
        const t = Math.min(1, Math.max(0, (pointerX - trackX) / trackW));
        const nv = Math.round(t * 100) / 100;
        drawSlider(nv);
        const s = useMeta.getState();
        s.setSetting(v.k, nv as never);
        audio.applySettings({ ...useMeta.getState().settings });
        if (preview) {
          if (v.k === 'sfxVol' || v.k === 'masterVol') audio.play('click');
        }
      };
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        dragging = true;
        commit(p.x, false);
      });
      const onMove = (p: Phaser.Input.Pointer) => {
        if (!dragging || !p.isDown) return;
        commit(p.x, false);
      };
      this.input.on('pointermove', onMove);
      this.input.once('pointerup', () => {
        this.input.off('pointermove', onMove);
        if (dragging) {
          dragging = false;
          const s = useMeta.getState();
          if (v.k === 'sfxVol' || v.k === 'masterVol') audio.play('click');
          void s;
        }
      });
      this.root.add([pct, trackBg, zone]);
      y += 60;
    });
    // quality
    this.root.add(this.add.text(40, y + 14, 'Quality (FX only, never physics)', { fontSize: '13px', color: '#9ec8a8' }).setOrigin(0, 0));
    y += 40;
    (['low', 'medium', 'high', 'ultra'] as const).forEach((q, i) => {
      const b = this.add.rectangle(70 + i * 100, y, 90, 34, st.settings.quality === q ? 0x7bc96f : 0x1d3a2a, 1).setStrokeStyle(1, 0x7bc96f, 0.6).setInteractive({ useHandCursor: true });
      const l = this.add.text(70 + i * 100, y, q.toUpperCase(), { fontSize: '12px', color: st.settings.quality === q ? '#0e1f16' : '#cfe8c8', fontStyle: 'bold' }).setOrigin(0.5);
      this.onTap(b, () => { useMeta.getState().setSetting('quality', q); audio.play('click'); this.renderTab(); });
      this.root.add([b, l]);
    });
    y += 50;
    this.btn(240, y, '🎓 REPLAY TUTORIAL', () => {
      useMeta.getState().bump(s => ({ seen: { ...s.seen, tutorial: false } }));
      audio.play('click');
      this.scene.start('game', { mode: 'classic' });
    }, { w: 320 });
    y += 54;
    this.btn(240, y, '🗑 RESET SAVE (local only)', () => {
      void clearSave().then(() => window.location.reload());
    }, { green: false, w: 320 });
    y += 54;
    this.root.add(this.add.text(240, y, 'All data stays on this device. No accounts, no network.', { fontSize: '12px', color: '#8a9a8a' }).setOrigin(0.5));
    void fruitById;
  }
}
