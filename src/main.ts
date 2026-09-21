import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';
import { installNetGuard } from './utils/netGuard';
import { installSideArt } from './ui/sideArt';
import { installSidePanels, installCanvasA11y } from './ui/sidePanels';

installNetGuard();
installSideArt();
installSidePanels();
installCanvasA11y();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: gameConfig.width,
  height: gameConfig.height,
  backgroundColor: '#0e1f16',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      enableSleeping: true,
      positionIterations: 6,
      velocityIterations: 4,
      constraintIterations: 2,
      debug: false,
    },
  },
  render: { antialias: true, pixelArt: false },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, PauseScene, GameOverScene],
  fps: { target: 60 },
};

new Phaser.Game(config);

// PWA registration (local service worker only, no remote caching)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

// Dev-only debug panel (tweakpane) + perf overlay (stats-gl), excluded from prod bundle via dynamic import.
// Gated behind ?debug=1 so normal dev play looks like the finished game.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')) {
  void import('./dev/debug').then((m) => m.mountDebug()).catch(() => undefined);
}
