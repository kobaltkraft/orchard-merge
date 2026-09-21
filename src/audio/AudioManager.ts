// Procedural offline audio: synthesized SFX + looped music via WebAudio. No remote assets.
// Hand-picked .ogg samples (bundled locally, precached by the PWA) replace the
// core game-feel sounds; the synth engine stays as fallback + for UI/melodic stingers.
import coinUrl from './sfx/0a701e6c-b059-4c26-9bc5-4a06c73adbca.ogg?url';
import mergeUrl from './sfx/0dad60a0-4866-4253-9c21-327dadefe77e.ogg?url';
import chainUrl from './sfx/0f0fe119-fc2a-465c-9ac0-7b7134c4dc58.ogg?url';
import popUrl from './sfx/1e824a81-1140-420b-a232-2551be8000fd.ogg?url';
import bigUrl from './sfx/1f002f13-0fd5-45e2-aa87-7a0cd66a6c39.ogg?url';
import bigHiUrl from './sfx/2b5c786d-227a-4cc1-a2e7-37087fae3874.ogg?url';
import overUrl from './sfx/2b2b883e-8ed6-4b46-a6e7-8c7906428334.ogg?url';
import swellUrl from './sfx/2bb36ca2-24fc-4dee-8816-cd3be61b2573.ogg?url';
import dropUrl from './sfx/00e4a952-8b77-486d-90d3-ae756c4e1661.ogg?url';
import landUrl from './sfx/083f5a72-3332-45d9-869c-e1f8b1bac1dc.ogg?url';
import bounceUrl from './sfx/3167d087-9f6c-4c23-b581-d64d4396cc76.ogg?url';
import spawnUrl from './sfx/17035d84-b6dc-4130-ba07-c31f77b22595.ogg?url';
import clickUrl from './sfx/90d91583-2b43-43f9-901b-dae404e3690e.ogg?url';
import purchaseUrl from './sfx/1f8076f3-d6e1-439a-a69a-257a187954e1.ogg?url';
import powerUrl from './sfx/0621c931-69ba-417f-8240-7362c18d380c.ogg?url';
import settlingUrl from './Settling In.mp3?url';
import grandpaUrl from "./Grandpa's Theme (1).mp3?url";
import overtureUrl from './Overture.mp3?url';
type SfxName = 'drop'|'spawn'|'land'|'bounce'|'merge'|'chain'|'big'|'purchase'|'upgrade'|'achieve'|'over'|'warn'|'click'|'power'|'levelup'|'coin'|'start'|'highscore'|'pop'|'sparkle';

// Bundled sample per sound: hand-trimmed gains so hot masters sit in the mix.
// (Peaks were measured; each gain ≈ 0.9/peak × slot level.)
const SAMPLES: Partial<Record<SfxName, { url: string; gain: number }>> = {
  coin: { url: coinUrl, gain: 0.8 },
  merge: { url: mergeUrl, gain: 0.55 },
  chain: { url: chainUrl, gain: 0.55 },
  pop: { url: popUrl, gain: 0.5 },
  big: { url: bigUrl, gain: 0.6 },
  over: { url: overUrl, gain: 0.8 },
  drop: { url: dropUrl, gain: 0.7 },
  land: { url: landUrl, gain: 0.55 },
  bounce: { url: bounceUrl, gain: 0.45 },
  spawn: { url: spawnUrl, gain: 0.45 },
  click: { url: clickUrl, gain: 0.55 },
  purchase: { url: purchaseUrl, gain: 0.8 },
  power: { url: powerUrl, gain: 0.8 },
};
// Standalone special samples (not 1:1 with SfxName).
const BIG_HI = { url: bigHiUrl, gain: 0.65 }; // mythic-tier big merges
const SWELL = { url: swellUrl, gain: 0.35 }; // epic layer under huge merges
const SWELL_FANFARE = { url: swellUrl, gain: 0.5 }; // highscore moment

class AudioMan {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  enabled = true; musicOn = true; hapticsOn = true;
  masterVol = 0.8; musicVol = 0.32; sfxVol = 0.9;
  muted = false; ambienceOn = true;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private ambienceTimer: ReturnType<typeof setInterval> | null = null;
  // Main theme: the three bundled tracks on endless loop.
  private playlist: string[] = [];
  private trackIdx = 0;
  private currentTrack: AudioBufferSourceNode | null = null;
  private currentTrackGain: GainNode | null = null;
  private lastPlay: Record<string, number> = {};
  private activeVoices = 0;
  private static MAX_VOICES = 10;
  private buffers = new Map<string, AudioBuffer>();
  private inflight = new Map<string, Promise<AudioBuffer | null>>();
  private preloadStarted = false;

