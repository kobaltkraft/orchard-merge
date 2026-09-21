import { FRUITS } from '../config/fruitConfig';

// Desktop-only DOM side panels (evolution chart + run companion).
// Shown only on wide viewports via CSS media query; fully inert on mobile.
// Fed by lightweight CustomEvents from scenes — never touches gameplay.
export interface PanelState {
  screen: 'menu' | 'game' | 'over' | 'pause';
  score?: number;
  best?: number;
  merges?: number;
  chain?: number;
  tierName?: string;
  timeLeft?: number;
  modeName?: string;
}

const TIPS = [
  'Match two of a kind — bigger fruits are worth far more.',
  'Heavy fruits settle stacks. Drop them in gaps.',
  'Chains multiply score. Set up double merges!',
  'Special fruits appear on a pity timer — keep dropping.',
  'The ghost shows the true landing footprint.',
  'Hammer not needed? Save boosts for tight jars.',
];

let tipIdx = 0;
let built = false;

function fruitDot(color: string): string {
  return `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};margin-right:8px;vertical-align:-1px;"></span>`;
}

export function installSidePanels(): void {
  if (built) return;
  built = true;
  try {
    const wrap = document.createElement('div');
    wrap.id = 'grove-side';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;justify-content:space-between;align-items:center;padding:0 24px;box-sizing:border-box;z-index:0;';
    const panelCss = 'width:230px;background:rgba(20,48,31,0.88);border:2px solid #7bc96f;border-radius:14px;padding:16px 14px;color:#fff8e8;font:13px/1.5 Verdana,sans-serif;';
    const left = document.createElement('div');
    left.style.cssText = panelCss;
    const rows = FRUITS.map(f => `<div style="margin:3px 0;">${fruitDot(f.body)}${f.name}</div>`).join('');
    left.innerHTML = `<div style="font-weight:bold;color:#ffd97a;margin-bottom:8px;">🌳 EVOLUTION</div>${rows}`;
    const right = document.createElement('div');
    right.style.cssText = panelCss;
    right.id = 'grove-companion';
    right.innerHTML = `<div style="font-weight:bold;color:#ffd97a;margin-bottom:8px;">🍎 GROVE</div><div id="grove-live">Welcome back, farmer!</div><div id="grove-tip" style="margin-top:10px;color:#cfe3c2;font-size:12px;"></div>`;
    wrap.appendChild(left);
    wrap.appendChild(right);
    document.body.appendChild(wrap);
    window.setInterval(() => {
      const el = document.getElementById('grove-tip');
      if (el && window.matchMedia('(min-width:1100px)').matches) {
        tipIdx = (tipIdx + 1) % TIPS.length;
        el.textContent = `Tip: ${TIPS[tipIdx]}`;
      }
    }, 9000);
  } catch { /* dressing is optional */ }
}

export function pushPanelState(s: PanelState): void {
  try {
    if (!window.matchMedia('(min-width:1100px)').matches) return;
    const el = document.getElementById('grove-live');
    if (!el) return;
    if (s.screen === 'game') {
      el.innerHTML =
        `<div style="font-size:20px;font-weight:bold;">${(s.score ?? 0).toLocaleString('en-US')}</div>` +
        `<div style="color:#cfe3c2;font-size:12px;">${s.modeName ?? ''} • best ${(s.best ?? 0).toLocaleString('en-US')}</div>` +
        `<div style="color:#cfe3c2;font-size:12px;">${s.merges ?? 0} merges${(s.chain ?? 0) >= 2 ? ` • 🔥×${s.chain}` : ''}${s.tierName ? ` • ${s.tierName}` : ''}</div>`;
    } else if (s.screen === 'menu') {
      el.textContent = 'Pick a mode and grow something great.';
    } else if (s.screen === 'over') {
      el.textContent = 'Run over — one more?';
    } else {
      el.textContent = 'Paused. The grove waits.';
    }
  } catch { /* ignore */ }
}

/** Canvas keyboard-focus + screen-reader labelling (best-effort for canvas). */
export function installCanvasA11y(): void {
  try {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries++;
      const cv = document.querySelector('#app canvas') as HTMLCanvasElement | null;
      if (cv) {
        cv.setAttribute('tabindex', '0');
        cv.setAttribute('role', 'application');
        cv.setAttribute('aria-label', 'Orchard Merge game. Use arrow keys to aim, space to drop, number keys for boosts, P to pause.');
        window.clearInterval(timer);
      } else if (tries > 40) window.clearInterval(timer);
    }, 100);
  } catch { /* ignore */ }
}
