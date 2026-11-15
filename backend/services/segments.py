"""Segments (Phase G): a named stretch of road or path, and timing every pass along it.

A route point is [lat, lon, seconds, altitude | None, distance_m] (services/activity_stats.py). Stored routes are simplified, so both
the route and the segment are filled in every few metres before matching. A pass counts when the route:
  * comes within REACH_M of the segment's start, and later within REACH_M of its end (so direction matters);
  * covers between 85% and 125% of the segment's length in between (no shortcuts, no long detours);
  * follows the line: at least 90% of the segment lies within FOLLOW_M of the route's path, and 90% of that path lies near the segment.
The time is interpolated at the points nearest the start and end, so it doesn't depend on where the phone happened to take a fix.
A route can pass a segment more than once (laps); each pass is its own effort.
"""
from __future__ import annotations

import math

from services.activity_stats import hide_near, metres

REACH_M = 25.0
FOLLOW_M = 30.0
STEP_M = 5.0
MIN_LENGTH_M = 200.0
MAX_LENGTH_M = 50000.0
KIND = {'walk': 'foot', 'run': 'foot', 'hike': 'foot', 'ride': 'ride'}


def dense(route, step=STEP_M):
    return hide_near(route, [], step=step) if len(route) > 1 else list(route)


def cut(route, start_m, end_m):
    """The stretch of a route between two distances along it, ends interpolated, as [[lat, lon], ...] every ~10 m."""
    pts = dense(route, 10.0)
    out = []

    def at(d):
        for a, b in zip(pts, pts[1:]):
            if a[4] <= d <= b[4]:
                f = 0.0 if b[4] == a[4] else (d - a[4]) / (b[4] - a[4])
                return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
        return None

    first, last = at(start_m), at(end_m)
    if first is None or last is None:
        return []
    out.append(first)
    out += [[p[0], p[1]] for p in pts if start_m < p[4] < end_m]
    out.append(last)
    return out


def length(points):
    return sum(metres(a, b) for a, b in zip(points, points[1:]))


def box(points):
    lats, lons = [p[0] for p in points], [p[1] for p in points]
    return min(lats), max(lats), min(lons), max(lons)


def touches(points, circles):
    """Whether any point of the stretch lies inside one of the circles [(lat, lon, radius_m)]."""
    return any(metres((p[0], p[1]), (lat, lon)) <= r for p in points for lat, lon, r in circles)


def _xy(lat0):
    k = math.cos(math.radians(lat0))
    return lambda p: (p[1] * 111320 * k, p[0] * 110540)


def _near_share(points, line, limit, lat0):
    """Share of `points` within `limit` metres of the polyline `line`."""
    if not points or len(line) < 2:
        return 0.0
    xy = _xy(lat0)
    segs = [(xy(a), xy(b)) for a, b in zip(line, line[1:])]
    hits = 0
    for p in points:
        px, py = xy(p)
        for (ax, ay), (bx, by) in segs:
            dx, dy = bx - ax, by - ay
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) if dx or dy else 0.0
            if math.hypot(px - ax - t * dx, py - ay - t * dy) <= limit:
                hits += 1
                break
    return hits / len(points)


def _closest(pts, i0, target):
    """From index i0, the run of points within REACH_M of target: (index of the closest one, index just past the run)."""
    best, best_d, j = i0, metres(pts[i0], target), i0
    while j < len(pts) and metres(pts[j], target) <= REACH_M:
        d = metres(pts[j], target)
        if d < best_d:
            best, best_d = j, d
        j += 1
    return best, j


def efforts(segment_points, segment_length, route):
    """Every pass along the segment in this route: [(start_seconds, elapsed_seconds), ...]."""
    if len(segment_points) < 2 or len(route) < 2:
        return []
    pts = dense(route)
    start, end, lat0 = segment_points[0], segment_points[-1], segment_points[0][0]
    sample = segment_points[::max(1, len(segment_points) // 60)]
    out, i = [], 0
    while i < len(pts):
        if metres(pts[i], start) > REACH_M:
            i += 1
            continue
        s, after = _closest(pts, i, start)
        j, found = after, None
        while j < len(pts):
            covered = pts[j][4] - pts[s][4]
            if covered > segment_length * 1.25:
                break
            if covered >= segment_length * 0.85 - REACH_M and metres(pts[j], end) <= REACH_M:
                e, _ = _closest(pts, j, end)
                covered = pts[e][4] - pts[s][4]
                path = pts[s:e + 1]
                if segment_length * 0.85 <= covered <= segment_length * 1.25 and \
                        _near_share(sample, path, FOLLOW_M, lat0) >= 0.9 and \
                        _near_share(path[::max(1, len(path) // 60)], segment_points, FOLLOW_M, lat0) >= 0.9:
                    found = e
                break
            j += 1
        if found is not None:
            out.append((pts[s][2], round(pts[found][2] - pts[s][2], 1)))
            i = found + 1
        else:
            i = after
    return out