  /** Decode (and cache) one bundled sample. Never throws; null on failure. */
  private loadSample(url: string): Promise<AudioBuffer | null> {
    const hit = this.buffers.get(url);
    if (hit) return Promise.resolve(hit);
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const p = (async (): Promise<AudioBuffer | null> => {
      try {
        if (!this.ctx) return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const raw = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(raw);
        this.buffers.set(url, buf);
        return buf;
      } catch {
        return null; // Safari/vorbis gaps etc. -> procedural fallback
      } finally {
        this.inflight.delete(url);
      }
    })();
    this.inflight.set(url, p);
    return p;
  }

  private preloadSamples(): void {
    if (this.preloadStarted || !this.ctx) return;
    this.preloadStarted = true;
    const urls = new Set<string>([BIG_HI.url, SWELL.url]);
    for (const s of Object.values(SAMPLES)) urls.add(s.url);
    for (const u of urls) void this.loadSample(u);
  }

  /**
   * Play a bundled sample. Returns true if it actually sounded.
   * Falls back to false when still loading/decoding so callers can synth instead.
   */
  private sample(key: string, url: string, gain: number, rate = 1): boolean {
    if (!this.ctx || !this.sfxGain || !this.enabled) return false;
    if (this.activeVoices >= AudioMan.MAX_VOICES) return true; // busy: swallow, don't double up
    const buf = this.buffers.get(url);
    if (!buf) { void this.loadSample(url); return false; }
    try {
      this.activeVoices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.min(1.35, Math.max(0.7, rate));
      const g = this.ctx.createGain();
      g.gain.value = Math.max(0.001, gain);
      src.connect(g); g.connect(this.sfxGain);
      src.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
      src.start(t);
      this.gate(key, 0); // mark played for throttle bookkeeping
      return true;
    } catch {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      return false;
    }
  }

  private gatedSample(gateName: string, gateMs: number, url: string, gain: number, rate = 1): boolean {
    if (!this.gate(gateName, gateMs)) return true; // throttled counts as handled
    return this.sample(gateName, url, gain, rate);
  }

