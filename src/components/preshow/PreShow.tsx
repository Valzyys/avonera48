import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { AudioEngine } from "./audio/AudioEngine";
import { StageCanvas } from "./canvas/StageCanvas";
import type { PreShowData, StreamStatus } from "./data/types";
import { formatClock, formatDay } from "./format";
import { FinalCountdown } from "./modes/FinalCountdown";
import { Hold } from "./modes/Hold";
import { Outro } from "./modes/Outro";
import { Standby } from "./modes/Standby";
import { preshowConfig as config } from "./preshow.config";
import type { SceneProps } from "./scenes/common";
import { Connect } from "./scenes/Connect";
import { Etiquette } from "./scenes/Etiquette";
import { Info } from "./scenes/Info";
import { Interlude } from "./scenes/Interlude";
import { Lineup } from "./scenes/Lineup";
import { Opening } from "./scenes/Opening";
import { Partner } from "./scenes/Partner";
import { StayTuned } from "./scenes/StayTuned";
import { buildTimeline, sceneAt, type SceneId } from "./timeline";
import { CountdownChip } from "./ui/CountdownChip";
import { InfoStrip } from "./ui/InfoStrip";
import { LiveBadge } from "./ui/LiveBadge";
import { SoundToggle } from "./ui/SoundToggle";
import { Ticker } from "./ui/Ticker";
import { useCountdown } from "./useCountdown";
import { useGreeting } from "./useGreeting";
import { LoopClock, useLoopClock } from "./useLoopClock";
import { useServerTimeOffset } from "./useServerTimeOffset";
import "./preshow.css";

export type PreShowMode = "loop" | "final" | "hold" | "standby" | "outro";

export interface PreShowProps {
  /** The latest show data; changes land at the start of the next loop. */
  data: PreShowData;
  status: StreamStatus;
  /** The stream just went live: play the outro, then call onOutroDone. */
  outro?: boolean;
  onOutroDone?: () => void;
  /** Development / admin override of the mode. */
  force?: "standby" | "hold" | "outro" | null;
  /** Development: start the loop this many seconds in. */
  seek?: number | null;
}

const SCENES: Record<SceneId, (p: SceneProps) => ReactElement> = {
  opening: Opening,
  info: Info,
  lineup: Lineup,
  interlude: Interlude,
  etiquette: Etiquette,
  partner: Partner,
  connect: Connect,
  staytuned: StayTuned,
};

const PREF = "avn.preshow.sound";
const readPref = () => {
  try {
    return localStorage.getItem(PREF) === "on";
  } catch {
    return false;
  }
};
const writePref = (on: boolean) => {
  try {
    localStorage.setItem(PREF, on ? "on" : "off");
  } catch {
    /* storage blocked */
  }
};

const ANNOUNCE: Record<PreShowMode, string> = {
  loop: "Pra-show sedang berjalan. Show akan segera dimulai.",
  final: "Hitung mundur terakhir sebelum show dimulai.",
  hold: "Sebentar lagi siaran dimulai. Siaran akan tampil otomatis.",
  standby: "Mohon tunggu sebentar, tayangan sedang disiapkan.",
  outro: "Show dimulai.",
};

/**
 * The pre-show: a living stage that fills the player area until the show
 * goes live. One clock (audio when sound is on) drives the 150 s loop of
 * scenes, the canvas and the cues; the countdown runs on the server's clock.
 */
