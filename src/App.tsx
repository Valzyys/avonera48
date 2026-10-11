import { createBrowserRouter, RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeContext";
import { SiteLayout } from "@/layouts/SiteLayout";
import { HomePage } from "@/pages/site/HomePage";
import { RouteError } from "@/pages/site/RouteError";

/*
 * Route-level code splitting via the router's `lazy`, so a navigation only
 * commits once the next page's module is loaded. That lets View Transitions
 * capture the finished page (and morph shared portraits/posters) instead of
 * a loading fallback.
 */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "live", lazy: page(() => import("@/pages/fan/LivePage")) },
      { path: "recent-live", lazy: page(() => import("@/pages/fan/RecentLivePage")) },
      { path: "theater", lazy: page(() => import("@/pages/fan/TheaterPage")) },
      { path: "theater/:slug", lazy: page(() => import("@/pages/fan/ShowDetailPage")) },
      { path: "members", lazy: page(() => import("@/pages/fan/MembersPage")) },
      { path: "members/:slug", lazy: page(() => import("@/pages/fan/MemberDetailPage")) },
      { path: "news", lazy: page(() => import("@/pages/fan/NewsPage")) },
      { path: "news/:slug", lazy: page(() => import("@/pages/fan/NewsDetailPage")) },
      { path: "about", lazy: page(() => import("@/pages/site/AboutPage")) },
      { path: "*", lazy: page(() => import("@/pages/site/NotFoundPage")) },
    ],
  },
]);

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" toastOptions={{ className: "toast", duration: 3200 }} containerAriaLabel="Notifications" />;
}

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <ThemedToaster />
    </ThemeProvider>
  );
}
