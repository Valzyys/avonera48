import type { Cue, SfxName, VoName } from "../timeline";
import type { Greeting } from "../useGreeting";

export type Bed = "main" | "standby" | "countdown";

const BASE = "/preshow/audio";
const SFX: SfxName[] = ["riser", "impact", "whoosh-in", "whoosh-out", "shimmer", "tick", "pop", "swell", "final-hit", "beep", "beep-high"];
const VO_FILES = ["welcome-pagi", "welcome-siang", "welcome-sore", "welcome-malam", "etiquette", "stay-tuned", "countdown", "outro"];
const db = (v: number) => Math.pow(10, v / 20);
const BGM_GAIN = db(-18);
const DUCK_GAIN = db(-28);
const VO_GAIN = db(-6);
const SFX_GAIN = db(-12);
const LOOKAHEAD = 0.2;

/**
 * The pre-show's sound: one looping bed (main / standby / countdown), sound
 * effects and voice lines scheduled from the timeline a little ahead of
 * time, with the bed ducked under the voice. Everything goes through one
 * master gain and an analyser (for the Stay Tuned visualiser).
 *
 * The audio clock also drives the loop while sound is on: `loopPos()` maps
 * AudioContext time onto loop seconds, anchored where the visuals were when
 * sound came on, so picture and sound stay on the same beat.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private master!: GainNode;
  private bgmBus!: GainNode;
  private sfxBus!: GainNode;
  private voBus!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private bed: { name: Bed; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private anchorCtx = 0;
  private anchorLoop = 0;
  private scheduledUpTo = -1;
  private loopLength = 150;

  get running() {
    return !!this.ctx && this.ctx.state === "running";
  }

  /** Builds the graph and loads every file; call from a click (autoplay rules). */
  async enable(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.master.connect(this.analyser).connect(ctx.destination);
      this.bgmBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.voBus = ctx.createGain();
      this.bgmBus.gain.value = BGM_GAIN;
      this.sfxBus.gain.value = SFX_GAIN;
      this.voBus.gain.value = VO_GAIN;
      for (const b of [this.bgmBus, this.sfxBus, this.voBus]) b.connect(this.master);
    }
    await this.ctx.resume();
    this.loading ??= this.load();
    await this.loading;
  }

  private async load() {
    const probe = document.createElement("audio");
    const ext = probe.canPlayType('audio/webm; codecs="opus"') ? "webm" : "m4a";
    const files = [...(["main", "standby", "countdown"] as const).map((n) => `bgm/${n}`), ...SFX.map((n) => `sfx/${n}`), ...VO_FILES.map((n) => `vo/${n}`)];
    await Promise.all(
      files.map(async (f) => {
        try {
          const res = await fetch(`${BASE}/${f}.${ext}`);
          if (!res.ok) return; // a missing voice line is fine
          this.buffers.set(f, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
        } catch {
          /* undecodable: play without it */
        }
      }),
    );
  }

  setMuted(muted: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.08);
  }

  /** Ties loop time to the audio clock from here on. */
  anchor(loopPos: number, loopLength: number) {
    if (!this.ctx) return;
    this.anchorCtx = this.ctx.currentTime;
    this.anchorLoop = loopPos;
    this.loopLength = loopLength;
    this.scheduledUpTo = loopPos;
  }

  /** Loop seconds since the start of the loop timeline (unwrapped). */
  loopPos() {
    return this.ctx ? this.anchorLoop + (this.ctx.currentTime - this.anchorCtx) : 0;
  }

  /** Starts (or crossfades to) a bed. `main` starts at the loop position so it matches the picture. */
  playBed(name: Bed, fade = 2) {
    const ctx = this.ctx;
    const buf = this.buffers.get(`bgm/${name}`);
    if (!ctx || !buf || this.bed?.name === name) return;
    const t = ctx.currentTime;
    const old = this.bed;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      old.src.stop(t + fade + 0.05);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = name === "main" ? Math.min(buf.duration, this.loopLength) : buf.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + (old ? fade : 0.6));
    src.connect(gain).connect(this.bgmBus);
    const offset = name === "main" ? ((this.loopPos() % src.loopEnd) + src.loopEnd) % src.loopEnd : 0;
    src.start(t, offset);
    this.track(src);
    this.bed = { name, src, gain };
  }

  stopBed(fade = 1) {
    if (!this.ctx || !this.bed) return;
    const t = this.ctx.currentTime;
    this.bed.gain.gain.cancelScheduledValues(t);
    this.bed.gain.gain.setValueAtTime(this.bed.gain.gain.value, t);
    this.bed.gain.gain.linearRampToValueAtTime(0, t + fade);
    this.bed.src.stop(t + fade + 0.05);
    this.bed = null;
  }

  /** Plays a sound effect now or at an AudioContext time. */
  sfx(name: SfxName, when = 0, rate = 1, gain = 1) {
    const ctx = this.ctx;
    const buf = this.buffers.get(`sfx/${name}`);
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.sfxBus);
    src.start(Math.max(ctx.currentTime, when));
    this.track(src);
  }

  /** Plays a voice line, ducking the bed under it. */
  vo(name: VoName, greeting: Greeting, when = 0) {
    const ctx = this.ctx;
    const buf = this.buffers.get(`vo/${name === "welcome" ? `welcome-${greeting}` : name}`);
    if (!ctx || !buf) return;
    const at = Math.max(ctx.currentTime, when);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.voBus);
    src.start(at);
    this.track(src);
    const g = this.bgmBus.gain;
    g.setTargetAtTime(DUCK_GAIN, at - 0.05, 0.05); // ~150 ms down
    g.setTargetAtTime(BGM_GAIN, at + buf.duration, 0.13); // ~400 ms up
  }

  /** Schedules the timeline's cues that fall in the next 200 ms of loop time. */
  schedule(cues: Cue[], greeting: Greeting) {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    const now = this.loopPos();
    const until = now + LOOKAHEAD;
    if (this.scheduledUpTo < now - 1) this.scheduledUpTo = now; // after a pause: don't replay the past
    const from = this.scheduledUpTo;
    if (until <= from) return;
    const L = this.loopLength;
    // Walk the cues of every loop pass that overlaps (from, until].
    for (let pass = Math.floor(from / L); pass * L <= until; pass++) {
      for (const c of cues) {
        const abs = pass * L + c.at;
        if (abs <= from || abs > until) continue;
        const when = this.anchorCtx + (abs - this.anchorLoop);
        if (c.kind === "sfx") this.sfx(c.name, when, c.rate, c.gain);
        else this.vo(c.name, greeting, when);
      }
    }
    this.scheduledUpTo = until;
  }

  /** Fades everything out (to the player). */
  fadeOut(seconds = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + seconds);
  }

  suspend() {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  close() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.bed = null;
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();
    this.ctx = null;
    this.analyser = null;
    this.loading = null;
    this.buffers.clear();
  }

  private track(src: AudioScheduledSourceNode) {
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }
}