  ensure(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); this.preloadSamples(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); this.master.gain.value = this.masterVol; this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol; this.musicGain.connect(this.master);
      this.preloadSamples();
    } catch { /* no audio device */ }
  }
  setEnabled(on: boolean): void { this.enabled = on; }
  setMusic(on: boolean): void { this.musicOn = on; if (!on) this.stopMusic(); }
  setHaptics(on: boolean): void { this.hapticsOn = on; }
  setVolumes(master: number, music: number, sfx: number): void {
    this.masterVol = master; this.musicVol = music; this.sfxVol = sfx;
    try {
      if (this.master) this.master.gain.setTargetAtTime(master, this.ctx?.currentTime ?? 0, 0.02);
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(music, this.ctx?.currentTime ?? 0, 0.02);
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(sfx, this.ctx?.currentTime ?? 0, 0.02);
    } catch { /* ignore */ }
  }
  applySettings(s: { sound: boolean; music: boolean; haptics: boolean; masterVol: number; musicVol: number; sfxVol: number; muted?: boolean; ambience?: boolean }): void {
    this.enabled = s.sound; this.hapticsOn = s.haptics;
    this.muted = !!s.muted; this.ambienceOn = s.ambience ?? true;
    this.setVolumes(s.muted ? 0 : s.masterVol, s.musicVol, s.sfxVol);
    this.masterVol = s.masterVol;
    this.setMusic(s.music);
    if (this.ambienceOn) this.startAmbience(); else this.stopAmbience();
  }
  setMuted(m: boolean): void {
    this.muted = m;
    try { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.masterVol, this.ctx?.currentTime ?? 0, 0.02); } catch { /* ignore */ }
  }

  private gate(name: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.lastPlay[name] ?? -1e9) < ms) return false;
    this.lastPlay[name] = now;
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, when = 0, dest?: GainNode | null): void {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    if (this.activeVoices >= AudioMan.MAX_VOICES) return;
    this.activeVoices++;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(30, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
  }
  private noise(dur: number, vol: number, when = 0, low = 400): void {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    if (this.activeVoices >= AudioMan.MAX_VOICES) return;
    this.activeVoices++;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t);
    src.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
  }

  play(name: SfxName, opt: { pitch?: number; tier?: number } = {}): void {
    this.ensure();
    if (!this.enabled) return;
    const p = opt.pitch ?? 1; const tier = opt.tier ?? 0;
    // Tier-pitched base: deeper + richer for higher tiers
    const base = 340 * Math.pow(1.1, Math.min(tier, 13)) * p;
    switch (name) {
      case 'click': if (!this.gatedSample('click', 50, SAMPLES.click!.url, SAMPLES.click!.gain)) { this.tone(420, 0.06, 'triangle', 0.22, -80); this.noise(0.03, 0.1, 0, 2500); } break;
      case 'spawn': if (!this.gatedSample('spawn', 90, SAMPLES.spawn!.url, SAMPLES.spawn!.gain, p)) { this.tone(520 * p, 0.09, 'sine', 0.16, 160); } break;
      case 'drop': break; // drop click removed — silent by design
      case 'land': if (!this.gatedSample('land', 110, SAMPLES.land!.url, SAMPLES.land!.gain, 0.9 + Math.random() * 0.2)) { this.tone(180 * p, 0.07, 'triangle', 0.1, -30); this.noise(0.05, 0.08, 0, 700); } break;
      case 'bounce': if (!this.gatedSample('bounce', 140, SAMPLES.bounce!.url, SAMPLES.bounce!.gain, 0.9 + Math.random() * 0.2)) { this.tone(220 * p, 0.06, 'triangle', 0.1, -40); } break;
      case 'coin': if (!this.gatedSample('coin', 90, SAMPLES.coin!.url, SAMPLES.coin!.gain)) { this.tone(990, 0.08, 'square', 0.12); this.tone(1320, 0.14, 'square', 0.1, 0, 0.06); } break;
      case 'start': this.tone(392, 0.14, 'triangle', 0.3); this.tone(523, 0.14, 'triangle', 0.3, 0, 0.1); this.tone(659, 0.22, 'triangle', 0.32, 0, 0.2); break;
      case 'merge': if (!this.gatedSample('merge', 60, SAMPLES.merge!.url, SAMPLES.merge!.gain, 1 + Math.min(tier, 13) * 0.025)) { this.tone(base, 0.22, 'sine', 0.45, base * 0.5); this.noise(0.12, 0.22, 0, 1200); } break;
      case 'chain': if (!this.gatedSample('chain', 70, SAMPLES.chain!.url, SAMPLES.chain!.gain, 1 + Math.min(tier, 13) * 0.02)) { this.tone(base * 1.25, 0.3, 'square', 0.18, base); this.tone(base * 1.5, 0.28, 'sine', 0.36, base * 0.6, 0.05); } break;
      case 'big': {
        if (!this.gate('big', 90)) break;
        const hi = tier >= 8;
        const main = hi ? BIG_HI : SAMPLES.big!;
        if (!this.sample('big', main.url, main.gain, hi ? 1 : 1 + Math.min(tier, 13) * 0.015)) {
          this.tone(base * 0.55, 0.55, 'sawtooth', 0.26, base * 0.8); this.noise(0.35, 0.36, 0, 850); this.tone(base * 1.6, 0.42, 'sine', 0.34, 200, 0.08); this.tone(base * 0.28, 0.6, 'sine', 0.3, -40, 0.02); if (tier >= 8) this.tone(55, 0.5, 'sine', 0.4, -15);
        } else if (tier >= 6) {
          // epic swell layered under huge merges
          this.sample('biglayer', SWELL.url, SWELL.gain, 0.9 + Math.min(tier, 13) * 0.01);
        }
        break;
      }
      case 'highscore': if (!this.sample('highscore', SWELL_FANFARE.url, SWELL_FANFARE.gain, 1)) { /* fallback: soft triad */ this.tone(523, 0.22, 'triangle', 0.25, 0, 0); this.tone(784, 0.3, 'triangle', 0.25, 0, 0.12); } break;
      case 'purchase': if (!this.gatedSample('purchase', 120, SAMPLES.purchase!.url, SAMPLES.purchase!.gain)) { this.tone(880, 0.1, 'sine', 0.32); this.tone(1320, 0.14, 'sine', 0.28, 0, 0.09); } break;
      case 'upgrade': [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.28, 0, i * 0.08)); break;
      case 'achieve': [659, 880, 1174, 1318].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.3, 0, i * 0.09)); break;
      case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.28, 0, i * 0.08)); break;
      case 'over': if (!this.sample('over', SAMPLES.over!.url, SAMPLES.over!.gain, 1)) { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.32, -40, i * 0.16)); } break;
      case 'warn': if (this.gate('warn', 900)) { this.tone(440, 0.18, 'square', 0.16); this.tone(440, 0.18, 'square', 0.16, 0, 0.25); } break;
      case 'power': if (!this.gatedSample('power', 120, SAMPLES.power!.url, SAMPLES.power!.gain)) { this.tone(200, 0.4, 'sawtooth', 0.22, 600); this.tone(1200, 0.3, 'sine', 0.22, -400, 0.1); } break;
      case 'pop': if (!this.gatedSample('pop', 70, SAMPLES.pop!.url, SAMPLES.pop!.gain, p)) { this.tone(700 * p, 0.09, 'sine', 0.3, 500); this.noise(0.06, 0.15, 0, 2000); } break;
      case 'sparkle': if (this.gate('sparkle', 90)) { [880, 1174, 1568, 2093].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.22, 0, i * 0.06)); this.noise(0.25, 0.1, 0, 4000); } break;
    }
  }
  buzz(pattern: number | number[] = 20): void {
    if (!this.hapticsOn) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ }
  }
  startMusic(_mode = 'menu'): void {
    this.ensure();
    if (!this.musicOn || !this.ctx || !this.musicGain) return;
    if (this.playlist.length === 0) {
      this.playlist = [settlingUrl, grandpaUrl, overtureUrl];
    }
    if (this.currentTrack) return; // already looping
    void this.playNextTrack();
  }

  private async playNextTrack(): Promise<void> {
    if (!this.ctx || !this.musicGain || !this.musicOn) { this.currentTrack = null; return; }
    const url = this.playlist[this.trackIdx % this.playlist.length];
    this.trackIdx++;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('track fetch failed');
      const raw = await res.arrayBuffer();
      if (!this.ctx || !this.musicGain || !this.musicOn) { this.currentTrack = null; return; }
      const buf = await this.ctx.decodeAudioData(raw);
      if (!this.musicOn || !this.ctx || !this.musicGain) { this.currentTrack = null; return; }
      // peak-normalize so no track blasts louder than the old synth mix
      let peak = 0;
      for (let ch = 0; ch < Math.min(2, buf.numberOfChannels); ch++) {
        const d = buf.getChannelData(ch);
        const step = Math.max(1, Math.floor(d.length / 20000));
        for (let i = 0; i < d.length; i += step) {
          const a = Math.abs(d[i]);
          if (a > peak) peak = a;
        }
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = peak > 0.01 ? Math.min(1, 0.85 / peak) : 1;
      src.connect(g); g.connect(this.musicGain);
      src.onended = () => {
        if (this.currentTrack === src) {
          this.currentTrack = null;
          this.currentTrackGain = null;
          if (this.musicOn) void this.playNextTrack();
        }
      };
      this.currentTrack = src;
      this.currentTrackGain = g;
      src.start();
    } catch {
      this.currentTrack = null;
      this.currentTrackGain = null;
      if (this.musicOn) {
        window.setTimeout(() => { if (this.musicOn) void this.playNextTrack(); }, 1500);
      }
    }
  }
  stopMusic(): void {
    try {
      const t = this.currentTrack;
      this.currentTrack = null;
      this.currentTrackGain = null;
      if (t) { t.onended = null; t.stop(); }
    } catch { /* ignore */ }
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
  crossfade(mode: string): void { void mode; this.stopMusic(); this.startMusic(mode); }
  /** Subtle generative orchard ambience: wind, leaves, distant birds. Very quiet by design. */
  startAmbience(): void {
    this.ensure();
    if (!this.ctx || !this.musicGain || this.ambienceTimer || !this.ambienceOn) return;
    this.ambienceTimer = setInterval(() => {
      if (!this.ctx || !this.musicGain || !this.ambienceOn || !this.musicOn) return;
      if (document.hidden || !this.enabled) return;
      try {
        const t = this.ctx.currentTime;
        const r = Math.random();
        if (r < 0.45) {
          // soft wind gust: filtered noise swell
          const dur = 1.6 + Math.random() * 1.4;
          const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
          const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) { const k = Math.sin((i / len) * Math.PI); d[i] = (Math.random() * 2 - 1) * k * 0.5; }
          const src = this.ctx.createBufferSource(); src.buffer = buf;
          const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
          const g = this.ctx.createGain(); g.gain.value = 0.05;
          src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t);
        } else if (r < 0.75) {
          // leaves rustle: short high noise tick
          const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
          o.type = 'sine'; o.frequency.value = 2500 + Math.random() * 2000;
          g.gain.setValueAtTime(0.02, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.2);
        } else {
          // distant bird: two-note chirp
          const f0 = 2200 + Math.random() * 1400;
          const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f0, t);
          o.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + 0.09);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.18);
          g.gain.setValueAtTime(0.035, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.32);
        }
      } catch { /* ignore */ }
    }, 2600);
  }
  stopAmbience(): void { if (this.ambienceTimer) { clearInterval(this.ambienceTimer); this.ambienceTimer = null; } }
}

export const audio = new AudioMan();
export type { SfxName };
