import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type Hls from "hls.js";
import { Icon } from "@/components/ui";
import { cx } from "@/utils/format";

/**
 * What the player plays: a playlist, optional fixed-quality alternatives, and
 * (for the partner's theater sessions) a header every media request must carry.
 */
export interface Playback {
  playlistUrl: string;
  headerName?: string;
  headerValue?: string;
  qualities: { label: string; url: string }[];
}

interface PlaybackJson {
  ok?: boolean;
  playlist_url?: string;
  auto_playlist_url?: string;
  play_header_name?: string;
  play_header_value?: string;
  qualities?: { label: string; playlist_url: string }[];
}

function toPlayback(j: PlaybackJson): Playback | null {
  const url = j.auto_playlist_url ?? j.playlist_url;
  if (!j.ok || !url || !j.play_header_name || !j.play_header_value) return null;
  return { playlistUrl: url, headerName: j.play_header_name, headerValue: j.play_header_value, qualities: (j.qualities ?? []).map((q) => ({ label: q.label, url: q.playlist_url })) };
}

/** Opens a one-time playback URL from the browser (it is bound to this viewer's device and network). */
export async function exchangePlayback(playbackUrl: string): Promise<Playback | null> {
  try {
    const res = await fetch(playbackUrl, { credentials: "include" });
    return toPlayback((await res.json()) as PlaybackJson);
  } catch {
    return null;
  }
}

/** Continues this viewer's session after a reload; null when there is none. */
export async function resumePlayback(resumeUrl: string): Promise<Playback | null> {
  try {
    const res = await fetch(resumeUrl, { credentials: "include" });
    return toPlayback((await res.json()) as PlaybackJson);
  } catch {
    return null;
  }
}

/**
 * HLS player for the theater room and SHOWROOM lives. When a play header is
 * required, every playlist, key and segment request carries it, so playback
 * goes through hls.js (native HLS can't add headers); a refused session
 * (401/403) is resumed — at most three times, at least 5 s apart. Without a
 * header, browsers with native HLS but no MSE (older iOS) play it directly.
 */
