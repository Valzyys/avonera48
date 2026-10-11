import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { LineupAvatars } from "@/components/domain/Cards";
import { exchangePlayback, resumePlayback, TheaterPlayer, type Playback } from "@/components/domain/TheaterPlayer";
import { ShowArt } from "@/components/media/Media";
import { Icon, Skeleton } from "@/components/ui";
import { useAuth, type Account } from "@/features/auth/AuthContext";
import { formatCountdown, useClock } from "@/hooks/useClock";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useResource } from "@/hooks/useResource";
import { enter, useGSAP } from "@/motion/gsap";
import { api } from "@/services";
import type { ShowSummary } from "@/services/types";
import { formatDate, formatTime, formatWeekday } from "@/utils/format";
import { teamLabel } from "@/utils/team";

interface RoomShow {
  slug: string;
  title: string;
  open: boolean;
}

interface RoomInfo {
  configured: boolean;
  available?: boolean;
  shows: RoomShow[];
}

/** The viewer session kept for this tab, so a reload resumes instead of starting over. */
interface Seat {
  slug: string;
  title: string;
  /** "proxy": media through this site; "direct": the browser talks to the partner. */
  mode: Mode;
  resume?: string;
}

type Mode = "proxy" | "direct";

interface SessionJson {
  ok?: boolean;
  proxied?: boolean;
  playlist_url?: string;
  qualities?: { label: string; playlist_url: string }[];
  playback_url?: string;
  resume_url?: string | null;
  message?: string;
}

/** Opens a viewer session in the given mode and returns what the player needs. */
async function openSession(slug: string, mode: Mode): Promise<{ data: Playback; resume?: string }> {
  const res = await fetch("/api/room/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ show_slug: slug, proxy: mode === "proxy" }),
  });
  const j = (await res.json().catch(() => ({}))) as SessionJson;
  const fallback = "The room couldn’t open. Try again in a moment.";
  if (mode === "proxy") {
    if (!res.ok || !j.playlist_url) throw new Error(j.message ?? fallback);
    return { data: { playlistUrl: j.playlist_url, qualities: (j.qualities ?? []).map((q) => ({ label: q.label, url: q.playlist_url })) } };
  }
  if (!res.ok || !j.playback_url) throw new Error(j.message ?? fallback);
  const p = await exchangePlayback(j.playback_url);
  if (!p) throw new Error(fallback);
  return { data: p, resume: j.resume_url ?? new URL("/api/partner/resume", j.playback_url).toString() };
}

async function loadRoom(): Promise<RoomInfo> {
  const res = await fetch("/api/room", { credentials: "same-origin", headers: { accept: "application/json" } });
  if (!res.ok) return { configured: false, shows: [] };
  return (await res.json()) as RoomInfo;
}

const SEAT = "avn.room.seat";
const seat = {
  get: (): Seat | null => {
    try {
      const v = JSON.parse(sessionStorage.getItem(SEAT) ?? "null") as Seat | null;
      return v && typeof v.slug === "string" && (v.mode === "proxy" || (typeof v.resume === "string" && /^https?:\/\//.test(v.resume))) ? v : null;
    } catch {
      return null;
    }
  },
  set: (v: Seat | null) => {
    try {
      if (v) sessionStorage.setItem(SEAT, JSON.stringify(v));
      else sessionStorage.removeItem(SEAT);
    } catch {
      /* storage blocked */
    }
  },
};

const greeting = (now: number) => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(now));
  return h < 11 ? "Good morning" : h < 15 ? "Good afternoon" : h < 19 ? "Good evening" : "Good night";
};

export default function DashboardPage() {
  useDocumentTitle("Theater room");
  const { user } = useAuth();
  if (user === null) return <Navigate to="/login?next=%2Fdashboard" replace />;
  if (!user) {
    return (
      <div className="page container page-body room-page">
        <Skeleton height={420} />
      </div>
    );
  }
  return <Room user={user} />;
}

