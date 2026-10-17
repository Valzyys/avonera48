import { useState, type CSSProperties } from "react";
import type { PreShowMember } from "../data/types";

const initials = (m: PreShowMember) =>
  (m.nickname ?? m.name)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** A lineup card: duotone photo turning full colour as it lands; silhouette + initials without one. */
export function MemberCard({ member, style, className }: { member: PreShowMember; style?: CSSProperties; className?: string }) {
  const [broken, setBroken] = useState(false);
  const photo = member.photoUrl && !broken;
  return (
    <figure className={`ps-card ${className ?? ""}`} style={style}>
      <span className="ps-card__photo">
        {photo ? (
          <img src={member.photoUrl} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="ps-card__ghost" aria-hidden>
            <svg viewBox="0 0 60 80">
              <circle cx="30" cy="28" r="13" />
              <path d="M6 80c2-17 12-26 24-26s22 9 24 26z" />
            </svg>
            <b>{initials(member)}</b>
          </span>
        )}
      </span>
      <figcaption>
        <b>{member.nickname ?? member.name}</b>
        {member.nickname && member.nickname !== member.name && <span>{member.name}</span>}
      </figcaption>
    </figure>
  );
}
