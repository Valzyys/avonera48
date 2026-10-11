import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { Icon } from "@/components/ui";
import { cx } from "@/utils/format";

/** What the viewer's browser gets after exchanging a one-time playback URL (or resuming). */
export interface Playback {
  playlistUrl: string;
  headerName: string;
  headerValue: string;
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
 * The theater room's player. Every playlist, key and segment request must
 * carry the session's play header, so playback always goes through hls.js
 * (native HLS can't add headers). When the session is refused (401/403) it
 * resumes — at most three times, at least 5 s apart — and gets a new header.
 */
export function TheaterPlayer({ playback, resumeUrl, title, onEnded }: { playback: Playback; resumeUrl: string; title: string; onEnded?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const key = useRef(playback.headerValue);
  const [source, setSource] = useState(playback.playlistUrl);
  const [quality, setQuality] = useState("Auto");
  const [menu, setMenu] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [generation, setGeneration] = useState(0);

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
    setState("loading");

    const start = async (url: string) => {
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled) return;
      if (!HlsCtor.isSupported()) return setState("error");
      hls?.destroy();
      const h = new HlsCtor({
        lowLatencyMode: true,
        backBufferLength: 30,
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
          xhr.setRequestHeader(playback.headerName, key.current); // always the latest header
        },
      });
      hls = h;
      h.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        setState("ready");
        el.play().catch(() => undefined);
      });
      h.on(HlsCtor.Events.ERROR, (_e, d) => {
        const status = (d.response as { code?: number } | undefined)?.code;
        // Only a refused session needs a resume; other errors are the player's to retry.
        if (status === 401 || status === 403) return void renew();
        if (!d.fatal) return;
        if (d.type === HlsCtor.ErrorTypes.NETWORK_ERROR) h.startLoad();
        else if (d.type === HlsCtor.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
        else setState("error");
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
      const next = await resumePlayback(resumeUrl);
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
    };
  }, [source, generation, playback.headerName, resumeUrl, onEnded]);

  useEffect(() => {
    if (video.current) {
      video.current.muted = muted;
      video.current.volume = volume;
    }
  }, [muted, volume]);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => undefined);
    else el.pause();
  };

  const fullscreen = () => {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const pick = (label: string, url: string) => {
    setQuality(label);
    setMenu(false);
    if (url === source) setGeneration((g) => g + 1);
    else setSource(url);
  };

  return (
    <div className={cx("player", playing && "is-playing", `is-${state}`)} ref={wrap}>
      <video
        ref={video}
        className="player__video"
        playsInline
        autoPlay
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={toggle}
        aria-label={title}
      />
      {state === "loading" && <span className="player__spinner" aria-label="Loading" />}
      {state === "error" && (
        <p className="player__message" role="alert">
          The picture isn’t coming through. Reload the page to enter the room again.
        </p>
      )}
      <div className="player__bar">
        <button type="button" className="player__btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
            </svg>
          ) : (
            <Icon name="play" size={18} />
          )}
        </button>
        <button type="button" className="player__btn" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
          <Icon name={muted ? "mute" : "volume"} size={18} />
        </button>
        <input
          className="player__volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            setMuted(Number(e.target.value) === 0);
          }}
          aria-label="Volume"
        />
        <span className="player__title">{title}</span>
        {playback.qualities.length > 0 && (
          <span className="player__quality">
            <button type="button" className="player__chip" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
              {quality}
            </button>
            {menu && (
              <span className="player__menu" role="menu">
                {[{ label: "Auto", url: playback.playlistUrl }, ...playback.qualities].map((q) => (
                  <button key={q.label} type="button" role="menuitemradio" aria-checked={quality === q.label} onClick={() => pick(q.label, q.url)}>
                    {q.label}
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
        <button type="button" className="player__btn" onClick={fullscreen} aria-label="Full screen">
          <Icon name="expand" size={18} />
        </button>
      </div>
    </div>
  );
}
