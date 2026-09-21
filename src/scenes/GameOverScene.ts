import Phaser from 'phaser';
import { useMeta } from '../store/meta';
import { audio } from '../audio/AudioManager';
import { fmt, fmtInt } from '../utils/NumberFormat';
import { FRUITS } from '../config/fruitConfig';
import { ensureFruitTexture, fruitTextureKey } from '../effects/fruitArt';
import { pixelPanel, pixelButton, UI_FONT, UI } from '../ui/theme';
import { pushPanelState } from '../ui/sidePanels';
import type { GameModeId } from '../config/gameConfig';

interface OverData {
  score: number; coins: string; combo: number; mode: GameModeId;
  bestTier?: number; merges?: number; isBest?: boolean; isNewTier?: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() { super('gameover'); }
  create(data: OverData): void {
    const st = useMeta.getState();
    pushPanelState({ screen: 'over' });
    audio.ensure();
    audio.applySettings(st.settings);
    this.cameras.main.setBackgroundColor('#0a1410');
    this.cameras.main.fadeIn(300, 6, 13, 9);
    const g = this.add.graphics();
    g.fillGradientStyle(0x1d3a2a, 0x1d3a2a, 0x0a1410, 0x0a1410, 1);
    g.fillRect(0, 0, 480, 800);
    for (let i = 0; i < 22; i++) {
      this.add.circle(Math.random() * 480, Math.random() * 800, 1 + Math.random() * 3, 0x7bc96f, 0.12);
    }

    const cx = 240;
    const title = this.add.text(cx, 120, '🍂 Run Over', { fontSize: '36px', color: UI.cream, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, y: 132, alpha: 1, duration: 400, ease: 'Back.easeOut' });

    if (data.isBest) {
      const badge = this.add.text(cx, 168, '★ NEW BEST! ★', { fontSize: '22px', color: '#0e1f16', fontFamily: UI_FONT, fontStyle: 'bold', backgroundColor: '#e8d45f', padding: { x: 14, y: 6 } }).setOrigin(0.5).setScale(0.6);
      this.tweens.add({ targets: badge, scaleX: 1, scaleY: 1, duration: 350, ease: 'Back.easeOut' });
      this.tweens.add({ targets: badge, scaleX: 1.06, scaleY: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 400 });
    }

    // score panel with count-up
    const pg = this.add.graphics();
    pixelPanel(pg, cx - 200, 193, 400, 150);
    this.add.text(cx, 208, 'FINAL SCORE', { fontSize: '13px', color: UI.muted, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    const scoreT = this.add.text(cx, 248, '0', { fontSize: '44px', color: '#ffffff', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    const target = data.score;
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter, v: target, duration: Math.min(1500, 400 + target / 40), ease: 'Cubic.easeOut',
      onUpdate: () => scoreT.setText(fmtInt(Math.floor(counter.v))),
      onComplete: () => { scoreT.setText(fmtInt(target)); if (data.isBest) audio.play('highscore'); },
    });
    this.add.text(cx, 296, `+${fmt(data.coins)}  🪙 earned this run`, { fontSize: '16px', color: UI.gold, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 320, `Best ${fmtInt(st.stats.bestScore)}  •  ${data.mode.toUpperCase()}`, { fontSize: '13px', color: UI.muted, fontFamily: UI_FONT }).setOrigin(0.5);
    const modeBest = st.stats.bestByMode[data.mode] ?? 0;
    if (modeBest > 0) this.add.text(cx, 340, `★ Best in ${data.mode.toUpperCase()}: ${fmtInt(modeBest)}`, { fontSize: '12px', color: UI.goldDeep, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);

    // stat rows: best combo, merges, highest fruit
    let y = 372;
    const row = (label: string, value: string) => {
      const rg = this.add.graphics();
      pixelPanel(rg, cx - 200, y - 22, 400, 44, { fill: UI.panelDark, alpha: 0.9 });
      this.add.text(60, y, label, { fontSize: '14px', color: UI.muted, fontFamily: UI_FONT }).setOrigin(0, 0.5);
      this.add.text(420, y, value, { fontSize: '15px', color: '#fff', fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(1, 0.5);
      y += 52;
    };
    row('Best chain', `×${Math.max(data.combo, 0)}`);
    row('Merges', String(data.merges ?? '—'));
    const bt = data.bestTier ?? -1;
    const tierName = this.tierName(bt);
    row('Highest fruit', tierName);
    if (data.isNewTier && bt >= 0) {
      this.add.text(cx, y + 2, '🌟 NEW DISCOVERY!', { fontSize: '15px', color: UI.goldDeep, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5);
      y += 22;
    }
    const topDef = this.topDef(bt);
    if (topDef && bt >= 6) {
      this.add.text(cx, y + 2, `You grew a ${topDef.name}!`, { fontSize: '15px', color: UI.cream, fontFamily: UI_FONT, fontStyle: 'bold', stroke: '#0a140e', strokeThickness: 4 }).setOrigin(0.5);
      y += 24;
    }

    // highest-fruit showcase
    if (topDef) {
      ensureFruitTexture(this, topDef);
      const img = this.add.image(cx, y + 44, fruitTextureKey(topDef.id)).setDisplaySize(84, 84);
      this.tweens.add({ targets: img, y: y + 36, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.text(cx, y + 92, topDef.name, { fontSize: '14px', color: '#e8d45f', fontStyle: 'bold' }).setOrigin(0.5);
      y += 112;
    } else {
      y += 8;
    }

    const mkBtn = (by: number, label: string, cb: () => void, primary: boolean) => {
      const r = this.add.rectangle(cx, by, 300, 56, primary ? 0x7bc96f : 0x1d3a2a, 1)
        .setStrokeStyle(2, 0x7bc96f, primary ? 1 : 0.7)
        .setInteractive({ useHandCursor: true }).setAlpha(0).setScale(0.9);
      const t = this.add.text(cx, by, label, { fontSize: primary ? '19px' : '16px', color: primary ? '#0e1f16' : UI.cream, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: [r, t], alpha: 1, scaleX: 1, scaleY: 1, duration: 300, delay: by > 600 ? 350 : 200, ease: 'Back.easeOut' });
      r.on('pointerover', () => r.setScale(1.03));
      r.on('pointerout', () => r.setScale(1));
      r.on('pointerdown', () => { audio.play('click'); cb(); });
      void t;
      return by + 66;
    };
    let by = y + 30;
    by = mkBtn(by, '↻ ONE MORE RUN', () => this.scene.start('game', { mode: data.mode }), true);
    by = mkBtn(by, '🏠 MENU / SHOP', () => this.scene.start('menu'), false);

    const need = 100 + (st.level - 1) * 120;
    this.add.text(cx, by + 6, `Lv ${st.level} — ${st.xp}/${need} XP  •  💎 ${fmt(st.gems)}`, { fontSize: '14px', color: '#9ed8ff', fontFamily: UI_FONT }).setOrigin(0.5);
  }

  private tierName(tier: number): string {
    const f = FRUITS.find(f => f.tier === tier);
    if (f) return `${f.name} (T${tier})`;
    return tier >= 90 ? 'Special' : '—';
  }

  private topDef(tier: number): import('../config/fruitConfig').FruitDef | null {
    return FRUITS.find(f => f.tier === tier) ?? null;
  }
}
