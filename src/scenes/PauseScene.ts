import Phaser from 'phaser';
import { useMeta } from '../store/meta';
import { audio } from '../audio/AudioManager';
import { fmt } from '../utils/NumberFormat';
import { pixelPanel, pixelButton, UI_FONT, UI } from '../ui/theme';
import { pushPanelState } from '../ui/sidePanels';
import type { GameModeId } from '../config/gameConfig';

export class PauseScene extends Phaser.Scene {
  private mode: GameModeId = 'classic';
  private score = 0; private elapsed = 0;
  constructor() { super('pause'); }

  init(data: { mode?: GameModeId; score?: number; elapsed?: number }): void {
    this.mode = data.mode ?? 'classic';
    this.score = data.score ?? 0;
    this.elapsed = data.elapsed ?? 0;
  }

  create(): void {
    const st = useMeta.getState();
    pushPanelState({ screen: 'pause' });
    const W = this.scale.width; const H = this.scale.height;
    // dim backdrop over frozen game (depth 0), panel (10), content (11+)
    this.add.rectangle(W / 2, H / 2, W, H, 0x060d09, 0.72).setDepth(0);
    const pg = this.add.graphics().setDepth(10);
    pixelPanel(pg, W / 2 - 180, H / 2 - 240, 360, 480);
    this.tweens.add({ targets: pg, scaleX: 1.01, scaleY: 1.01, duration: 160, yoyo: true, ease: 'Quad.easeOut' });

    this.add.text(W / 2, H / 2 - 190, '⏸ PAUSED', { fontSize: '32px', color: UI.cream, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5).setDepth(11);
    this.add.text(W / 2, H / 2 - 156, 'Take a breath. The grove waits.', { fontSize: '13px', color: UI.muted, fontFamily: UI_FONT }).setOrigin(0.5).setDepth(11);
    if (this.score > 0 || this.elapsed > 0) {
      this.add.text(W / 2, H / 2 - 132, `Score ${fmt(this.score)}  •  ${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`, { fontSize: '13px', color: UI.gold, fontFamily: UI_FONT, fontStyle: 'bold' }).setOrigin(0.5).setDepth(11);
    }

    const btn = (y: number, label: string, cb: () => void, primary = false) => {
      const { bg, tx } = pixelButton(this, null, W / 2, y, 280, 52, label, primary, () => { audio.play('click'); cb(); });
      bg.setDepth(11); tx.setDepth(12);
    };

    btn(H / 2 - 90, '▶  RESUME', () => this.resumeGame(), true);
    btn(H / 2 - 36, '↻  RESTART', () => {
      this.scene.stop('game');
      this.scene.stop('pause');
      this.scene.start('game', { mode: this.mode });
    });
    btn(H / 2 + 18, `🔊 SOUND: ${st.settings.sound ? 'ON' : 'OFF'}`, () => {
      const s = useMeta.getState();
      s.setSetting('sound', !s.settings.sound);
      audio.applySettings({ ...useMeta.getState().settings });
      this.scene.restart({ mode: this.mode });
    });
    btn(H / 2 + 72, `🎵 MUSIC: ${st.settings.music ? 'ON' : 'OFF'}`, () => {
      const s = useMeta.getState();
      s.setSetting('music', !s.settings.music);
      audio.applySettings({ ...useMeta.getState().settings });
      if (useMeta.getState().settings.music) audio.crossfade('game');
      this.scene.restart({ mode: this.mode });
    });
    btn(H / 2 + 126, `${st.settings.muted ? '🔇 UNMUTE' : '🔈 MUTE'} (M)`, () => {
      const s = useMeta.getState();
      s.setSetting('muted', !s.settings.muted);
      audio.setMuted(!st.settings.muted);
      this.scene.restart({ mode: this.mode });
    });
    btn(H / 2 + 180, '🏠 QUIT TO MENU', () => {
      this.scene.stop('game');
      this.scene.stop('pause');
      this.scene.start('menu');
    });

    this.add.text(W / 2, H / 2 + 218, 'P / ESC to resume', { fontSize: '12px', color: '#8a9a8a' }).setOrigin(0.5).setDepth(11);
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
    audio.play('click');
  }

  private resumeGame(): void {
    this.scene.stop('pause');
    this.scene.resume('game');
  }
}
