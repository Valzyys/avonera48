import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LivePlatform, LiveStream, Member, TheaterShow } from "@/types";
import { cx } from "@/utils/format";
import { retryOrigin } from "@/utils/media";
import { teamColor } from "@/utils/team";

/*
 * Media slots. Images come from the source through the site's /media proxy.
 * If one is missing or fails to load, a quiet tinted tile with initials
 * takes its place — never an imitation photo.
 */

/** Accent colour of a member (team based — a site design choice). */
export const oshi = (m: Pick<Member, "color">) => ({ ["--oshi" as string]: m.color }) as CSSProperties;

function Img({ src, alt, fallback, className, eager }: { src?: string; alt: string; fallback: ReactNode; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return <img className={className} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={(e) => retryOrigin(e.currentTarget, () => setFailed(true))} />;
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

/**
 * Theater artwork. Each slot asks for one image: the theater list uses the
 * banner, the home page, footer and show page use the poster. The other one
 * is only a stand-in when the requested image is missing or fails to load.
 * The source's images come in any shape (a "poster" can be wide, a "banner"
 * tall), so once the image loads the slot takes the image's own proportions:
 * it is never cropped and never letterboxed.
 */
type ShowArtProps = { show: Pick<TheaterShow, "title" | "posterUrl" | "bannerUrl" | "team">; className?: string; use?: "poster" | "banner" };

export function ShowArt(props: ShowArtProps) {
  const { show, use = "poster" } = props;
  const first = use === "banner" ? (show.bannerUrl ?? show.posterUrl) : (show.posterUrl ?? show.bannerUrl);
  // The image a slot asks for can arrive later (e.g. the dashboard learns the
  // banner after the show list); a new first choice starts the slot afresh.
  return <ShowArtImage key={first ?? ""} {...props} />;
}

function ShowArtImage({ show, className, use = "poster" }: ShowArtProps) {
  const first = use === "banner" ? (show.bannerUrl ?? show.posterUrl) : (show.posterUrl ?? show.bannerUrl);
  const other = first === show.posterUrl ? show.bannerUrl : show.posterUrl;
  const [src, setSrc] = useState(first);
  const [ratio, setRatio] = useState<number>();
  const [failed, setFailed] = useState(false);
  const tried = useRef(false);

  return (
    <span
      className={cx("media sa", !!ratio && "sa--sized", className)}
      style={{ ["--oshi" as string]: teamColor(show.team), ...(ratio ? { ["--ar" as string]: ratio.toFixed(4) } : {}) } as CSSProperties}
    >
      {src && !failed ? (
        <img
          className="sa__img"
          src={src}
          alt={`${show.title} poster`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h) setRatio(Math.min(3, Math.max(0.5, w / h)));
          }}
          onError={(e) =>
            retryOrigin(e.currentTarget, () => {
              if (other && !tried.current) {
                tried.current = true;
                setSrc(other);
              } else setFailed(true);
            })
          }
        />
      ) : (
        <span className="sa__fallback" role="img" aria-label={`${show.title} (no poster)`}>
          <span className="sa__kicker">Theater</span>
          <span className="sa__title">{show.title}</span>
        </span>
      )}
    </span>
  );
}

export function StreamThumb({ stream, member, className }: { stream: Pick<LiveStream, "thumbnailUrl" | "thumbnailAlt" | "title">; member: Member; className?: string }) {
  // Try each candidate in turn (stream image, room image, member photo).
  const candidates = [stream.thumbnailUrl, ...(stream.thumbnailAlt ?? []), member.photoUrl].filter((u, k, a): u is string => !!u && a.indexOf(u) === k);
  const [index, setIndex] = useState(0);
  const src = candidates[index];
  return (
    <span className={cx("media mp", className)} style={oshi(member)}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={`${member.nickname}: ${stream.title}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => retryOrigin(e.currentTarget, () => setIndex((n) => n + 1))}
        />
      ) : (
        <span className="mp__fallback" role="img" aria-label={`${member.nickname} stream (no thumbnail)`}>
          {member.nickname.slice(0, 2)}
        </span>
      )}
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
