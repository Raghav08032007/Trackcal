"""GPS activity maths, done on the server from the raw fixes so every number is computed the same way, whatever phone recorded it.

A fix is [lat, lon, t_ms, accuracy_m, altitude_m | None]. Phones report noisy positions: standing still they wander a few metres, and
now and then one fix jumps hundreds of metres. Counting that wander as distance is the usual reason GPS apps over-read, so:
  * fixes worse than MAX_ACCURACY_M are dropped, and so are jumps faster than the sport allows;
  * distance only grows once you have moved clearly away from the last counted point (an anchor), so wobble in place adds nothing;
  * moving time counts only stretches faster than a slow walk (auto-pause);
  * altitude is median-smoothed and climbs count only past a 3 m hysteresis, because GPS altitude is the noisiest part.
Splits and best efforts interpolate between fixes, so a kilometre ends exactly at 1000 m, not at whichever fix came after it.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

SPORTS = {
    # sport: (fastest believable speed m/s, slowest speed that still counts as moving m/s, title)
    'walk': (4.0, 0.4, 'Walk'),
    'run': (10.5, 0.8, 'Run'),
    'hike': (4.0, 0.3, 'Hike'),
    'ride': (25.0, 1.2, 'Ride'),
}
MAX_ACCURACY_M = 35.0
MAX_FIXES = 20000
MOVING_SIGMA = 1.5         # how many noise widths a shift must exceed to count as moving
MAX_GAP_S = 60.0           # longer than this between fixes is a pause, not movement
CLIMB_HYSTERESIS_M = 4.0
STEP_M = 1.0              # smoothed positions closer than this to the last counted one add nothing yet
BEST_EFFORTS = [(400, '400 m'), (1000, '1 km'), (1609.344, '1 mile'), (5000, '5 km'), (10000, '10 km'), (21097.5, 'Half marathon'), (42195, 'Marathon')]
EARTH_M = 6371008.8


def metres(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * EARTH_M * math.asin(min(1.0, math.sqrt(h)))


@dataclass
class Point:
    lat: float
    lon: float
    t: float      # seconds from the first fix
    acc: float
    alt: float | None
    d: float = 0  # counted distance so far, metres
    moving: bool = False
    noise: float = 0.0  # how far off the smoothed position may still be, metres


def clean(raw, sport):
    """Valid, time-ordered fixes with impossible jumps removed."""
    fastest = SPORTS[sport][0]
    rows = []
    for f in raw[:MAX_FIXES]:
        if not isinstance(f, (list, tuple)) or len(f) < 4:
            continue
        lat, lon, t, acc = f[0], f[1], f[2], f[3]
        alt = f[4] if len(f) > 4 else None
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lat, lon, t, acc)):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or acc < 0 or acc > MAX_ACCURACY_M:
            continue
        if not (isinstance(alt, (int, float)) and math.isfinite(alt) and -500 < alt < 9000):
            alt = None
        rows.append((float(t), float(lat), float(lon), float(acc), alt))
    rows.sort()
    start = rows[0][0] if rows else 0
    points: list[Point] = []
    for t, lat, lon, acc, alt in rows:
        p = Point(lat, lon, (t - start) / 1000, acc, alt)
        if points and p.t <= points[-1].t:
            continue
        points.append(p)
    # A glitch is a fix far from where its neighbours put you. Judged against the median of the fixes within 10 s either side, not
    # the last kept fix: chaining from the last kept one keeps only fixes that agree with it, which makes the track creep.
    kept = []
    n, a, b = len(points), 0, 0
    for k, p in enumerate(points):
        while points[a].t < p.t - 10:
            a += 1
        while b + 1 < n and points[b + 1].t <= p.t + 10:
            b += 1
        near = [points[i] for i in range(a, b + 1) if i != k]
        if len(near) >= 2:
            lat = sorted(q.lat for q in near)[len(near) // 2]
            lon = sorted(q.lon for q in near)[len(near) // 2]
            if metres((lat, lon), (p.lat, p.lon)) > fastest * 5 + 3 * max(p.acc, 10):
                continue
        kept.append(p)
    return kept


# How quickly speed and direction can change, per sport (acceleration noise, m^2/s^3). Higher trusts each fix more.
AGILITY = {'walk': 0.3, 'hike': 0.3, 'run': 1.2, 'ride': 3.6}  # tuned on tests/test_activity_stats.py


def _kalman_axis(ts, zs, rs, q):
    """Constant-velocity Kalman filter forward, then the Rauch–Tung–Striebel pass backward: the best estimate of each position given
    every fix, before and after it. Each fix counts according to its own reported accuracy (variance rs)."""
    n = len(zs)
    xs, ps, xp, pp, fs = [None] * n, [None] * n, [None] * n, [None] * n, [None] * n
    x, p = (zs[0], 0.0), (rs[0], 0.0, 0.0, 25.0)  # position, velocity; covariance as (pxx, pxv, pvx, pvv)
    for k in range(n):
        if k:
            dt = ts[k] - ts[k - 1]
            x = (x[0] + dt * x[1], x[1])
            a, b, c, d = p
            a, b, c, d = a + dt * (b + c) + dt * dt * d, b + dt * d, c + dt * d, d
            a += q * dt ** 3 / 3
            b += q * dt ** 2 / 2
            c += q * dt ** 2 / 2
            d += q * dt
            p = (a, b, c, d)
            fs[k] = dt
        xp[k], pp[k] = x, p
        a, b, c, d = p
        s = a + rs[k]
        k0, k1 = a / s, c / s
        y = zs[k] - x[0]
        x = (x[0] + k0 * y, x[1] + k1 * y)
        p = ((1 - k0) * a, (1 - k0) * b, c - k1 * a, d - k1 * b)
        xs[k], ps[k] = x, p
    out = [0.0] * n
    sx, sp = xs[-1], ps[-1]
    out[-1] = sx[0]
    for k in range(n - 2, -1, -1):
        dt = fs[k + 1]
        a, b, c, d = ps[k]
        # C = P_k F^T (P_pred_{k+1})^-1
        pa, pb, pc, pd = pp[k + 1]
        det = pa * pd - pb * pc or 1e-12
        inv = (pd / det, -pb / det, -pc / det, pa / det)
        pf = (a + dt * b, b, c + dt * d, d)  # P_k F^T
        c00 = pf[0] * inv[0] + pf[1] * inv[2]
        c01 = pf[0] * inv[1] + pf[1] * inv[3]
        c10 = pf[2] * inv[0] + pf[3] * inv[2]
        c11 = pf[2] * inv[1] + pf[3] * inv[3]
        dx = (sx[0] - xp[k + 1][0], sx[1] - xp[k + 1][1])
        sx = (xs[k][0] + c00 * dx[0] + c01 * dx[1], xs[k][1] + c10 * dx[0] + c11 * dx[1])
        out[k] = sx[0]
        # Smoothed covariance of the position, for the step size used when counting distance.
        sp = ps[k]
    return out


def smooth(points, sport='walk', noise=0.0):
    """Kalman-smooth the positions (see _kalman_axis), and median-then-average the altitude, which is several times noisier."""
    n = len(points)
    if n < 3:
        return
    lat0, lon0 = points[0].lat, points[0].lon
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    ts = [p.t for p in points]
    rs = [max(p.acc, noise, 3) ** 2 for p in points]  # a phone can't claim better than it measurably is
    q = AGILITY[sport]
    east = _kalman_axis(ts, [(p.lon - lon0) * kx for p in points], rs, q)
    north = _kalman_axis(ts, [(p.lat - lat0) * ky for p in points], rs, q)
    for p, e, nn in zip(points, east, north):
        p.lon, p.lat = lon0 + e / kx, lat0 + nn / ky
        p.noise = 0.0
    alts = [(p.t, p.alt) for p in points if p.alt is not None]
    if len(alts) >= 5:
        values = [v for _, v in alts]
        median = [sorted(values[max(0, i - 3):i + 4])[len(values[max(0, i - 3):i + 4]) // 2] for i in range(len(values))]
        smoothed = []
        a = b = 0
        for t, _ in alts:
            while alts[a][0] < t - 15:
                a += 1
            while b + 1 < len(alts) and alts[b + 1][0] <= t + 15:
                b += 1
            smoothed.append(sum(median[a:b + 1]) / (b + 1 - a))
        it = iter(smoothed)
        for p in points:
            if p.alt is not None:
                p.alt = next(it)


def mark_moving(points, raw_xy, sport, noise):
    """Moving or stopped, decided from the raw fixes: where they cluster in the 15 s before a point against the 15 s after it.
    It counts as moving only if that shift is clearly bigger than the phone's measured noise (so a phone that under-reports its
    error can't fake movement) and at least a slow walking pace."""
    slowest = SPORTS[sport][1] * 0.75
    n = len(points)

    def cluster(a, b):
        w = [1 / max(points[i].acc, 3) ** 2 for i in range(a, b)]
        total = sum(w)
        mx = sum(raw_xy[i][0] * wi for i, wi in zip(range(a, b), w)) / total
        my = sum(raw_xy[i][1] * wi for i, wi in zip(range(a, b), w)) / total
        mt = sum(points[i].t for i in range(a, b)) / (b - a)
        error = max(noise ** 2, 1 / total) / (b - a)  # variance of the cluster's centre, per axis
        return mx, my, mt, error

    a = b = 0
    for k, p in enumerate(points):
        while points[a].t < p.t - 15:
            a += 1
        while b + 1 < n and points[b + 1].t <= p.t + 15:
            b += 1
        if k - a < 1 or b - k < 1:
            p.moving = False
            continue
        x1, y1, t1, e1 = cluster(a, k + 1)
        x2, y2, t2, e2 = cluster(k, b + 1)
        shift = math.hypot(x2 - x1, y2 - y1)
        p.moving = t2 > t1 and shift > MOVING_SIGMA * math.sqrt(2 * (e1 + e2)) and shift / (t2 - t1) >= slowest
    # Real movement lasts: a moving stretch under 10 s is noise passing the test by chance, and a stop under 5 s inside movement is
    # noise the other way. Stops are filled first, so a steady but noisy walk isn't broken into short pieces.
    _runs(points, False, 5.0)
    _runs(points, True, 10.0)
    # The very ends have only one side to judge from: they follow their neighbour.
    for k in range(n):
        if (k == 0 or points[k].t - points[0].t < 15) and n > 1:
            points[k].moving = next((q.moving for q in points[k:] if q.t - points[0].t >= 15), points[k].moving)
        if points[-1].t - points[k].t < 15:
            points[k].moving = next((q.moving for q in reversed(points[:k + 1]) if points[-1].t - q.t >= 15), points[k].moving)


