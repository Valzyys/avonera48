import type { CSSProperties, ReactNode } from "react";
import type { LivePlatform, LiveStream, Member, TheaterShow } from "@/types";
import { cx } from "@/utils/format";

/*
 * Media slots. A real image URL renders as-is. Without one we show a
 * "name card" — the member's oshi colour, her name set large and a penlight
 * strip — the way official idol sites use member colours. It is plainly a
 * name card, not an imitation photo.
 */

export const oshi = (m: Pick<Member, "color">) => ({ ["--oshi" as string]: m.color }) as CSSProperties;
const tint = (hue: number) => ({ ["--h" as string]: hue }) as CSSProperties;

export function MemberPhoto({ member, className, style, compact }: { member: Member; className?: string; style?: CSSProperties; compact?: boolean }) {
  if (member.photoUrl) {
    return <img className={cx("media", className)} src={member.photoUrl} alt={member.name} loading="lazy" decoding="async" style={style} />;
  }
  return (
    <span className={cx("media nc", compact && "nc--compact", className)} style={{ ...oshi(member), ...style }} role="img" aria-label={`${member.name}, generation ${member.generation} (no photo yet)`}>
      <span className="nc__gen" aria-hidden>
        Gen {String(member.generation).padStart(2, "0")}
      </span>
      <span className="nc__nick" aria-hidden>
        {member.nickname}
      </span>
      {!compact && (
        <span className="nc__name" aria-hidden>
          {member.name}
        </span>
      )}
    </span>
  );
}

export function Avatar({ member, size = 32, className }: { member: Member; size?: number; className?: string; ring?: boolean }) {
  return (
    <span className={cx("avatar", className)} style={{ width: size, height: size, ...oshi(member) }} aria-hidden>
      {member.photoUrl ? <img src={member.photoUrl} alt="" loading="lazy" /> : <span style={{ fontSize: Math.round(size * 0.42) }}>{member.nickname[0]}</span>}
    </span>
  );
}

export function ShowArt({ show, className }: { show: Pick<TheaterShow, "title" | "setlist" | "hue" | "posterUrl">; className?: string }) {
  if (show.posterUrl) return <img className={cx("media", className)} src={show.posterUrl} alt={`${show.title} poster`} loading="lazy" />;
  return (
    <span className={cx("media sa", className)} style={tint(show.hue)} role="img" aria-label={`${show.title} (no poster yet)`}>
      <span className="sa__kicker">Theater</span>
      <span className="sa__title">{show.setlist}</span>
    </span>
  );
}

export function StreamThumb({ stream, member, className }: { stream: Pick<LiveStream, "thumbnailUrl" | "title">; member: Member; className?: string }) {
  if (stream.thumbnailUrl) return <img className={cx("media", className)} src={stream.thumbnailUrl} alt={stream.title} loading="lazy" />;
  return (
    <span className={cx("media nc nc--thumb", className)} style={oshi(member)} role="img" aria-label={`${member.nickname} stream (no thumbnail)`}>
      <span className="nc__nick" aria-hidden>
        {member.nickname}
      </span>
    </span>
  );
}

export function PlatformMark({ platform }: { platform: LivePlatform }) {
  return <span className={cx("platform", platform === "IDN Live" ? "platform--idn" : "platform--sr")}>{platform}</span>;
}

/** Rectangular status flag on a card: LIVE, CENTER, UNIT. */
export function Flag({ tone = "ink", children, className }: { tone?: "live" | "ink" | "light"; children: ReactNode; className?: string }) {
  return <span className={cx("flag", `flag--${tone}`, className)}>{children}</span>;
}
