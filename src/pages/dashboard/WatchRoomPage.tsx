import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { CheckoutDialog, type CheckoutItem } from "@/components/domain/CheckoutDialog";
import { exchangePlayback, resumePlayback, TheaterPlayer, type Playback } from "@/components/domain/TheaterPlayer";
import { MemberPhoto, oshi, ShowArt } from "@/components/media/Media";
import { Icon, Skeleton } from "@/components/ui";
import { accessOf, ApiError, chat, type ChatMessage } from "@/features/members/api";
import { formatCountdown, useClock } from "@/hooks/useClock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDash, UserAvatar } from "@/layouts/DashboardLayout";
import { cx, formatTime } from "@/utils/format";
import { teamLabel } from "@/utils/team";
import { isOnStage, ShowAction, showWhen } from "./parts";

type Mode = "proxy" | "direct";

interface SessionJson {
  playlist_url?: string;
  qualities?: { label: string; playlist_url: string }[];
  playback_url?: string;
  resume_url?: string | null;
  message?: string;
}

/** Opens a viewer session for a show in the given mode. */
async function openSession(show: string, mode: Mode): Promise<{ data: Playback; resume?: string }> {
  const res = await fetch("/api/room/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ show, proxy: mode === "proxy" }),
  });
  const j = (await res.json().catch(() => ({}))) as SessionJson;
  const fallback = "The room couldn’t open. Try again in a moment.";
  if (mode === "proxy") {
    if (!res.ok || !j.playlist_url) throw new ApiError(j.message ?? fallback, res.status);
    return { data: { playlistUrl: j.playlist_url, qualities: (j.qualities ?? []).map((q) => ({ label: q.label, url: q.playlist_url })) } };
  }
  if (!res.ok || !j.playback_url) throw new ApiError(j.message ?? fallback, res.status);
  const p = await exchangePlayback(j.playback_url);
  if (!p) throw new ApiError(fallback, 502);
  return { data: p, resume: j.resume_url ?? new URL("/api/partner/resume", j.playback_url).toString() };
}

const SEAT = "avn.room.seat2";
const seat = {
  get: (show: string): { mode: Mode; resume?: string } | null => {
    try {
      const v = JSON.parse(sessionStorage.getItem(SEAT) ?? "null") as { show: string; mode: Mode; resume?: string } | null;
      return v?.show === show ? v : null;
    } catch {
      return null;
    }
  },
  set: (v: { show: string; mode: Mode; resume?: string } | null) => {
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
          <Screen show={show.slug} title={show.title} live={live} startsAt={show.startsAt} now={now} />
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

function Screen({ show, title, live, startsAt, now }: { show: string; title: string; live: boolean; startsAt: string; now: number }) {
  const [playback, setPlayback] = useState<{ data: Playback; mode: Mode; resume?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const tried = useRef(false);

  const enterRoom = useCallback(
    async (mode: Mode = "proxy"): Promise<void> => {
      setBusy(true);
      setProblem(null);
      try {
        const p = await openSession(show, mode);
        seat.set({ show, mode, resume: p.resume });
        setPlayback({ ...p, mode });
      } catch (e) {
        if (mode === "proxy" && !(e instanceof ApiError && (e.status === 402 || e.status === 429))) return enterRoom("direct");
        setProblem(e instanceof Error ? e.message : String(e));
        setPlayback(null);
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  // Back after a reload: continue the same viewer session; or walk straight in once the show is on.
  useEffect(() => {
    if (tried.current) return;
    const was = seat.get(show);
    if (was?.mode === "direct" && was.resume) {
      tried.current = true;
      resumePlayback(was.resume).then((p) => (p ? setPlayback({ data: p, mode: "direct", resume: was.resume }) : enterRoom()));
    } else if (was || live) {
      tried.current = true;
      void enterRoom(was?.mode ?? "proxy");
    }
  }, [show, live, enterRoom]);

  const latest = useRef(playback);
  latest.current = playback;
  const fatal = useCallback(() => {
    const p = latest.current;
    setPlayback(null);
    if (p?.mode === "proxy") void enterRoom("direct");
    else {
      seat.set(null);
      setProblem("The show isn’t coming through right now. Try entering again in a moment.");
    }
  }, [enterRoom]);
  const ended = useCallback(() => {
    seat.set(null);
    setPlayback(null);
  }, []);

  if (playback) return <TheaterPlayer key={playback.mode} playback={playback.data} resumeUrl={playback.resume} title={title} onEnded={ended} onFatal={fatal} />;

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
                <b>{m.name}</b>
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
