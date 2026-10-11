import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LivePlatform, LiveStream, Member, TheaterShow } from "@/types";
import { cx } from "@/utils/format";
import { retryOrigin } from "@/utils/media";
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
 * Theater artwork. The source's "poster" and "banner" come in different
 * shapes (and are not always the shape their name suggests), so once an
 * image loads we compare its shape with the slot: if the other image fits
 * the slot better we switch to it, and the one we keep fills the slot. Only
 * when neither fits is the whole image shown over a blurred copy of itself.
 */
export function ShowArt({ show, className, banner }: { show: Pick<TheaterShow, "title" | "posterUrl" | "bannerUrl" | "team">; className?: string; banner?: boolean }) {
  const first = banner ? show.bannerUrl ?? show.posterUrl : show.posterUrl ?? show.bannerUrl;
  const other = first === show.posterUrl ? show.bannerUrl : show.posterUrl;
  const [src, setSrc] = useState(first);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [failed, setFailed] = useState(false);
  const tried = useRef(false);

  const onLoad = (img: HTMLImageElement) => {
    const slot = img.parentElement?.getBoundingClientRect();
    if (!slot || !slot.height || !img.naturalHeight) return;
    const mismatch = Math.abs(Math.log(img.naturalWidth / img.naturalHeight / (slot.width / slot.height)));
    if (mismatch > Math.log(1.45) && other && !tried.current) {
      tried.current = true;
      setSrc(other);
      return;
    }
    setFit(mismatch > Math.log(1.45) ? "contain" : "cover");
  };

  return (
    <span className={cx("media sa", `sa--${fit}`, className)} style={{ ["--oshi" as string]: teamColor(show.team) } as CSSProperties}>
      {src && !failed ? (
        <>
          {fit === "contain" && <img className="sa__bg" src={src} alt="" aria-hidden decoding="async" referrerPolicy="no-referrer" />}
          <img
            className="sa__img"
            src={src}
            alt={`${show.title} poster`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={(e) => onLoad(e.currentTarget)}
            onError={(e) =>
              retryOrigin(e.currentTarget, () => {
                if (other && !tried.current) {
                  tried.current = true;
                  setSrc(other);
                } else setFailed(true);
              })
            }
          />
        </>
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
