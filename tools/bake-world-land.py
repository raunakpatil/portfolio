# Bakes js/world-land.json (the coastline the dotted maps draw) from world-atlas land-50m.
# 1. curl -o land-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json
# 2. python -I tools/bake-world-land.py land-50m.json js/world-land.json 0.02
# (0.02 deg: the same dots as the full data, bar a few single shoreline dots — checked at desktop, tablet and phone sizes)
"""Bake world-atlas land-50m into a small, same-origin coastline file for the dotted maps.

Output: {"q": 100, "r": [[x0, y0, dx1, dy1, ...], ...]} — each ring's points in 1/q degrees, first point absolute,
then deltas; longitudes already unwrapped across the antimeridian (as main.js did on load).
usage: python -I land_bake.py <land-50m.json> <out.json> <tolerance-deg> [min-area-deg2]
"""
import json, sys

src, out, tol = sys.argv[1], sys.argv[2], float(sys.argv[3])
min_area = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
topo = json.load(open(src))
sx, sy = topo['transform']['scale']
tx, ty = topo['transform']['translate']

arcs = []
for arc in topo['arcs']:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)


def arc_pts(i):
    return arcs[i] if i >= 0 else arcs[~i][::-1]


def ring_pts(ring):
    pts = []
    for k, i in enumerate(ring):
        a = arc_pts(i)
        pts.extend(a if k == 0 else a[1:])
    return pts


def dp(pts, eps):
    """Douglas-Peucker on an open polyline."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1; L2 = dx * dx + dy * dy
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0:
                d = (px - x1) ** 2 + (py - y1) ** 2
            else:
                t = ((px - x1) * dx + (py - y1) * dy) / L2
                t = max(0, min(1, t))
                d = (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2
            if d > best:
                best, bi = d, i
        if best > eps * eps:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]


def area(pts):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2


Q = 100
rings_out = []
geoms = topo['objects']['land']['geometries']
n_in = n_out = 0
for g in geoms:
    polys = [g['arcs']] if g['type'] == 'Polygon' else g['arcs'] if g['type'] == 'MultiPolygon' else []
    for poly in polys:
        for ring in poly:
            pts = ring_pts(ring)
            # unwrap longitudes so rings crossing the antimeridian stay continuous (as main.js did)
            prev, shift, un = pts[0][0], 0, []
            for lon, lat in pts:
                if lon - prev > 180: shift -= 360
                elif prev - lon > 180: shift += 360
                prev = lon
                un.append((lon + shift, lat))
            n_in += len(un)
            if min_area and area(un) < min_area:
                continue
            # split the closed ring in two halves so DP keeps its shape
            h = len(un) // 2
            s = dp(un[:h + 1], tol)[:-1] + dp(un[h:], tol) if tol > 0 else un
            q = [(round(x * Q), round(y * Q)) for x, y in s]
            # drop repeats after rounding
            dd = [q[0]] + [p for i, p in enumerate(q[1:], 1) if p != q[i - 1]]
            if len(dd) < 3:
                continue
            flat = [dd[0][0], dd[0][1]]
            for (x0, y0), (x1, y1) in zip(dd, dd[1:]):
                flat += [x1 - x0, y1 - y0]
            rings_out.append(flat)
            n_out += len(dd)

json.dump({'q': Q, 'r': rings_out}, open(out, 'w'), separators=(',', ':'))
import gzip, os
raw = open(out, 'rb').read()
print('points', n_in, '->', n_out, 'rings', len(rings_out), 'bytes', len(raw), 'gzip', len(gzip.compress(raw, 9)))
