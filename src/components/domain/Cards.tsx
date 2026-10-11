import type { CSSProperties } from "react";
import { Link } from "react-router";
import { Avatar, Flag, MemberPhoto, PlatformMark, ShowArt, StreamThumb } from "@/components/media/Media";
import { Icon } from "@/components/ui";
import { formatClock, useClock } from "@/hooks/useClock";
import { api, type LiveItem, type ShowSummary } from "@/services";
import type { Member, NewsArticle } from "@/types";
import { cx, formatDate, formatDuration, formatRelative, formatTime } from "@/utils/format";
import { MemberStatusBadge, ShowStatusBadge } from "./Badges";

/** view-transition-name helpers: one name per record, shared by list and detail. */
export const vtPhoto = (slug: string): CSSProperties => ({ viewTransitionName: `photo-${slug}` });
export const vtShow = (slug: string): CSSProperties => ({ viewTransitionName: `show-${slug}` });

/** Ticking "live for" timer, based on the data source clock. */
export function LiveFor({ since }: { since: string }) {
  const now = useClock();
  return <span className="mono">{formatClock(now - new Date(since).getTime())}</span>;
}

export function LiveTile({ item, onOpen }: { item: LiveItem; onOpen: (i: LiveItem) => void; index?: number; size?: "md" | "lg" }) {
  return (
    <article className="live-tile">
      <div className="live-tile__media">
        <MemberPhoto member={item.member} />
        <Flag tone="live" className="card-flag">
          LIVE
        </Flag>
        <span className="live-tile__time" aria-label="Live for">
          <LiveFor since={item.startedAt} />
        </span>
      </div>
      <div className="live-tile__body">
        <p className="live-tile__title">{item.title}</p>
        <p className="live-tile__meta meta">
          <PlatformMark platform={item.platform} />
          {item.viewers !== undefined && <span className="num">{item.viewers.toLocaleString("en-US")} watching</span>}
        </p>
      </div>
      <button type="button" className="tile-hit" onClick={() => onOpen(item)}>
        <span className="sr-only">
          Stream details: {item.member.nickname}, {item.title}
        </span>
      </button>
    </article>
  );
}

export function StreamCard({ item, onOpen }: { item: LiveItem; onOpen: (i: LiveItem) => void; index?: number }) {
  return (
    <article className="stream-card">
      <div className="stream-card__media">
        <StreamThumb stream={item} member={item.member} />
        <span className="stream-card__duration mono">{formatDuration(item.startedAt, item.endedAt!)}</span>
      </div>
      <div className="stream-card__body">
        <p className="stream-card__title">{item.title}</p>
        <p className="stream-card__meta meta">
          <Link to={`/members/${item.member.slug}`} viewTransition className="stream-card__member">
            {item.member.name}
          </Link>
          <span>·</span>
          <PlatformMark platform={item.platform} />
          <span>·</span>
          <span>{formatRelative(item.startedAt, api.now)}</span>
        </p>
      </div>
      <button type="button" className="tile-hit" onClick={() => onOpen(item)}>
        <span className="sr-only">
          Stream details: {item.member.nickname}, {item.title}
        </span>
      </button>
    </article>
  );
}

export function LineupAvatars({ members, max = 6, size = 26 }: { members: Member[]; max?: number; size?: number }) {
  if (members.length === 0) return <span className="meta">Lineup not announced</span>;
  return (
    <span className="lineup-avatars" aria-label={`${members.length} members: ${members.map((m) => m.nickname).join(", ")}`}>
      {members.slice(0, max).map((m) => (
        <Avatar key={m.slug} member={m} size={size} />
      ))}
      {members.length > max && <span className="lineup-avatars__more meta num">+{members.length - max}</span>}
    </span>
  );
}

/** Schedule row: time · show · lineup · status. */
export function ShowRow({ show, withDate = false, shareName = true }: { show: ShowSummary; index?: number; withDate?: boolean; shareName?: boolean }) {
  return (
    <li>
      <Link to={`/theater/${show.slug}`} viewTransition className={cx("show-row", `is-${show.status}`)}>
        <span className="show-row__time">
          {withDate && <span className="show-row__date">{formatDate(show.startsAt, { year: undefined })}</span>}
          <span className="show-row__clock">{formatTime(show.startsAt)}</span>
        </span>
        <span className="show-row__art" style={shareName ? vtShow(show.slug) : undefined}>
          <ShowArt show={show} />
        </span>
        <span className="show-row__main">
          <span className="show-row__title">{show.title}</span>
          <span className="meta">{show.center ? `Center · ${show.center.nickname}` : show.lineupMembers.length ? `${show.lineupMembers.length} members` : "Lineup not announced"}</span>
        </span>
        <span className="show-row__lineup">
          <LineupAvatars members={show.lineupMembers} max={6} />
        </span>
        <span className="show-row__status">
          <ShowStatusBadge status={show.status} />
          <Icon name="chevronRight" size={16} />
        </span>
      </Link>
    </li>
  );
}

export function MemberCard({ member, live }: { member: Member; live?: boolean; index?: number }) {
  return (
    <li className="member-card">
      <Link to={`/members/${member.slug}`} viewTransition className="member-card__link">
        <span className="member-card__photo" style={vtPhoto(member.slug)}>
          <MemberPhoto member={member} />
          {live && (
            <Flag tone="live" className="card-flag">
              LIVE
            </Flag>
          )}
        </span>
        <span className="member-card__meta meta">
          {member.status !== "active" ? <MemberStatusBadge status={member.status} /> : <span>Joined {member.joinedYear}</span>}
        </span>
      </Link>
    </li>
  );
}

export function NewsRow({ article }: { article: NewsArticle; index?: number }) {
  return (
    <li>
      <Link to={`/news/${article.slug}`} viewTransition className="news-row">
        <time className="news-row__date num" dateTime={article.publishedAt}>
          {formatDate(article.publishedAt, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join(".")}
        </time>
        <span className="news-row__cat">{article.category}</span>
        <span className="news-row__title">{article.title}</span>
        <Icon name="chevronRight" size={16} />
      </Link>
    </li>
  );
}
