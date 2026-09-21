// Procedural page dressing for the letterbox gutters around the 480x800 canvas.
// Everything is generated locally at boot: no images, no network, PWA-safe.
// A seeded RNG keeps the panorama identical on every load.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintPanorama(): string {
  const W = 1600; const H = 900;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const rnd = mulberry32(20260921);

  // night orchard sky: deep forest top -> lighter center -> dark ground
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070f0a');
  sky.addColorStop(0.45, '#10241a');
  sky.addColorStop(0.75, '#0b1710');
  sky.addColorStop(1, '#060c08');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // moon glow, upper-left so it never hides behind the game column
  const moonX = 210; const moonY = 150;
  const glow = g.createRadialGradient(moonX, moonY, 10, moonX, moonY, 260);
  glow.addColorStop(0, 'rgba(255,246,216,0.5)');
  glow.addColorStop(0.25, 'rgba(255,246,216,0.14)');
  glow.addColorStop(1, 'rgba(255,246,216,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fdf6d8';
  g.beginPath(); g.arc(moonX, moonY, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(230,220,180,0.5)';
  g.beginPath(); g.arc(moonX - 14, moonY - 8, 9, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(moonX + 12, moonY + 14, 6, 0, Math.PI * 2); g.fill();

  // distant tree silhouettes, kept to the outer thirds
  const treeRow = (yBase: number, sMin: number, sMax: number, color: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const edge = rnd();
      const x = edge < 0.5 ? rnd() * W * 0.3 : W * 0.7 + rnd() * W * 0.3;
      const s = sMin + rnd() * (sMax - sMin);
      const y = yBase + (rnd() - 0.5) * 60;
      g.fillStyle = color;
      g.fillRect(x - s * 0.08, y - s * 0.7, s * 0.16, s * 0.9); // trunk
      // blobby canopy
      for (let b = 0; b < 7; b++) {
        const bx = x + (rnd() - 0.5) * s * 1.1;
        const by = y - s * 0.7 + (rnd() - 0.5) * s * 0.5;
        const br = s * (0.22 + rnd() * 0.2);
        g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      }
    }
  };
  treeRow(560, 120, 220, '#0a140d', 14); // far row
  treeRow(640, 150, 260, '#0d1a10', 10); // near row

  // rolling hill silhouette along the bottom
  g.fillStyle = '#050a06';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, 760);
  for (let x = 0; x <= W; x += 40) {
    g.lineTo(x, 748 + Math.sin(x * 0.008 + 1.2) * 26 + Math.sin(x * 0.02) * 8);
  }
  g.lineTo(W, H);
  g.closePath(); g.fill();

  // grass tufts on the hills
  g.strokeStyle = '#122716';
  g.lineWidth = 3;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const edgeBias = Math.min(x, W - x) / (W * 0.5); // denser near edges
    if (rnd() > 0.25 + edgeBias * 0.75) continue;
    const y = 800 + rnd() * 80;
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x - 5, y - 12 - rnd() * 10);
    g.moveTo(x, y); g.lineTo(x + 4, y - 10 - rnd() * 12);
    g.stroke();
  }

  // static fireflies baked in (animated ones float above via DOM)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W; const y = rnd() * H * 0.8;
    const r = 1 + rnd() * 2.2;
    const a = 0.15 + rnd() * 0.5;
    g.fillStyle = `rgba(255,240,170,${a.toFixed(2)})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // gentle vignette to seat the game column
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);

  return cv.toDataURL('image/png');
}

function mountFireflies(): void {
  const layer = document.createElement('div');
  layer.id = 'grove-fireflies';
  const n = 14;
  const rnd = mulberry32(77);
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    const leftEdge = rnd() < 0.5;
    // park fireflies in the gutters, away from the centered game column
    s.style.left = leftEdge ? `${2 + rnd() * 26}%` : `${72 + rnd() * 26}%`;
    s.style.top = `${8 + rnd() * 80}%`;
    s.style.animationDuration = `${7 + rnd() * 9}s`;
    s.style.animationDelay = `${-rnd() * 12}s`;
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
}

export function installSideArt(): void {
  try {
    document.body.style.backgroundColor = '#0e1f16';
    document.body.style.backgroundImage = `url("${paintPanorama()}")`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat = 'no-repeat';
  } catch { /* keep flat background */ }
  try {
    const css = document.createElement('style');
    css.textContent = [
      '#app{position:fixed;inset:0;z-index:1;}',
      '#grove-fireflies{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}',
      '#grove-fireflies span{position:absolute;width:5px;height:5px;border-radius:50%;',
      'background:radial-gradient(circle,#fff6c8 0%,rgba(255,240,170,0.7) 40%,rgba(255,240,170,0) 70%);',
      'animation-name:grove-drift;animation-iteration-count:infinite;animation-timing-function:ease-in-out;}',
      '@keyframes grove-drift{0%,100%{transform:translate(0,0);opacity:0.25;}',
      '25%{opacity:0.9;}50%{transform:translate(26px,-42px);opacity:0.4;}75%{opacity:0.85;}}',
      '@media (prefers-reduced-motion: reduce){#grove-fireflies{display:none;}}',
    ].join('');
    document.head.appendChild(css);
    mountFireflies();
  } catch { /* dressing is optional */ }
}
