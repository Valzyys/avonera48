import { createBrowserRouter, RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeContext";
import { DashboardLayout } from "@/layouts/DashboardLayout";
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
  // Sign-in pages are full screen, outside the site chrome.
  { path: "login", errorElement: <RouteError />, lazy: async () => ({ Component: (await import("@/pages/auth/AuthPage")).LoginPage }) },
  { path: "register", errorElement: <RouteError />, lazy: async () => ({ Component: (await import("@/pages/auth/AuthPage")).RegisterPage }) },
  // The members' area has its own shell (sidebar / tab bar).
  {
    path: "dashboard",
    element: <DashboardLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: page(() => import("@/pages/dashboard/OverviewPage")) },
      { path: "schedule", lazy: page(() => import("@/pages/dashboard/SchedulePage")) },
      { path: "schedule/:slug", lazy: page(() => import("@/pages/dashboard/ShowPage")) },
      { path: "membership", lazy: page(() => import("@/pages/dashboard/MembershipPage")) },
      { path: "transactions", lazy: page(() => import("@/pages/dashboard/TransactionsPage")) },
      { path: "profile", lazy: page(() => import("@/pages/dashboard/ProfilePage")) },
      { path: "watch/:slug", lazy: page(() => import("@/pages/dashboard/WatchRoomPage")) },
      { path: "pay/:id", lazy: page(() => import("@/pages/dashboard/PayPage")) },
      { path: "admin", lazy: page(() => import("@/pages/dashboard/AdminPage")) },
      { path: "connect/jkt48connect", lazy: page(() => import("@/pages/dashboard/ConnectPage")) },
      { path: "*", lazy: page(() => import("@/pages/site/NotFoundPage")) },
    ],
  },
  {
    element: <SiteLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "live", lazy: page(() => import("@/pages/fan/LivePage")) },
      { path: "watch/:slug", lazy: page(() => import("@/pages/fan/WatchPage")) },
      { path: "recent-live", lazy: page(() => import("@/pages/fan/RecentLivePage")) },
      { path: "recent-live/:id", lazy: page(() => import("@/pages/fan/RecentDetailPage")) },
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
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <ThemedToaster />
    </ThemeProvider>
  );
}
