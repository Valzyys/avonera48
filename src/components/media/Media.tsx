import { useState, type CSSProperties, type ReactNode } from "react";
import type { LivePlatform, LiveStream, Member, TheaterShow } from "@/types";
import { cx } from "@/utils/format";
import { teamColor } from "@/utils/team";

/*
 * Media slots. Images come from the source (proxied by jkt48connect.com).
 * If one is missing or fails to load, a quiet tinted tile with initials
 * takes its place — never an imitation photo.
 */

/** Accent colour of a member (team based — a site design choice). */
export const oshi = (m: Pick<Member, "color">) => ({ ["--oshi" as string]: m.color }) as CSSProperties;

function Img({ src, alt, fallback, className, eager }: { src?: string; alt: string; fallback: ReactNode; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return <img className={className} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export function MemberPhoto({ member, className, style, eager }: { member: Member; className?: string; style?: CSSProperties; eager?: boolean; compact?: boolean }) {
  return (
    <span className={cx("media mp", className)} style={{ ...oshi(member), ...style }}>
      <Img
        src={member.photoUrl}
        alt={member.name}
        eager={eager}
        fallback={
          <span className="mp__fallback" role="img" aria-label={`${member.name} (no photo)`}>
            {member.nickname.slice(0, 2)}
          </span>
        }
      />
    </span>
  );
}

export function Avatar({ member, size = 32, className }: { member: Member; size?: number; className?: string; ring?: boolean }) {
  return (
    <span className={cx("avatar", className)} style={{ width: size, height: size, ...oshi(member) }} aria-hidden>
      <Img src={member.photoUrl} alt="" fallback={<span style={{ fontSize: Math.round(size * 0.42) }}>{member.nickname[0]}</span>} />
    </span>
  );
}

export function ShowArt({ show, className, banner }: { show: Pick<TheaterShow, "title" | "posterUrl" | "bannerUrl" | "team">; className?: string; banner?: boolean }) {
  return (
    <span className={cx("media sa", className)} style={{ ["--oshi" as string]: teamColor(show.team) } as CSSProperties}>
      <Img
        src={banner ? show.bannerUrl ?? show.posterUrl : show.posterUrl}
        alt={`${show.title} poster`}
        fallback={
          <span className="sa__fallback" role="img" aria-label={`${show.title} (no poster)`}>
            <span className="sa__kicker">Theater</span>
            <span className="sa__title">{show.title}</span>
          </span>
        }
      />
    </span>
  );
}

export function StreamThumb({ stream, member, className }: { stream: Pick<LiveStream, "thumbnailUrl" | "title">; member: Member; className?: string }) {
  return (
    <span className={cx("media mp", className)} style={oshi(member)}>
      <Img
        src={stream.thumbnailUrl ?? member.photoUrl}
        alt={`${member.nickname}: ${stream.title}`}
        fallback={
          <span className="mp__fallback" role="img" aria-label={`${member.nickname} stream (no thumbnail)`}>
            {member.nickname.slice(0, 2)}
          </span>
        }
      />
    </span>
  );
}

export function PlatformMark({ platform }: { platform: LivePlatform }) {
  return <span className={cx("platform", platform === "IDN Live" ? "platform--idn" : "platform--sr")}>{platform}</span>;
}

/** Small status flag on a card: LIVE, BIRTHDAY, … */
export function Flag({ tone = "ink", children, className }: { tone?: "live" | "ink" | "light"; children: ReactNode; className?: string }) {
  return <span className={cx("flag", `flag--${tone}`, className)}>{children}</span>;
}
