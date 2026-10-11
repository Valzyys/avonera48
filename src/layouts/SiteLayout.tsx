import { Suspense, useEffect } from "react";
import { Outlet, useLocation, useNavigation } from "react-router";
import { Footer } from "@/components/layout/Footer";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageFallback } from "@/components/layout/PageFallback";
import { useReveal } from "@/hooks/useReveal";

export function SiteLayout() {
  const { pathname, hash } = useLocation();
  const navigation = useNavigation();
  useReveal("body", [pathname]);
  useEffect(() => {
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
      <div className={`route-progress ${navigation.state !== "idle" ? "is-active" : ""}`} aria-hidden />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
