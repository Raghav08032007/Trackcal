// In-app navigation for the Vite app (React Router underneath).
// `Link` takes `href` like an anchor: same-site paths navigate in the app, absolute URLs and new-tab links
// render a normal <a>. `useRouter` offers push/replace/back; `usePathname` returns the current path.
// Outside a router (isolated component tests, embedded widgets) everything falls back to plain browser navigation.
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link as RouterLink, useInRouterContext, useLocation, useNavigate } from "react-router";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, target, ...rest }, ref) {
  const routed = useInRouterContext();
  const external = /^[a-z][a-z0-9+.-]*:/i.test(href) || target === "_blank";
  if (external || !routed) return <a ref={ref} href={href} target={target} {...rest} />;
  return <RouterLink ref={ref} to={href} target={target} {...rest} />;
});
export default Link;

function RoutedRouter() {
  const navigate = useNavigate();
  return { push: (href: string) => { void navigate(href); }, replace: (href: string) => { void navigate(href, { replace: true }); }, back: () => { void navigate(-1); } };
}
const browserRouter = { push: (href: string) => window.location.assign(href), replace: (href: string) => window.location.replace(href), back: () => window.history.back() };

export function useRouter() {
  // The branch is fixed for a component's lifetime (a component never moves in or out of a router).
  return useInRouterContext() ? RoutedRouter() : browserRouter;
}

export function usePathname() {
  return useInRouterContext() ? useLocation().pathname : window.location.pathname; // eslint-disable-line react-hooks/rules-of-hooks
}
