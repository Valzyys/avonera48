import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigation } from "react-router";
import { Footer } from "@/components/layout/Footer";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Ticker } from "@/components/layout/Ticker";
import { ScrollTrigger } from "@/motion/gsap";
import { usePageMotion } from "@/motion/hooks";
import { PageFallback } from "@/components/layout/PageFallback";

export function SiteLayout() {
  const { pathname, hash } = useLocation();
  const navigation = useNavigation();
  const main = useRef<HTMLElement>(null);
  usePageMotion(main, pathname);
  useEffect(() => {
    // Pages mount new ScrollTriggers; measure them against the new layout.
    requestAnimationFrame(() => ScrollTrigger.refresh());
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <Ticker />
      <div className={`route-progress ${navigation.state !== "idle" ? "is-active" : ""}`} aria-hidden />
      <main id="main" tabIndex={-1} ref={main}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