function Room({ user }: { user: Account }) {
  const ref = useRef<HTMLDivElement>(null);
  const now = useClock();
  const shows = useResource(() => api.listShows("upcoming"), []);
  const room = useResource(loadRoom, []);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const list = shows.data ?? [];
  const current = list[0];
  const onStage = !!current && new Date(current.startsAt).getTime() <= now && now < new Date(current.endsAt).getTime();
  const info = room.data;
  const openShow = info?.shows.find((s) => s.open);
  const [playback, setPlayback] = useState<{ data: Playback; title: string; slug: string; mode: Mode; resume?: string } | null>(null);
  const [entering, setEntering] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // After a reload, continue the same viewer session before asking for a new one.
  // After a reload, continue the same viewer: proxy mode reopens through the
  // server (same viewer id, so no new view); direct mode resumes first.
  useEffect(() => {
    const was = seat.get();
    if (!was || !info?.configured) return;
    let live = true;
    const reopen = was.mode === "proxy" ? openSession(was.slug, "proxy").catch(() => null) : resumePlayback(was.resume!).then((p) => (p ? { data: p, resume: was.resume } : null));
    reopen.then((p) => {
      if (!live) return;
      if (p) setPlayback({ ...p, title: was.title, slug: was.slug, mode: was.mode });
      else seat.set(null);
    });
    return () => {
      live = false;
    };
  }, [info]);

  const enterRoom = async (show: RoomShow, mode: Mode = "proxy") => {
    setEntering(true);
    setProblem(null);
    try {
      const p = await openSession(show.slug, mode);
      seat.set({ slug: show.slug, title: show.title, mode, resume: p.resume });
      setPlayback({ ...p, title: show.title, slug: show.slug, mode });
    } catch (e) {
      if (mode === "proxy") return enterRoom(show, "direct");
      setProblem(e instanceof Error ? e.message : String(e));
      setPlayback(null);
    } finally {
      setEntering(false);
    }
  };

  const leave = useCallback(() => {
    seat.set(null);
    setPlayback(null);
  }, []);

  // The proxied stream wouldn't load: try the direct route once.
  const latest = useRef({ playback, enterRoom });
  latest.current = { playback, enterRoom };
  const fatal = useCallback(() => {
    const p = latest.current.playback;
    setPlayback(null);
    if (p?.mode === "proxy") {
      void latest.current.enterRoom({ slug: p.slug, title: p.title, open: true }, "direct");
      return;
    }
    seat.set(null);
    setProblem("The show isn’t coming through right now. Try entering again in a moment.");
  }, []);

  useGSAP(
    () => {
      enter(".room-head > *, .room-grid > *", { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.07, clearProps: "transform,opacity,visibility" });
    },
    { scope: ref },
  );

  return (
    <div className="page room-page" ref={ref}>
      <div className="container page-body">
        <header className="room-head">
          <div>
            <p className="label">Theater room</p>
            <h1 className="room-head__title">
              {greeting(now)}, <span>{user.name.split(" ")[0]}</span>
            </h1>
          </div>
          <div className="room-head__account">
            <span className="room-head__avatar" aria-hidden>
              {user.name[0]?.toUpperCase()}
            </span>
            <span className="room-head__who">
              <span className="room-head__name">{user.name}</span>
              <span className="meta">{user.email}</span>
            </span>
            <button
              type="button"
              className="room-head__out"
              onClick={async () => {
                await logout();
                navigate("/", { replace: true });
              }}
            >
              <Icon name="logout" size={16} />
              Sign out
            </button>
          </div>
        </header>

        <div className="room-grid">
          <section className="room-screen" aria-label="Screen">
            {playback ? (
              <TheaterPlayer key={`${playback.slug}-${playback.mode}`} playback={playback.data} resumeUrl={playback.resume} title={playback.title} onEnded={leave} onFatal={fatal} />
            ) : (
              <Curtain
                show={current}
                now={now}
                onStage={onStage}
                loading={shows.status === "loading" || room.status === "loading"}
                open={openShow}
                entering={entering}
                problem={problem}
                onEnter={enterRoom}
              />
            )}
            <div className="room-screen__caption">
              <span className={`room-badge ${playback || openShow ? "is-on" : ""}`}>
                <i aria-hidden />
                {playback ? "Now showing" : openShow ? "Doors open" : onStage ? "On stage" : "Room closed"}
              </span>
              <span className="room-screen__title">{playback?.title ?? openShow?.title ?? current?.title ?? "No show scheduled"}</span>
              {current && !playback && !openShow && <span className="meta">{teamLabel(current.team)}</span>}
            </div>
          </section>

          <aside className="room-side">
            {current ? <Tonight show={current} /> : <div className="room-card"><Skeleton height={220} /></div>}
            <div className="room-card">
              <div className="room-card__head">
                <p className="label">Coming up</p>
                <Link to="/theater" className="room-card__more">
                  Schedule <Icon name="arrowRight" size={14} />
                </Link>
              </div>
              <ol className="room-list">
                {list.slice(1, 5).map((s) => (
                  <li key={s.slug}>
                    <Link to={`/theater/${s.slug}`} className="room-list__item">
                      <span className="room-list__date">
                        <span className="num">{formatDate(s.startsAt, { day: "numeric", month: undefined, year: undefined })}</span>
                        <span>{formatWeekday(s.startsAt)}</span>
                      </span>
                      <span className="room-list__main">
                        <span className="room-list__title">{s.title}</span>
                        <span className="meta">
                          {formatTime(s.startsAt)} WIB · {teamLabel(s.team)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {shows.status !== "loading" && list.length <= 1 && <li className="meta">Nothing else announced yet.</li>}
              </ol>
            </div>
          </aside>
        </div>

        <section className="room-account" aria-label="Your account">
          <div>
            <p className="label">Member since</p>
            <p className="room-account__value">{formatDate(user.createdAt)}</p>
          </div>
          <div>
            <p className="label">Signed in as</p>
            <p className="room-account__value">{user.email}</p>
          </div>
          <div>
            <p className="label">Access</p>
            <p className="room-account__value">
              <Icon name="check" size={16} /> Theater room
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** The screen before the doors open: a drawn curtain with the next show and a countdown. */
function Curtain({
  show,
  now,
  onStage,
  loading,
  open,
  entering,
  problem,
  onEnter,
}: {
  show?: ShowSummary;
  now: number;
  onStage: boolean;
  loading: boolean;
  open?: RoomShow;
  entering: boolean;
  problem: string | null;
  onEnter: (s: RoomShow) => void;
}) {
  const left = show ? new Date(show.startsAt).getTime() - now : 0;
  const c = formatCountdown(left);
  return (
    <div className="curtain-screen">
      <span className="curtain-screen__folds" aria-hidden />
      <span className="curtain-screen__spot" aria-hidden />
      <div className="curtain-screen__body">
        {loading ? (
          <span className="player__spinner" aria-label="Loading" />
        ) : open ? (
          <>
            <span className="curtain-screen__kicker">The doors are open</span>
            <span className="curtain-screen__show">{open.title}</span>
            <button type="button" className="curtain-screen__enter" onClick={() => onEnter(open)} disabled={entering} aria-busy={entering || undefined}>
              {entering ? <span className="btn__spinner" aria-hidden /> : <Icon name="play" size={18} />}
              {entering ? "Taking your seat…" : "Enter the room"}
            </button>
            {problem ? (
              <span className="curtain-screen__problem" role="alert">
                {problem}
              </span>
            ) : (
              <span className="curtain-screen__note">Sound starts muted. Tap the speaker to turn it on.</span>
            )}
          </>
        ) : show ? (
          <>
            <span className="curtain-screen__art">
              <ShowArt show={show} use="poster" />
            </span>
            <span className="curtain-screen__kicker">{onStage ? "On stage now" : "Doors open in"}</span>
            {!onStage && (
              <span className="curtain-screen__count mono" role="timer">
                {c.d > 0 && <span>{c.d}d </span>}
                {c.h}:{c.m}:{c.s}
              </span>
            )}
            <span className="curtain-screen__note">
              {onStage ? "The picture will appear here as soon as the room opens." : `${show.title} · ${formatWeekday(show.startsAt)} ${formatTime(show.startsAt)} WIB`}
            </span>
          </>
        ) : (
          <span className="curtain-screen__note">No show is scheduled. Check back when the next schedule is out.</span>
        )}
      </div>
    </div>
  );
}

function Tonight({ show }: { show: ShowSummary }) {
  return (
    <Link to={`/theater/${show.slug}`} className="room-card room-tonight">
      <span className="room-tonight__art">
        <ShowArt show={show} use="poster" />
      </span>
      <span className="room-tonight__info">
        <span className="label">Next show</span>
        <span className="room-tonight__title">{show.title}</span>
        <span className="meta">
          {formatWeekday(show.startsAt)} {formatDate(show.startsAt, { year: undefined })} · {formatTime(show.startsAt)}–{formatTime(show.endsAt)} WIB
        </span>
        <LineupAvatars members={show.lineupMembers} max={6} size={24} />
      </span>
    </Link>
  );
}
