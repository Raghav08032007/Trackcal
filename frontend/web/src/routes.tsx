// URL -> page module. Each page loads on first visit and sets the tab title from its `metadata` export.
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { RootLayout } from "@/app/root-layout";
import { Link } from "@/lib/navigation";
import { msg, t, subscribe } from "@/lib/i18n";

const DEFAULT_TITLE = msg("TrackCal — Food & Nutrition Journal");
type PageModule = { default: ComponentType; metadata?: { title?: string } };

const pages: Record<string, () => Promise<PageModule>> = {
  "/": () => import("@/app/page"),
  "/account": () => import("@/app/account/page"),
  "/barcode": () => import("@/app/barcode/page"),
  "/describe": () => import("@/app/describe/page"),
  "/food-library": () => import("@/app/food-library/page"),
  "/forgot-password": () => import("@/app/forgot-password/page"),
  "/guide": () => import("@/app/guide/page"),
  "/help": () => import("@/app/help/page"),
  "/journal": () => import("@/app/journal/page"),
  "/login": () => import("@/app/login/page"),
  "/nutrition": () => import("@/app/nutrition/page"),
  "/offline": () => import("@/app/offline/page"),
  "/onboarding": () => import("@/app/onboarding/page"),
  "/plan": () => import("@/app/plan/page"),
  "/play": () => import("@/app/play/page"),
  "/play/sports": () => import("@/app/play/sports/page"),
  "/privacy": () => import("@/app/privacy/page"),
  "/progress": () => import("@/app/progress/page"),
  "/tracker": () => import("@/app/tracker/page"),
  "/recipes": () => import("@/app/recipes/page"),
  "/reset-password": () => import("@/app/reset-password/page"),
  "/routine": () => import("@/app/routine/page"),
  "/premium": () => import("@/app/premium/page"),
  "/feed": () => import("@/app/feed/page"),
  "/u/:handle": () => import("@/app/profile/page"),
  "/moderation": () => import("@/app/moderation/page"),
  "/accuracy": () => import("@/app/accuracy/page"),
  "/communities": () => import("@/app/communities/page"),
  "/credits": () => import("@/app/credits/page"),
  "/events": () => import("@/app/events/page"),
  "/body-preview": () => import("@/app/body-preview/page"),
  "/challenges": () => import("@/app/challenges/page"),
  "/challenges/:id": () => import("@/app/challenge/page"),
  "/events/:id": () => import("@/app/event/page"),
  "/events/:id/check-in": () => import("@/app/event-check-in/page"),
  "/c/:slug": () => import("@/app/community/page"),
  "/scanner": () => import("@/app/scanner/page"),
  "/signup": () => import("@/app/signup/page"),
  "/terms": () => import("@/app/terms/page"),
  "/tools": () => import("@/app/tools/page"),
  "/verify-email": () => import("@/app/verify-email/page"),
  "/workouts": () => import("@/app/workouts/page"),
  "/workouts/camera": () => import("@/app/workouts/camera/page"),
  "/workouts/camera/lab": () => import("@/app/workouts/camera/lab/page"),
  "/workouts/holds": () => import("@/app/workouts/holds/page"),
  "/workouts/muscles": () => import("@/app/workouts/muscles/page"),
  "/workouts/gps": () => import("@/app/workouts/gps/page"),
  "/design": () => import("@/app/design/page"),
  "/health": () => import("@/app/health/page"),
  "/activities": () => import("@/app/activities/page"),
  "/activities/:id": () => import("@/app/activity/page"),
  "/segments": () => import("@/app/segments/page"),
  "/weekly": () => import("@/app/weekly/page"),
  "/segments/:id": () => import("@/app/segment/page"),
  "/recovery": () => import("@/app/recovery/page"),
  "/coach": () => import("@/app/coach/page"),
  "/coach/clients": () => import("@/app/coach/clients/page"),
  "/menu": () => import("@/app/menu/page"),
  "/meal-plans": () => import("@/app/meal-plans/page"),
  "/programs": () => import("@/app/programs/page"),
  "/fasting": () => import("@/app/fasting/page"),
  "/food": () => import("@/app/food/page"),
  "/move": () => import("@/app/move/page"),
  "/me": () => import("@/app/me/page"),
};

function titled(load: () => Promise<PageModule>) {
  return lazy(async () => {
    const module = await load();
    const Page = module.default, title = module.metadata?.title || DEFAULT_TITLE;
    return { default: function TitledPage() { useEffect(() => { const show = () => { document.title = t(title); }; show(); return subscribe(show); }, []); return <Page />; } };
  });
}

function NotFound() {
  useEffect(() => { const show = () => { document.title = t("TrackCal — Page not found"); }; show(); return subscribe(show); }, []);
  return <main className="account-page"><section className="account-card"><h1>{t("Page not found")}</h1><p>{t("This address does not match a TrackCal page.")}</p><p><Link href="/">{t("Go to the workspace →")}</Link></p></section></main>;
}

function Loading() { return <main className="account-loading" aria-busy="true">{t("Loading…")}</main>; }
const loading = <Loading />;
export const routes: RouteObject[] = [{
  element: <RootLayout />,
  children: [
    ...Object.entries(pages).map(([path, load]) => { const Page = titled(load); return { path, element: <Suspense fallback={loading}><Page /></Suspense> }; }),
    { path: "*", element: <NotFound /> },
  ],
}];

export const createRouter = () => createBrowserRouter(routes);
