import type { CSSProperties } from "react";
import type { LivePlatform, LiveStream, Member, TheaterShow } from "@/types";
import { cx } from "@/utils/format";

/*
 * Media slots. When a real source provides an image URL we render it;
 * otherwise a quiet tinted tile with initials — the same honest fallback a
 * production app shows for a missing photo. Nothing here imitates official
 * photography or artwork.
 */

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

const tint = (hue: number) => ({ ["--h" as string]: hue }) as CSSProperties;

export function MemberPhoto({ member, className, style }: { member: Member; className?: string; style?: CSSProperties }) {
  if (member.photoUrl) {
    return <img className={cx("media", className)} src={member.photoUrl} alt={member.name} loading="lazy" decoding="async" style={style} />;
  }
  return (
    <span className={cx("media media--ph media--card", className)} style={{ ...tint(member.hue), ...style }} role="img" aria-label={`${member.name} (no photo yet)`}>
      <span className="media__gen" aria-hidden>
        {String(member.generation).padStart(2, "0")}
      </span>
      <span className="media__initials">{initials(member.name)}</span>
      <span className="media__plate" aria-hidden>
        {member.nickname}
      </span>
    </span>
  );
}

export function Avatar({ member, size = 32, className }: { member: Member; size?: number; className?: string }) {
  return (
    <span className={cx("avatar", className)} style={{ width: size, height: size, ...tint(member.hue) }} aria-hidden>
      {member.photoUrl ? <img src={member.photoUrl} alt="" loading="lazy" /> : <span style={{ fontSize: Math.round(size * 0.38) }}>{initials(member.name)}</span>}
    </span>
  );
}

export function ShowArt({ show, className }: { show: Pick<TheaterShow, "title" | "setlist" | "hue" | "posterUrl">; className?: string }) {
  if (show.posterUrl) return <img className={cx("media", className)} src={show.posterUrl} alt={`${show.title} poster`} loading="lazy" />;
  return (
    <span className={cx("media media--ph media--show", className)} style={tint(show.hue)} role="img" aria-label={`${show.title} (no poster yet)`}>
      <span className="media__kicker">Setlist</span>
      <span className="media__title">{show.setlist}</span>
      <span className="media__venue">JKT48 Theater</span>
    </span>
  );
}

export function StreamThumb({ stream, member, className }: { stream: Pick<LiveStream, "thumbnailUrl" | "title">; member: Member; className?: string }) {
  if (stream.thumbnailUrl) return <img className={cx("media", className)} src={stream.thumbnailUrl} alt={stream.title} loading="lazy" />;
  return (
    <span className={cx("media media--ph media--thumb", className)} style={tint(member.hue)} role="img" aria-label={`${member.nickname} stream (no thumbnail)`}>
      <span className="media__initials">{initials(member.name)}</span>
      <span className="media__plate" aria-hidden>
        {stream.title}
      </span>
    </span>
  );
}

export function PlatformMark({ platform }: { platform: LivePlatform }) {
  return <span className={cx("platform", platform === "IDN Live" ? "platform--idn" : "platform--sr")}>{platform}</span>;
}
