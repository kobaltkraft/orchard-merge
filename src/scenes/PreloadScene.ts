import Phaser from 'phaser';
import { FRUITS, SPECIAL_DEFS } from '../config/fruitConfig';
import { ensureFruitTexture, ensureBlinkTexture, ensureSparkTexture } from '../effects/fruitArt';
import { loadSave } from '../persistence/SaveManager';
import { useMeta } from '../store/meta';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('preload'); }
  create(): void {
    // Procedural textures: no remote assets, works fully offline.
    // Blink variants double the texture count but each is generated once and cached.
    for (const f of [...FRUITS, ...SPECIAL_DEFS]) { ensureFruitTexture(this, f); ensureBlinkTexture(this, f); }
    ensureSparkTexture(this);
    // Loading bar is instant (all procedural) — still show brand.
    const t = this.add.text(240, 400, 'Pocket Grove…', { fontSize: '28px', color: '#cfe8c8' }).setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0.4, duration: 300, yoyo: true, repeat: 1 });
    void loadSave().then((s) => {
      useMeta.getState().hydrate(s);
      this.time.delayedCall(450, () => this.scene.start('menu'));
    });
  }
}
