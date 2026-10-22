import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { CheckoutDialog, type CheckoutItem } from "@/components/domain/CheckoutDialog";
import { TheaterPlayer, type Playback } from "@/components/domain/TheaterPlayer";
import { readOverride, usePreShowData } from "@/components/preshow/data/usePreShowData";
import type { DashShow } from "@/features/members/stage";
import { MemberPhoto, oshi, ShowArt } from "@/components/media/Media";
import { Icon, Skeleton, Verified } from "@/components/ui";
import { accessOf, ApiError, chat, type ChatMessage } from "@/features/members/api";
import { formatCountdown, useClock } from "@/hooks/useClock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDash, UserAvatar } from "@/layouts/DashboardLayout";
import { cx, formatTime } from "@/utils/format";
import { teamLabel } from "@/utils/team";
import { isOnStage, ShowAction, showWhen } from "./parts";

interface SessionJson {
  playlist_url?: string;
  qualities?: { label: string; playlist_url: string }[];
  message?: string;
}

/**
 * Opens a viewer session for a show. The server opens the partner playback
 * itself and returns same-origin URLs (/api/room/media), so the browser
 * never talks to the partner.
 */
async function openSession(show: string): Promise<Playback> {
  // Never wait on a spinner forever: the server gives up on the partner after
  // about 12 s per call, so 30 s means something between us is stuck.
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch("/api/room/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ show }),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(ctrl.signal.aborted ? "Opening the room is taking too long. Try again in a moment." : "Can’t reach the server. Check your connection and try again.", 0, "network");
  } finally {
    window.clearTimeout(timer);
  }
  const j = (await res.json().catch(() => ({}))) as SessionJson;
  if (!res.ok || !j.playlist_url) throw new ApiError(j.message ?? "The room couldn’t open. Try again in a moment.", res.status);
  return { playlistUrl: j.playlist_url, qualities: (j.qualities ?? []).map((q) => ({ label: q.label, url: q.playlist_url })) };
}

/** Statuses where opening again right away won't help (no access, rate limited, room full). */
const FINAL_STATUS = new Set([401, 402, 403, 429]);

const SEAT = "avn.room.seat3";
const seat = {
  get: (show: string): { show: string } | null => {
    try {
      const v = JSON.parse(sessionStorage.getItem(SEAT) ?? "null") as { show: string } | null;
      return v?.show === show ? v : null;
    } catch {
      return null;
    }
  },
  set: (v: { show: string } | null) => {
    try {
      if (v) sessionStorage.setItem(SEAT, JSON.stringify(v));
      else sessionStorage.removeItem(SEAT);
    } catch {
      /* storage blocked */
    }
  },
};