export default function PreShow({ data, status, outro, onOutroDone, force, seek }: PreShowProps) {
  const engine = useMemo(() => new AudioEngine(), []);
  const clock = useMemo(() => new LoopClock(engine, seek ?? 0), [engine, seek]);
  const root = useRef<HTMLDivElement>(null);
  const greeting = useGreeting();
  const offset = useServerTimeOffset();
  const { remaining, phase, seconds } = useCountdown(data.startAt, offset, config.finalCountdownSeconds);

  // Show data for the visuals changes only at a loop boundary.
  const [active, setActive] = useState<PreShowData>(data);
  const pending = useRef(data);
  useEffect(() => {
    pending.current = data;
  }, [data]);
  const timeline = useMemo(() => buildTimeline(active, { sponsors: config.sponsors.length, socials: config.socials.length, rules: config.rules.length }), [active]);

  const mode: PreShowMode =
    outro || force === "outro" ? "outro" : force === "standby" || status === "error" ? "standby" : force === "hold" ? "hold" : phase === "final" ? "final" : phase === "zero" ? "hold" : "loop";

  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Paused while the tab is hidden or the stage is scrolled out of view.
  const [hidden, setHidden] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const paused = hidden || offscreen;
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState !== "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.05 });
    if (root.current) io.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, []);

  // The scene on screen, remounted (resynced) after a pause or when sound takes over the clock.
  const [view, setView] = useState({ loop: -1, id: "opening" as SceneId, offset: 0, sync: 0 });
  const viewRef = useRef(view);
  const tlRef = useRef(timeline);
  useEffect(() => {
    tlRef.current = timeline;
  }, [timeline]);
  const resync = useCallback(() => setView((v) => ({ ...v, sync: v.sync + 1, offset: sceneAt(tlRef.current, clock.now()).local })), [clock]);

  useEffect(() => {
    if (paused) {
      clock.pause();
      engine.suspend();
    } else {
      clock.resume();
      engine.resume();
      resync();
    }
  }, [paused, clock, engine, resync]);

  const [soundOn, setSoundOn] = useState(false);
  const [loadingSound, setLoadingSound] = useState(false);
  const soundRef = useRef(false);
  const greetingRef = useRef(greeting);
  useEffect(() => {
    soundRef.current = soundOn;
    greetingRef.current = greeting;
  });

  useLoopClock(clock, mode === "loop" && !paused, (t) => {
    const loop = Math.floor(t / timeline.length);
    const tl = tlRef.current;
    if (loop !== viewRef.current.loop) {
      // New pass: take the latest data now (the timeline follows on the next frame).
      setActive(pending.current);
    }
    const { scene, local } = sceneAt(tl, t);
    const v = viewRef.current;
    if (v.loop !== loop || v.id !== scene.id) {
      const next = { loop, id: scene.id, offset: local, sync: v.sync };
      viewRef.current = next;
      setView(next);
    }
    if (soundRef.current) engine.schedule(tl.cues, greetingRef.current);
  });
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Sound: one tap enables it (autoplay rules); later taps mute and unmute.
  const enableSound = useCallback(async () => {
    setLoadingSound(true);
    try {
      await engine.enable();
      clock.handToAudio(timeline.length);
      engine.setMuted(false);
      setSoundOn(true);
      writePref(true);
      resync();
    } catch {
      setSoundOn(false);
    }
    setLoadingSound(false);
  }, [engine, clock, timeline.length, resync]);
  const toggleSound = useCallback(() => {
    if (!soundOn) {
      if (engine.ctx) {
        engine.setMuted(false);
        setSoundOn(true);
        writePref(true);
      } else void enableSound();
    } else {
      engine.setMuted(true);
      setSoundOn(false);
      writePref(false);
    }
  }, [soundOn, engine, enableSound]);

  // Someone who turned sound on before gets it back at their first touch on the page.
  useEffect(() => {
    if (!readPref()) return;
    const once = () => {
      if (!soundRef.current) void enableSound();
    };
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    return () => {
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
  }, [enableSound]);

  // The bed follows the mode.
  useEffect(() => {
    if (!soundOn) return;
    if (mode === "loop") engine.playBed("main");
    else if (mode === "final") engine.playBed("countdown", 2);
    else if (mode === "hold" || mode === "standby") engine.playBed("standby", 2);
    else if (mode === "outro") {
      engine.stopBed(0.4);
      engine.sfx("final-hit");
      engine.vo("outro", greeting);
      const t = window.setTimeout(() => engine.fadeOut(1.2), 1700);
      return () => window.clearTimeout(t);
    }
  }, [mode, soundOn, engine, greeting]);

  // Final countdown: beeps through the last ten seconds, a voice at fifteen.
  useEffect(() => {
    if (!soundOn || mode !== "final" || seconds == null) return;
    if (seconds === 15) engine.vo("countdown", greeting);
    if (seconds > 0 && seconds <= 10) engine.sfx(seconds <= 3 ? "beep-high" : "beep", 0, 1, 0.9);
  }, [seconds, mode, soundOn, engine, greeting]);

  // Photos load before the lineup comes up.
  useEffect(() => {
    for (const m of data.members) {
      if (!m.photoUrl) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = m.photoUrl;
    }
  }, [data.members]);

  useEffect(() => () => engine.close(), [engine]);

  const finishOutro = useCallback(() => {
    engine.close();
    clock.handBack();
    onOutroDone?.();
  }, [engine, clock, onOutroDone]);

  const scene = timeline.scenes.find((s) => s.id === view.id) ?? timeline.scenes[0];
  const Scene = SCENES[scene.id];
  const tickerItems = useMemo(() => {
    const live = [data.setlist, data.startAt && formatDay(data.startAt), data.startAt && formatClock(data.startAt)].filter(Boolean).join(" · ");
    return live ? [...config.ticker, live] : [...config.ticker];
  }, [data.setlist, data.startAt]);
  const intensity = mode === "outro" ? 1 : mode === "final" && remaining != null ? Math.max(0, Math.min(1, 1 - remaining / (config.finalCountdownSeconds * 1000))) : mode === "hold" ? 0.5 : 0;
  const c = config.colors;
  const style = { "--ps-bg": c.bg, "--ps-surface": c.surface, "--ps-primary": c.primary, "--ps-accent": c.accent, "--ps-text": c.text, "--ps-muted": c.muted } as CSSProperties;

  return (
    <div ref={root} className={`ps ps--${mode}${reduced ? " ps--reduced" : ""}${paused ? " ps--paused" : ""}`} style={style} role="region" aria-label="Pra-show">
      <StageCanvas clock={clock} intensity={intensity} reducedMotion={reduced} paused={paused} colors={c} />
      <div className="ps__overlay">
        <div key={mode} className="ps__mode">
          {mode === "loop" && (
            <div key={`${view.loop}-${view.id}-${view.sync}`} className="ps__scene" style={{ ["--o" as string]: `${-view.offset}s` } as CSSProperties}>
              <Scene dur={scene.dur} data={active} greeting={greeting} remaining={remaining} analyser={soundOn ? engine.analyser : null} reducedMotion={reduced} />
            </div>
          )}
          {mode === "final" && remaining != null && <FinalCountdown remaining={remaining} total={config.finalCountdownSeconds} setlist={data.setlist} />}
          {mode === "hold" && <Hold />}
          {mode === "standby" && <Standby />}
          {mode === "outro" && <Outro setlist={data.setlist} onDone={finishOutro} />}
        </div>

        {mode !== "outro" && (
          <>
            <InfoStrip setlist={data.setlist} startAt={data.startAt} />
            <div className="ps-top">
              <LiveBadge />
              {mode === "loop" && <CountdownChip remaining={remaining} />}
            </div>
            <Ticker items={tickerItems} />
            <SoundToggle on={soundOn} loading={loadingSound} onToggle={toggleSound} />
          </>
        )}
        <p className="ps-sr" role="status" aria-live="polite">
          {ANNOUNCE[mode]}
        </p>
      </div>
    </div>
  );
}