export function TheaterPlayer({
  playback,
  resumeUrl,
  title,
  onEnded,
  onFatal,
}: {
  playback: Playback;
  resumeUrl?: string;
  title: string;
  onEnded?: () => void;
  /** The stream can't be loaded at all (e.g. the playlist is refused); the owner may try another route. */
  onFatal?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const key = useRef(playback.headerValue);
  const header = playback.headerName;
  const [source, setSource] = useState(playback.playlistUrl);
  const [quality, setQuality] = useState("Auto");
  const [menu, setMenu] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [generation, setGeneration] = useState(0);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    key.current = playback.headerValue;
    setSource(playback.playlistUrl);
    setQuality("Auto");
  }, [playback]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let hls: Hls | undefined;
    let cancelled = false;
    let tries = 0;
    let lastRenew = 0;
    let netFails = 0;
    const giveUp = () => {
      hls?.destroy();
      if (onFatal) onFatal();
      else setState("error");
    };
    setState("loading");

    const start = async (url: string) => {
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled) return;
      if (!HlsCtor.isSupported()) {
        if (!header && el.canPlayType("application/vnd.apple.mpegurl")) {
          el.src = url;
          el.addEventListener("loadedmetadata", () => setState("ready"), { once: true });
          el.play().catch(() => undefined);
          return;
        }
        return setState("error");
      }
      hls?.destroy();
      const h = new HlsCtor({
        lowLatencyMode: true,
        backBufferLength: 30,
        xhrSetup: header
          ? (xhr) => {
              xhr.withCredentials = true;
              xhr.setRequestHeader(header, key.current!); // always the latest header
            }
          : undefined,
      });
      hls = h;
      hlsRef.current = h;
      h.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        setState("ready");
        el.play().catch(() => undefined);
      });
      h.on(HlsCtor.Events.FRAG_LOADED, () => {
        netFails = 0;
      });
      h.on(HlsCtor.Events.ERROR, (_e, d) => {
        const status = (d.response as { code?: number } | undefined)?.code;
        // Only a refused session needs a resume; other errors are the player's to retry.
        if (resumeUrl && (status === 401 || status === 403)) return void renew();
        if (!d.fatal) return;
        console.warn("[player]", d.type, d.details, status ?? "");
        if (d.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
          // A playlist that can't be fetched at all won't come back by retrying.
          const manifest = /^manifest/.test(d.details);
          if (manifest || ++netFails > 3) return giveUp();
          setTimeout(() => !cancelled && h.startLoad(), 1500);
        } else if (d.type === HlsCtor.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
        else giveUp();
      });
      h.loadSource(url);
      h.attachMedia(el);
    };

    const renew = async () => {
      if (tries >= 3) {
        setState("error");
        onEnded?.();
        return;
      }
      const wait = Math.max(0, lastRenew + 5000 - Date.now());
      tries++;
      await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;
      lastRenew = Date.now();
      const next = await resumePlayback(resumeUrl!);
      if (cancelled) return;
      if (!next) {
        setState("error");
        onEnded?.();
        return;
      }
      tries = 0;
      key.current = next.headerValue;
      start(next.playlistUrl);
    };

    start(source);
    return () => {
      cancelled = true;
      hls?.destroy();
      hlsRef.current = null;
      if (!hls) {
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [source, generation, header, resumeUrl, onEnded, onFatal]);

  useEffect(() => {
    if (video.current) {
      video.current.muted = muted;
      video.current.volume = volume;
    }
  }, [muted, volume]);

  // Controls fade out after a few still seconds while playing; any movement,
  // tap or key brings them back.
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef(0);
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2600);
  }, []);
  useEffect(() => {
    wake();
    return () => window.clearTimeout(idleTimer.current);
  }, [wake]);

  // Where the picture is within the live window (what can be rewound), and
  // how far it has fallen behind where a live viewer normally sits.
  const [win, setWin] = useState({ start: 0, end: 0, at: 0, edge: 0 });
  const [buffering, setBuffering] = useState(false);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const read = () => {
      const r = el.seekable;
      if (!r.length) return;
      const end = r.end(r.length - 1);
      // hls.js holds a few segments back from the newest one on purpose; that
      // point, not the end of the window, is "live". Natively, allow 30 s.
      const h = hlsRef.current;
      const edge = h ? (h.liveSyncPosition ?? el.currentTime) : end - 30;
      setWin({ start: r.start(0), end, at: el.currentTime, edge });
    };
    const wait = () => setBuffering(true);
    const go = () => setBuffering(false);
    el.addEventListener("timeupdate", read);
    el.addEventListener("progress", read);
    el.addEventListener("waiting", wait);
    el.addEventListener("playing", go);
    el.addEventListener("canplay", go);
    return () => {
      el.removeEventListener("timeupdate", read);
      el.removeEventListener("progress", read);
      el.removeEventListener("waiting", wait);
      el.removeEventListener("playing", go);
      el.removeEventListener("canplay", go);
    };
  }, []);
  // The timeline runs from the oldest moment still available to the live point.
  const span = Math.max(win.edge, win.at) - win.start;
  const rewindable = span > 10;
  const progress = span > 0 ? Math.min(1, Math.max(0, (win.at - win.start) / span)) : 1;
  const behind = Math.max(0, win.edge - win.at);
  const atEdge = behind < 6;

  const goLive = () => {
    const el = video.current;
    if (!el || !el.seekable.length) return;
    const end = el.seekable.end(el.seekable.length - 1);
    el.currentTime = hlsRef.current?.liveSyncPosition ?? Math.max(0, end - 10);
    el.play().catch(() => undefined);
  };
  const seek = (t: number) => {
    const el = video.current;
    if (el) el.currentTime = t;
    setWin((w) => ({ ...w, at: t }));
  };

  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // A short play/pause mark in the middle confirms a tap or key press.
  const [flash, setFlash] = useState<{ kind: "play" | "pause"; n: number } | null>(null);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => undefined);
    else el.pause();
    setFlash((f) => ({ kind: el.paused ? "pause" : "play", n: (f?.n ?? 0) + 1 }));
  };

  // On touch screens a tap while the controls are hidden only brings them back.
  const lastPointer = useRef("mouse");
  const tapVideo = () => {
    if (lastPointer.current !== "mouse" && playing && idle) return wake();
    toggle();
  };

  const pip = async () => {
    const el = video.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      /* not available */
    }
  };

  const onKey = (e: KeyboardEvent) => {
    wake();
    if ((e.target as HTMLElement).closest("input, button[role='menuitemradio']")) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") {
      e.preventDefault();
      toggle();
    } else if (k === "m") setMuted((m) => !m);
    else if (k === "f") fullscreen();
    else if (k === "escape") setMenu(false);
  };

  const fullscreen = () => {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => undefined);
    // iPhone Safari only puts the video element itself full screen.
    else (video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.();
  };

  const pick = (label: string, url: string) => {
    setQuality(label);
    setMenu(false);
    if (url === source) setGeneration((g) => g + 1);
    else setSource(url);
  };

  const level = muted ? 0 : volume;

  return (
    <div
      className={cx("player", playing && "is-playing", `is-${state}`, playing && idle && !menu && "is-idle", full && "is-full")}
      ref={wrap}
      tabIndex={0}
      onPointerMove={(e) => e.pointerType === "mouse" && wake()}
      onPointerDown={(e) => {
        lastPointer.current = e.pointerType;
        if (e.pointerType === "mouse" || !(e.target as HTMLElement).closest(".player__video")) wake();
      }}
      onKeyDown={onKey}
      onDoubleClick={(e) => (e.target as HTMLElement).closest(".player__video") && fullscreen()}
    >
      <video
        ref={video}
        className="player__video"
        playsInline
        autoPlay
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={tapVideo}
        aria-label={title}
      />
      <div className="player__shade" aria-hidden />

      <div className="player__top">
        <span className={cx("player__live", !atEdge && "is-behind")}>
          <i aria-hidden /> Live
        </span>
        <span className="player__name">{title}</span>
      </div>

      {(state === "loading" || (buffering && playing)) && <span className="player__spinner" aria-label="Loading" />}
      {state === "ready" && !playing && (
        <button type="button" className="player__big" onClick={toggle} aria-label="Play">
          <Glyph kind="play" size={30} />
        </button>
      )}
      {flash && playing && (
        <span key={flash.n} className="player__flash" aria-hidden>
          <Glyph kind={flash.kind} size={26} />
        </span>
      )}
      {state === "error" && (
        <p className="player__message" role="alert">
          {resumeUrl ? "The picture isn’t coming through. Reload the page to enter the room again." : "The picture isn’t coming through. The live may have just ended."}
        </p>
      )}

      <div className="player__bar">
        <div className={cx("player__rail", !rewindable && "is-fixed")}>
          <span className="player__rail-fill" style={{ width: `${(atEdge ? 1 : progress) * 100}%` }} />
          {rewindable && (
            <input
              type="range"
              min={win.start}
              max={win.start + span}
              step={0.5}
              value={Math.min(win.at, win.start + span)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Position in the live window"
              aria-valuetext={atEdge ? "Live" : `${Math.round(behind)} seconds behind live`}
            />
          )}
        </div>
        <div className="player__row">
          <div className="player__group">
            <button type="button" className="player__btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"} data-tip={playing ? "Pause (K)" : "Play (K)"}>
              <Glyph kind={playing ? "pause" : "play"} size={20} />
            </button>
            <div className="player__vol">
              <button type="button" className="player__btn" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} data-tip={muted ? "Unmute (M)" : "Mute (M)"}>
                <Icon name={level === 0 ? "mute" : "volume"} size={20} strokeWidth={1.9} />
              </button>
              <input
                className="player__volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={level}
                style={{ "--level": `${level * 100}%` } as CSSProperties}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setMuted(Number(e.target.value) === 0);
                }}
                aria-label="Volume"
              />
            </div>
            <button type="button" className={cx("player__edge", atEdge && "is-live")} onClick={goLive} disabled={atEdge} aria-label={atEdge ? "At the live edge" : "Jump to live"}>
              <i aria-hidden />
              {atEdge ? "Live" : `−${formatBehind(behind)} · Go live`}
            </button>
          </div>
          <div className="player__group">
            {playback.qualities.length > 0 && (
              <span className="player__quality">
                <button type="button" className="player__btn player__btn--wide" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label={`Quality: ${quality}`} data-tip={menu ? undefined : "Quality"}>
                  <Icon name="settings" size={19} strokeWidth={1.8} className={cx("player__gear", menu && "is-open")} />
                  <span className="player__badge">{quality === "Auto" ? "Auto" : quality}</span>
                </button>
                {menu && (
                  <span className="player__menu" role="menu">
                    <span className="player__menu-head">Quality</span>
                    {[{ label: "Auto", url: playback.playlistUrl }, ...playback.qualities].map((q) => (
                      <button key={q.label} type="button" role="menuitemradio" aria-checked={quality === q.label} onClick={() => pick(q.label, q.url)}>
                        {q.label}
                        {quality === q.label && <Icon name="check" size={16} strokeWidth={2.2} />}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            )}
            {"pictureInPictureEnabled" in document && (
              <button type="button" className="player__btn player__btn--pip" onClick={pip} aria-label="Picture in picture" data-tip="Mini player">
                <Icon name="pip" size={20} strokeWidth={1.8} />
              </button>
            )}
            <button type="button" className="player__btn" onClick={fullscreen} aria-label={full ? "Exit full screen" : "Full screen"} data-tip={full ? "Exit full screen (F)" : "Full screen (F)"}>
              <Icon name={full ? "shrink" : "expand"} size={20} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBehind(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

/** Solid play / pause marks — the line icons read too thin over video. */
function Glyph({ kind, size }: { kind: "play" | "pause"; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      {kind === "play" ? <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2Z" /> : <path d="M6.5 5h3.5v14H6.5zM14 5h3.5v14H14z" />}
    </svg>
  );
}