export default function WatchRoomPage() {
  const { slug = "" } = useParams();
  const { user, catalog, reloadCatalog, shows, showsError } = useDash();
  const now = useClock();
  const show = shows?.find((s) => s.slug === slug) ?? null;
  useDocumentTitle(show ? `${show.title} · Watch` : "Watch");
  const [buy, setBuy] = useState<CheckoutItem | null>(null);
  // Phones show one panel under the player at a time.
  const [panel, setPanel] = useState<"chat" | "lineup">("chat");

  const access = user.isAdmin ? "admin" : accessOf(catalog, slug);
  const live = show ? isOnStage(show, now) : false;

  if (showsError && !show) {
    return (
      <div className="dash-page">
        <p className="dash-empty">The show list couldn’t be loaded. Reload the page in a moment.</p>
      </div>
    );
  }

  if (!catalog || !shows) {
    return (
      <div className="dash-page watch">
        <Skeleton height={460} />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="dash-page">
        <p className="dash-empty">
          That show isn’t on the schedule. <Link to="/dashboard/schedule">See all shows</Link>
        </p>
      </div>
    );
  }

  if (!access) {
    return (
      <div className="dash-page">
        <section className="paywall">
          <span className="paywall__art">
            <ShowArt show={show} use="banner" />
          </span>
          <div className="paywall__body">
            <span className="paywall__lock">
              <Icon name="lock" size={16} /> Ticket needed
            </span>
            <h1 className="paywall__title">{show.title}</h1>
            <p className="meta">{showWhen(show)}</p>
            <p>Get a ticket for this show, or a membership that covers every show, to enter the room.</p>
            <div className="paywall__cta">
              <ShowAction show={show} catalog={catalog} now={now} onBuy={setBuy} size="lg" />
              <Link to="/dashboard/membership" className="dash-btn dash-btn--outline dash-btn--lg">
                See memberships
              </Link>
            </div>
          </div>
        </section>
        <CheckoutDialog item={buy} onClose={() => (setBuy(null), reloadCatalog())} paymentsReady={!!catalog.payments} />
      </div>
    );
  }

  return (
    <div className="dash-page watch">
      <div className="watch-layout" data-panel={panel}>
        <div className="watch-stage">
          <Screen show={show.slug} title={show.title} live={live} startsAt={show.startsAt} now={now} dash={show} />
          <div className="watch-info">
            <div className="watch-info__row">
              <span className={cx("watch-pill", live && "is-live")}>
                <i aria-hidden />
                {live ? "On stage" : `Starts ${formatTime(show.startsAt)} WIB`}
              </span>
              {live && show.viewers > 0 && (
                <span className="chip chip--mute">
                  <Icon name="eye" size={13} /> {show.viewers.toLocaleString("id-ID")}
                </span>
              )}
              <span className="chip chip--mute">{teamLabel(show.team)}</span>
              {show.birthday && <span className="chip chip--mute">Birthday · {show.birthday}</span>}
              <span className="chip chip--ok">{access === "membership" ? "Membership" : access === "admin" ? "Admin" : "Ticket"}</span>
            </div>
            <h1 className="watch-info__title">{show.title}</h1>
            <p className="meta">{showWhen(show)}</p>
          </div>

        </div>

        <div className="watch-tabs" role="tablist" aria-label="Room panels">
          <button type="button" role="tab" aria-selected={panel === "chat"} className={cx(panel === "chat" && "is-active")} onClick={() => setPanel("chat")}>
            <Icon name="news" size={16} /> Chat
          </button>
          <button type="button" role="tab" aria-selected={panel === "lineup"} className={cx(panel === "lineup" && "is-active")} onClick={() => setPanel("lineup")}>
            <Icon name="users" size={16} /> Lineup <span className="watch-tabs__count">{show.lineupMembers.length}</span>
          </button>
        </div>

        <Chat show={show.slug} canModerate={user.isAdmin} me={user} />

        <section className="lineup-block" aria-label="Lineup">
            <h2 className="dash-sub">Lineup</h2>
            {show.lineupMembers.length ? (
              <ul className="lineup-grid">
                {show.lineupMembers.map((m) => (
                  <li key={m.slug}>
                    <Link to={`/members/${m.slug}`} className="lineup-card" style={oshi(m)}>
                      <MemberPhoto member={m} className="lineup-card__photo" />
                      <span className="lineup-card__name">{m.nickname}</span>
                      <span className="lineup-card__team">{teamLabel(m.team)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">The lineup hasn’t been announced yet.</p>
            )}
          </section>
      </div>
    </div>
  );
}

/* ---------- the screen ---------- */

// The pre-show only loads on the watch page, and only while it's needed.
const PreShow = lazy(() => import("@/components/preshow/PreShow"));

function Screen({ show, title, live, startsAt, now, dash }: { show: string; title: string; live: boolean; startsAt: string; now: number; dash: DashShow }) {
  const { user, reloadShows } = useDash();
  const [params] = useSearchParams();
  const ov = readOverride(params, import.meta.env.DEV || user.isAdmin);
  const preData = usePreShowData(dash, ov);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const tried = useRef(false);
  // The pre-show was on screen; when the show goes live, it plays its outro first.
  const [sawPreShow, setSawPreShow] = useState(!live);
  const [outro, setOutro] = useState<"idle" | "playing" | "done">("idle");
  const [replay, setReplay] = useState(0);

  const enterRoom = useCallback(async (): Promise<void> => {
    setBusy(true);
    setProblem(null);
    // One quiet retry for a hiccup (timeout, 5xx) before showing a problem.
    for (let attempt = 0; ; attempt++) {
      try {
        const p = await openSession(show);
        seat.set({ show });
        setPlayback(p);
        break;
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (attempt < 1 && !FINAL_STATUS.has(status)) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        setProblem(e instanceof Error ? e.message : String(e));
        setPlayback(null);
        break;
      }
    }
    setBusy(false);
  }, [show]);

  // The show is on: walk straight in (a returning viewer isn't counted twice).
  // The player loads behind the outro, so the switch is quick.
  useEffect(() => {
    if (tried.current || ov || !live) return;
    tried.current = true;
    void enterRoom();
  }, [live, ov, enterRoom]);

  useEffect(() => {
    if (!live) setSawPreShow(true);
    else if (sawPreShow && outro === "idle" && !ov) setOutro("playing");
  }, [live, sawPreShow, outro, ov]);

  // While waiting, ask the listing more often so the outro starts within seconds of going live.
  const waiting = !live || !!ov;
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && reloadShows(), 15_000);
    return () => window.clearInterval(t);
  }, [waiting, reloadShows]);

  // The stream dropped (session refused, network gone, picture stuck): open
  // a fresh session behind the player instead of sending the viewer back to
  // the curtain. A few times in a row at most, so a real outage still shows.
  const reconnects = useRef<number[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const fatal = useCallback(() => {
    const now = Date.now();
    reconnects.current = reconnects.current.filter((t) => now - t < 5 * 60_000);
    if (reconnects.current.length >= 4) {
      seat.set(null);
      setPlayback(null);
      setProblem("The show isn’t coming through right now. Try entering again in a moment.");
      return;
    }
    reconnects.current.push(now);
    setReconnecting(true);
    window.setTimeout(
      () =>
        void openSession(show)
          .then((p) => setPlayback(p))
          .catch((e: unknown) => {
            seat.set(null);
            setPlayback(null);
            setProblem(e instanceof Error ? e.message : "The show isn’t coming through right now. Try entering again in a moment.");
          })
          .finally(() => setReconnecting(false)),
      reconnects.current.length === 1 ? 0 : 2000,
    );
  }, [show]);
  const ended = useCallback(() => {
    seat.set(null);
    setPlayback(null);
  }, []);
  const outroDone = useCallback(() => setOutro("done"), []);
  const replayOutro = useCallback(() => setReplay((n) => n + 1), []);

  const stage = (node: ReactNode) => <Suspense fallback={<div className="curtain-screen" aria-busy="true" />}>{node}</Suspense>;
  if (ov) return stage(<PreShow key={`${ov.force}-${replay}`} data={preData} status="upcoming" force={ov.force} seek={ov.seek} outro={false} onOutroDone={ov.force === "outro" ? replayOutro : undefined} />);
  if (outro === "playing") return stage(<PreShow data={preData} status="live" outro onOutroDone={outroDone} />);
  if (!live) return stage(<PreShow data={preData} status="upcoming" />);

  if (playback)
    return (
      <div className="screen-wrap">
        <TheaterPlayer playback={playback} title={title} onEnded={ended} onFatal={fatal} />
        {reconnecting && (
          <span className="screen-wrap__note" role="status">
            <span className="player__spinner" aria-hidden /> Reconnecting…
          </span>
        )}
      </div>
    );

  const c = formatCountdown(Date.parse(startsAt) - now);
  return (
    <div className="curtain-screen">
      <span className="curtain-screen__folds" aria-hidden />
      <span className="curtain-screen__spot" aria-hidden />
      <div className="curtain-screen__body">
        {busy ? (
          <span className="player__spinner" aria-label="Opening the room" />
        ) : (
          <>
            <span className="curtain-screen__kicker">{live ? "The doors are open" : "Doors open in"}</span>
            {live ? (
              <span className="curtain-screen__show">{title}</span>
            ) : (
              <span className="curtain-screen__count mono" role="timer">
                {c.d > 0 && <span>{c.d}d </span>}
                {c.h}:{c.m}:{c.s}
              </span>
            )}
            <button type="button" className="curtain-screen__enter" onClick={() => enterRoom()}>
              <Icon name="play" size={18} />
              Enter the room
            </button>
            {problem ? (
              <span className="curtain-screen__problem" role="alert">
                {problem}
              </span>
            ) : (
              <span className="curtain-screen__note">{live ? "Sound starts muted. Tap the speaker to turn it on." : "You can enter early; the picture starts when the show does."}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- live chat ---------- */

function Chat({ show, canModerate, me }: { show: string; canModerate: boolean; me: { name: string; avatar: string | null } }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);

  const add = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      if (!atBottom.current) setUnseen((n) => n + fresh.length);
      return [...prev, ...fresh].slice(-300);
    });
  }, []);

  // Server-Sent Events: the server pushes new comments; the browser reconnects on its own.
  useEffect(() => {
    const es = new EventSource(`/api/room/${show}/comments/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        add([JSON.parse(e.data) as ChatMessage]);
      } catch {
        /* ignore a malformed event */
      }
    };
    return () => es.close();
  }, [show, add]);

  useEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const c = await chat.post(show, body);
      atBottom.current = true;
      add([c]);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t send.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await chat.remove(show, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      /* already gone */
    }
  };

  return (
    <aside className="chat" aria-label="Live chat">
      <header className="chat__head">
        <h2>Live chat</h2>
        <span className={cx("chat__status", connected && "is-on")}>
          <i aria-hidden />
          {connected ? "Live" : "Connecting…"}
        </span>
      </header>
      <ol
        className="chat__list"
        ref={list}
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          if (atBottom.current) setUnseen(0);
        }}
      >
        {messages.length === 0 && <li className="chat__empty">Say hi to everyone in the room.</li>}
        {messages.map((m) => (
          <li key={m.id} className={cx("chat__msg", m.mine && "is-mine")}>
            <UserAvatar user={{ name: m.name, avatar: m.avatar }} size={30} />
            <div className="chat__bubble">
              <span className="chat__meta">
                <b>
                  {m.name}
                  {m.verified && <Verified size={13} />}
                </b>
                <time dateTime={new Date(m.at).toISOString()}>{new Date(m.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</time>
              </span>
              <p>{m.body}</p>
            </div>
            {(m.mine || canModerate) && (
              <button type="button" className="chat__del" onClick={() => remove(m.id)} aria-label="Delete message">
                <Icon name="trash" size={14} />
              </button>
            )}
          </li>
        ))}
      </ol>
      {unseen > 0 && (
        <button
          type="button"
          className="chat__unseen"
          onClick={() => {
            atBottom.current = true;
            setUnseen(0);
            list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
          }}
        >
          {unseen} new message{unseen === 1 ? "" : "s"} ↓
        </button>
      )}
      <form className="chat__form" onSubmit={send}>
        <UserAvatar user={me} size={32} />
        <input className="chat__input" value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Write a message…" aria-label="Message" />
        <button type="submit" className="chat__send" disabled={sending || !text.trim()} aria-label="Send">
          <Icon name="arrowRight" size={18} />
        </button>
      </form>
      {error && <p className="chat__error">{error}</p>}
    </aside>
  );
}
