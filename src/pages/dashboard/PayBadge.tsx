import { gsap } from "@/motion/gsap";

export type PayOutcome = "paid" | "cancelled" | "expired";

const SPARKS = 12;

/**
 * The mark at the top of a finished payment. Every stroke has pathLength 1,
 * so `playOutcome` can draw it with a 1 → 0 dash offset.
 */
export function PayBadge({ kind }: { kind: PayOutcome }) {
  return (
    <span className={`pay-badge is-${kind}`} aria-hidden>
      <span className="pay-badge__ripple" />
      <span className="pay-badge__ripple" />
      {kind === "paid" && (
        <span className="pay-badge__sparks">
          {Array.from({ length: SPARKS }, (_, k) => (
            <span key={k} className="pay-badge__spark" style={{ transform: `rotate(${(360 / SPARKS) * k}deg)` }}>
              <i />
            </span>
          ))}
        </span>
      )}
      <svg className="pay-badge__svg" viewBox="0 0 120 120">
        <circle className="pay-badge__track" cx="60" cy="60" r="52" />
        <circle className="pay-badge__ring" cx="60" cy="60" r="52" pathLength={1} />
        <circle className="pay-badge__fill" cx="60" cy="60" r="44" />
        {kind === "paid" && <path className="pay-badge__mark" d="M40 61.5 L54 75 L81 46" pathLength={1} />}
        {kind === "cancelled" && (
          <>
            <path className="pay-badge__mark" d="M45 45 L75 75" pathLength={1} />
            <path className="pay-badge__mark" d="M75 45 L45 75" pathLength={1} />
          </>
        )}
        {kind === "expired" && (
          <>
            <path className="pay-badge__hand pay-badge__hand--h" d="M60 60 V42" />
            <path className="pay-badge__hand pay-badge__hand--m" d="M60 60 V33" />
            <circle className="pay-badge__pin" cx="60" cy="60" r="3.5" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * One timeline per outcome. Paid: the ring closes, the disc swells, the tick
 * draws, sparks fly and the receipt is stamped. Cancelled: two strokes cross
 * out, the badge shakes its head, the total is struck through. Expired: the
 * clock spins out and winds down, the badge sinks a little.
 * `scope` is the page root; the stamp and strike live in the receipt.
 */
export function playOutcome(scope: HTMLElement, kind: PayOutcome) {
  const q = gsap.utils.selector(scope);
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  const badge = q(".pay-badge");
  const text = q(".pay-done__title, .pay-done .meta, .pay-actions");
  const stamp = q(".pay-stamp");

  gsap.set(q(".pay-badge__ring"), { strokeDashoffset: 1 });
  gsap.set(q(".pay-badge__mark"), { strokeDashoffset: 1 });
  gsap.set(q(".pay-badge__fill"), { scale: 0, transformOrigin: "50% 50%" });
  gsap.set(text, { autoAlpha: 0, y: 14 });
  gsap.set(stamp, { autoAlpha: 0, scale: 2.6, rotate: -32 });

  tl.fromTo(badge, { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(1.6)" })
    .to(q(".pay-badge__ring"), { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }, 0.1)
    .to(q(".pay-badge__fill"), { scale: 1, duration: 0.55, ease: "back.out(1.9)" }, 0.55);

  if (kind === "paid") {
    tl.to(q(".pay-badge__mark"), { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" }, 0.85)
      .to(badge, { keyframes: [{ scale: 1.1, duration: 0.14 }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.45)" }] }, 1.18)
      .fromTo(q(".pay-badge__spark i"), { y: 0, scaleY: 1.4, autoAlpha: 1 }, { y: -40, scaleY: 0, autoAlpha: 0, duration: 0.75, ease: "expo.out", stagger: { each: 0.012, from: "random" }, immediateRender: false }, 1.18)
      .fromTo(q(".pay-badge__ripple"), { scale: 0.85, autoAlpha: 0.55 }, { scale: 1.9, autoAlpha: 0, duration: 1.3, ease: "power2.out", stagger: 0.22, immediateRender: false }, 1.2);
  } else if (kind === "cancelled") {
    const [a, b] = q(".pay-badge__mark");
    tl.to(a, { strokeDashoffset: 0, duration: 0.28, ease: "power2.in" }, 0.85)
      .to(b, { strokeDashoffset: 0, duration: 0.28, ease: "power2.in" }, 1.08)
      .to(badge, { keyframes: { x: [0, -12, 10, -7, 4, 0] }, duration: 0.55, ease: "power1.inOut" }, 1.36)
      .fromTo(q(".pay-strike"), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "power3.inOut" }, 1.7);
  } else {
    tl.fromTo(q(".pay-badge__hand--m"), { rotate: 0 }, { rotate: 1080 + 90, svgOrigin: "60 60", duration: 1.8, ease: "expo.out" }, 0.55)
      .fromTo(q(".pay-badge__hand--h"), { rotate: 0 }, { rotate: 300, svgOrigin: "60 60", duration: 1.8, ease: "expo.out" }, 0.55)
      .to(badge, { y: 6, rotate: -7, duration: 0.9, ease: "elastic.out(1, 0.5)" }, 1.75)
      .fromTo(q(".pay-strike"), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "power3.inOut" }, 1.9);
  }

  tl.to(text, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, clearProps: "transform" }, kind === "paid" ? 1.0 : 1.3);

  // The rubber stamp lands on the receipt with a thud the card feels.
  const land = kind === "paid" ? 1.45 : kind === "cancelled" ? 1.9 : 2.1;
  tl.to(stamp, { autoAlpha: 1, scale: 1, rotate: -12, duration: 0.32, ease: "power4.in" }, land).to(
    q(".pay-receipt"),
    { keyframes: { y: [0, 4, -1, 0], rotate: [0, 0.6, -0.2, 0] }, duration: 0.4, ease: "power2.out" },
    land + 0.3,
  );
  return tl;
}