def measured_noise(points, raw_xy):
    """How far this phone's fixes really scatter, per axis, from second differences of the raw fixes: steady movement cancels out,
    scatter doesn't (each one carries 6x the variance of a single fix). Robust to the odd outlier, never below 1 m."""
    vals = []
    for k in range(1, len(points) - 1):
        d1, d2 = points[k].t - points[k - 1].t, points[k + 1].t - points[k].t
        if not (0 < d1 <= 5 and 0 < d2 <= 5) or max(d1, d2) > 2 * min(d1, d2):
            continue
        for j in (0, 1):
            vals.append(abs(raw_xy[k + 1][j] - 2 * raw_xy[k][j] + raw_xy[k - 1][j]))
    if len(vals) < 10:
        return max(3.0, sorted(p.acc for p in points)[len(points) // 2] if points else 3.0)
    vals.sort()
    return max(1.0, 1.4826 * vals[len(vals) // 2] / math.sqrt(6))


def _runs(points, value, shortest):
    """Flip every run of points marked `value` that lasts less than `shortest` seconds."""
    k, n = 0, len(points)
    while k < n:
        if points[k].moving != value:
            k += 1
            continue
        j = k
        while j + 1 < n and points[j + 1].moving == value:
            j += 1
        start = points[k - 1].t if k > 0 else points[k].t
        end = points[j + 1].t if j + 1 < n else points[j].t
        inside = 0 < k and j + 1 < n  # a stop at the very start or end is a real stop
        if end - start < shortest and (value or inside):
            for i in range(k, j + 1):
                points[i].moving = not value
        k = j + 1


def count_distance(points, sport):
    """Distance grows only while moving (see mark_moving), once the smoothed position is clearly away from the last counted one."""
    if not points:
        return
    anchor, total = points[0], 0.0
    for p in points[1:]:
        if not p.moving:
            anchor = p
        else:
            step = metres((anchor.lat, anchor.lon), (p.lat, p.lon))
            if step >= STEP_M:
                total += step
                anchor = p
        p.d = total


def moving_seconds(points, sport):
    """Auto-pause: time counts between two moving points with no long gap between them."""
    moving, flags = 0.0, [False]
    for a, b in zip(points, points[1:]):
        on = a.moving and b.moving and 0 < b.t - a.t <= MAX_GAP_S
        flags.append(on)
        if on:
            moving += b.t - a.t
    return moving, flags


def climb(points):
    """Climb from the smoothed altitude, counted only once it has changed by more than the hysteresis."""
    alts = [p.alt for p in points if p.alt is not None]
    if len(alts) < 5:
        return 0.0, 0.0
    gain = loss = 0.0
    ref = alts[0]
    for a in alts[1:]:
        if a - ref >= CLIMB_HYSTERESIS_M:
            gain += a - ref
            ref = a
        elif ref - a >= CLIMB_HYSTERESIS_M:
            loss += ref - a
            ref = a
    return round(gain, 1), round(loss, 1)


def time_at(points, distance):
    """Elapsed seconds when the counted distance first reached `distance`, interpolated between fixes."""
    for a, b in zip(points, points[1:]):
        if b.d >= distance:
            if b.d == a.d:
                return b.t
            return a.t + (b.t - a.t) * (distance - a.d) / (b.d - a.d)
    return None


def splits(points, flags):
    """One row per whole kilometre, plus the part-kilometre at the end, with moving time for each."""
    if len(points) < 2:
        return []
    out = []
    total = points[-1].d
    edges = [k * 1000.0 for k in range(1, int(total // 1000) + 1)]
    if total - (edges[-1] if edges else 0) >= 50:
        edges.append(total)
    start_d, start_t = 0.0, 0.0
    for edge in edges:
        end_t = time_at(points, edge) if edge < total else points[-1].t
        moving = 0.0
        for (a, b), on in zip(zip(points, points[1:]), flags[1:]):
            if not on:
                continue
            if b.d == a.d:
                share = 1.0 if start_d <= a.d < edge or (edge == total and a.d == edge) else 0.0
            elif b.d <= start_d or a.d >= edge:
                continue
            else:
                share = (min(b.d, edge) - max(a.d, start_d)) / (b.d - a.d)
            moving += (b.t - a.t) * share
        km = (edge - start_d) / 1000
        out.append({'km': round(edge / 1000, 2), 'distance_m': round(edge - start_d, 1), 'elapsed_s': round(end_t - start_t, 1),
                    'moving_s': round(moving, 1), 'pace_s_per_km': round(moving / km, 1) if km > 0 and moving > 0 else None})
        start_d, start_t = edge, end_t
    return out


def best_efforts(points):
    """Fastest time over each standard distance inside this activity, from any starting point."""
    if len(points) < 2:
        return []
    total = points[-1].d
    out = []
    for distance, label in BEST_EFFORTS:
        if distance > total:
            break
        best = None
        i = 0
        for j in range(1, len(points)):
            end = points[j]
            if end.d < distance:
                continue
            start_d = end.d - distance
            while i + 1 < j and points[i + 1].d <= start_d:
                i += 1
            a, b = points[i], points[i + 1]
            start_t = a.t if b.d == a.d else a.t + (b.t - a.t) * (start_d - a.d) / (b.d - a.d)
            seconds = end.t - start_t
            if best is None or seconds < best:
                best = seconds
        if best is not None:
            out.append({'distance_m': distance, 'label': label, 'seconds': round(best, 1)})
    return out


def max_speed(points, sport):
    """Fastest 10-second stretch, so one lucky fix can't set it."""
    best = 0.0
    i = 0
    for j in range(1, len(points)):
        while points[j].t - points[i].t > 10 and i < j - 1:
            i += 1
        span = points[j].t - points[i].t
        if span >= 5:
            best = max(best, (points[j].d - points[i].d) / span)
    return round(min(best, SPORTS[sport][0]), 2)


def simplify(points, tolerance=2.5):
    """Douglas–Peucker on a local flat projection: far fewer points, same shape within a couple of metres."""
    if len(points) < 3:
        return points
    lat0 = math.radians(points[0].lat)
    xy = [((p.lon) * 111320 * math.cos(lat0), p.lat * 110540) for p in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = xy[a], xy[b]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1e-9
        far, at = 0.0, None
        for k in range(a + 1, b):
            px, py = xy[k]
            dist = abs(dy * (px - ax) - dx * (py - ay)) / length
            if dist > far:
                far, at = dist, k
        if at is not None and far > tolerance:
            keep[at] = True
            stack += [(a, at), (at, b)]
    return [p for p, k in zip(points, keep) if k]


def analyse(raw, sport):
    """Everything the activity page shows, from the raw fixes."""
    if sport not in SPORTS:
        raise ValueError('unknown sport')
    points = clean(raw, sport)
    noise = 3.0
    if points:
        kx, ky = 111320 * math.cos(math.radians(points[0].lat)), 110540
        raw_xy = [((p.lon - points[0].lon) * kx, (p.lat - points[0].lat) * ky) for p in points]
        noise = measured_noise(points, raw_xy)
    smooth(points, sport, noise)
    if points:
        mark_moving(points, raw_xy, sport, noise)
    count_distance(points, sport)
    moving, flags = moving_seconds(points, sport)
    gain, loss = climb(points)
    distance = points[-1].d if points else 0.0
    elapsed = points[-1].t if points else 0.0
    route = simplify(points)
    return {
        'distance_m': round(distance, 1),
        'elapsed_s': round(elapsed, 1),
        'moving_s': round(moving, 1),
        'elevation_gain_m': gain,
        'elevation_loss_m': loss,
        'avg_speed_ms': round(distance / moving, 2) if moving > 0 else 0.0,
        'max_speed_ms': max_speed(points, sport),
        'splits': splits(points, flags),
        'best_efforts': best_efforts(points),
        'fixes_used': len(points),
        'fixes_dropped': max(0, min(len(raw), MAX_FIXES) - len(points)),
        'route': [[round(p.lat, 6), round(p.lon, 6), round(p.t, 1), None if p.alt is None else round(p.alt, 1), round(p.d, 1)] for p in route],
    }


def hide_near(route, centres, step=10.0):
    """The route without anything inside the given circles [(lat, lon, radius_m)]: for privacy zones and the start and end of a shared
    route. Long straight stretches are filled in every `step` metres first, so the line is cut at the circle's edge, not at the next turn."""
    dense = []
    for a, b in zip(route, route[1:]):
        dense.append(a)
        gap = metres(a, b)
        for k in range(1, int(gap // step)):
            f = k * step / gap
            dense.append([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f,
                          None if a[3] is None or b[3] is None else a[3] + (b[3] - a[3]) * f, a[4] + (b[4] - a[4]) * f])
    if route:
        dense.append(route[-1])
    return [p for p in dense if all(metres((p[0], p[1]), (lat, lon)) > r for lat, lon, r in centres)]
