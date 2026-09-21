// Dev-only debug tools. Imported dynamically from main.ts in DEV only so prod stays clean.
export async function mountDebug(): Promise<void> {
  const [{ Pane }, { useMeta }] = await Promise.all([import('tweakpane'), import('../store/meta')]);
  const pane = new Pane({ title: 'Grove Lab (dev only)' }) as unknown as { addFolder: (o: { title: string }) => { addButton: (o: { title: string }) => { on: (e: string, cb: () => void) => void } } };
  const f = pane.addFolder({ title: 'ECONOMY' });
  f.addButton({ title: '+1000 coins' }).on('click', () => useMeta.getState().addCoins(1000));
  f.addButton({ title: '+10 gems' }).on('click', () => useMeta.getState().addGems(10));
  f.addButton({ title: '+all powerups' }).on('click', () =>
    useMeta.getState().bump((s) => ({ powerups: { ...s.powerups, hammer: 5, shuffle: 5, freeze: 5, magnet: 5, prune: 5, lucky: 5 } })),
  );
  const g = pane.addFolder({ title: 'NOTE' });
  g.addButton({ title: 'physics tuned in fruitConfig' }).on('click', () => undefined);
  // stats-gl overlay (perf)
  try {
    const Stats = (await import('stats-gl')).default;
    const stats = new Stats({ trackGPU: false } as never);
    stats.dom.style.position = 'fixed';
    stats.dom.style.top = '0'; stats.dom.style.right = '0'; stats.dom.style.zIndex = '9999';
    document.body.appendChild(stats.dom);
    const loop = (): void => { stats.update(); requestAnimationFrame(loop); };
    loop();
  } catch { /* ignore */ }
}
