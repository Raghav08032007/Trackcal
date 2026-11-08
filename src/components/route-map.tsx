// A route drawn from its own points: no map service, so nothing about where you went leaves TrackCal.
import { useMemo } from "react";
import type { RoutePoint, Split, Sport } from "@/lib/activities";
import { duration, pace } from "@/lib/activities";

/** Flat projection around the route's middle: accurate to well under a percent at activity scale. */
function project(points: [number, number][], size: number, pad: number) {
  if (!points.length) return { xy: [] as [number, number][], metresPerUnit: 1 };
  const lat0 = (Math.min(...points.map(p => p[0])) + Math.max(...points.map(p => p[0]))) / 2;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  const raw = points.map(([lat, lon]) => [lon * kx, -lat * ky] as [number, number]);
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(x1 - x0, y1 - y0, 50), scale = (size - pad * 2) / span;
  const ox = pad + (size - pad * 2 - (x1 - x0) * scale) / 2, oy = pad + (size - pad * 2 - (y1 - y0) * scale) / 2;
  return { xy: raw.map(([x, y]) => [ox + (x - x0) * scale, oy + (y - y0) * scale] as [number, number]), metresPerUnit: 1 / scale };
}
const pathOf = (xy: [number, number][]) => xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");

/** The route with start and finish (owner only: shared routes have their ends removed) and a marker every kilometre. */
export function RouteMap({ route, showEnds, label }: { route: RoutePoint[]; showEnds: boolean; label: string }) {
  const size = 400;
  const { xy, metresPerUnit } = useMemo(() => project(route.map(p => [p[0], p[1]]), size, 28), [route]);
  const marks = useMemo(() => {
    const out: { x: number; y: number; k: number }[] = [];
    let next = 1000;
    route.forEach((p, i) => { if (p[4] !== null && p[4] >= next && xy[i]) { out.push({ x: xy[i][0], y: xy[i][1], k: next / 1000 }); next += 1000; } });
    return out.length > 25 ? out.filter(m => m.k % 5 === 0) : out;
  }, [route, xy]);
  const bar = useMemo(() => {
    const nice = [50, 100, 200, 500, 1000, 2000, 5000, 10000].find(m => m / metresPerUnit >= 60) ?? 10000;
    return { metres: nice, width: nice / metresPerUnit };
  }, [metresPerUnit]);
  if (xy.length < 2) return <div className="route-map route-map-empty"><p>No route to show. Shared routes hide the start and end, so a short one may be hidden entirely.</p></div>;
  const [start, end] = [xy[0], xy[xy.length - 1]];
  return <svg className="route-map" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
    <defs><pattern id="route-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" className="route-grid" /></pattern></defs>
    <rect width={size} height={size} fill="url(#route-grid)" />
    <path d={pathOf(xy)} className="route-casing" />
    <path d={pathOf(xy)} className="route-line" />
    {marks.map(m => <g key={m.k} className="route-km"><circle cx={m.x} cy={m.y} r="9" /><text x={m.x} y={m.y + 3.5} textAnchor="middle">{m.k}</text></g>)}
    {showEnds && <><circle cx={start[0]} cy={start[1]} r="8" className="route-start" /><circle cx={end[0]} cy={end[1]} r="8" className="route-end" /></>}
    <g className="route-scale" transform={`translate(${size - 20 - bar.width} ${size - 18})`}><path d={`M0 -5V0H${bar.width.toFixed(1)}V-5`} /><text x={bar.width / 2} y="-8" textAnchor="middle">{bar.metres >= 1000 ? `${bar.metres / 1000} km` : `${bar.metres} m`}</text></g>
  </svg>;
}

/** Height along the route, from the server's smoothed altitude. */
export function ElevationProfile({ route }: { route: RoutePoint[] }) {
  // Shared routes carry no distances (they could hint where the route starts), so the profile then runs by point order instead.
  const withHeight = route.filter(p => p[3] !== null), byDistance = withHeight.every(p => p[4] !== null);
  const points = withHeight.map((p, i) => [p[0], p[1], p[2], p[3], byDistance ? p[4] : i]) as [number, number, number, number, number][];
  if (points.length < 5) return null;
  const w = 600, h = 120, total = points[points.length - 1][4] || 1;
  const alts = points.map(p => p[3]), lo = Math.min(...alts), hi = Math.max(...alts), range = Math.max(hi - lo, 10);
  const xy = points.map(p => [(p[4] / total) * w, h - 12 - ((p[3] - lo) / range) * (h - 30)] as [number, number]);
  return <figure className="elevation">
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Elevation from ${Math.round(lo)} m to ${Math.round(hi)} m`} preserveAspectRatio="none">
      <path d={`${pathOf(xy)}L${w} ${h}L0 ${h}Z`} className="elevation-fill" /><path d={pathOf(xy)} className="elevation-line" />
    </svg>
    <figcaption><span>{Math.round(lo)} m</span><span>Elevation</span><span>{Math.round(hi)} m</span></figcaption>
  </figure>;
}

/** One bar per kilometre: longer is faster, and the fastest is marked. */
export function SplitBars({ splits, sport }: { splits: Split[]; sport: Sport }) {
  const timed = splits.filter(s => s.pace_s_per_km);
  if (!timed.length) return null;
  // A short last piece can't be the fastest kilometre: only splits of at least 500 m compete.
  const whole = timed.filter(s => s.distance_m >= 500), fastest = Math.min(...(whole.length ? whole : timed).map(s => s.pace_s_per_km!)), slowest = Math.max(...timed.map(s => s.pace_s_per_km!));
  return <table className="splits">
    <thead><tr><th scope="col">Km</th><th scope="col">{sport === "ride" ? "Speed" : "Pace"}</th><th scope="col"><span className="sr-only">Relative pace</span></th><th scope="col">Time</th></tr></thead>
    <tbody>{splits.map(s => {
      const p = s.pace_s_per_km, share = p ? 0.35 + 0.65 * (slowest === fastest ? 1 : (slowest - p) / (slowest - fastest)) : 0;
      return <tr key={s.km} data-fastest={(p === fastest && (s.distance_m >= 500 || !whole.length)) || undefined}>
        <td>{s.distance_m < 999 ? s.km.toFixed(2) : Math.round(s.km)}</td>
        <td>{p ? pace(sport, 1000, p) : "–"}</td>
        <td><span className="split-bar" style={{ width: `${Math.round(share * 100)}%` }} /></td>
        <td>{duration(s.moving_s)}</td>
      </tr>;
    })}</tbody>
  </table>;
}

/** A small outline for list cards. */
export function RouteThumb({ preview }: { preview: [number, number][] }) {
  const { xy } = useMemo(() => project(preview, 120, 10), [preview]);
  if (xy.length < 2) return <div className="route-thumb route-thumb-empty" aria-hidden="true" />;
  return <svg className="route-thumb" viewBox="0 0 120 120" aria-hidden="true"><path d={pathOf(xy)} /></svg>;
}
