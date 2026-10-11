#!/usr/bin/env python3
"""
Builds the three Intus logo options as SVG, with the ASCII texture drawn from real JetBrains Mono outlines so the
files need no fonts and stay sharp at any size.

    npm i --no-save @fontsource/jetbrains-mono
    pip install fonttools
    python3 scripts/brand_logos.py --fonts node_modules/@fontsource/jetbrains-mono/files --out docs/brand/logos

Colours are the brand frame in Miro (Health OS: UI/UX revamp, "04 Visual language"): red #A31621, paper #E5ECE9,
ink #1F1300. Every mark is a single path in a single colour, so it recolours with one attribute.

  A  Column       the letter I as a Doric column, shaded left to right with the character ramp of the statue bust
  B  Section cut  a slash, solid at its head and dissolving into halftone dots
  C  Physique     the statue's torso as six blocks in a V-taper, the channel between the halves the letter I
"""
import argparse
import math
import os

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

RED, PAPER, INK = '#A31621', '#E5ECE9', '#1F1300'
RAMP = ['.', ':', '-', '=', '+', '%', '@', 'M']          # lightest to heaviest, as in scripts/ascii_art.py
BAYER = [[0.0, 0.5], [0.75, 0.25]]

fonts = {}


def n(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def glyph(font, ch, x, base, size):
    """One character's outline, its left edge at x and its baseline at base, as SVG path data."""
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs, ntos=n)
    s = size / font['head'].unitsPerEm
    gs[font.getBestCmap()[ord(ch)]].draw(TransformPen(pen, (s, 0, 0, -s, x, base)))
    return pen.getCommands()


def cell_glyph(ch, x, y, cw, rh):
    """A character centred in the cell whose top-left corner is (x, y), sized so the cell is cw wide."""
    size = cw / 0.6
    return glyph(fonts['bold'], ch, x, y + rh / 2 + size * 0.73 / 2, size)


def rect(x, y, w, h):
    return f'M{n(x)} {n(y)}h{n(w)}v{n(h)}h{n(-w)}z'


def circle(cx, cy, r):
    """Clockwise, to match poly(), so overlaps stay filled under the nonzero rule."""
    return f'M{n(cx - r)} {n(cy)}a{n(r)} {n(r)} 0 1 1 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 1 {n(-2 * r)} 0z'


def poly(pts):
    return 'M' + 'L'.join(f'{n(x)} {n(y)}' for x, y in pts) + 'z'


def rounded_poly(pts, r):
    """A polygon with each corner rounded by up to r (one number, or one per corner)."""
    k = len(pts)
    rs = r if isinstance(r, (list, tuple)) else [r] * k
    out = []
    for i in range(k):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % k]
        d1, d2 = math.dist(p0, p1), math.dist(p1, p2)
        rr = min(rs[i], d1 / 2, d2 / 2)
        a = (p1[0] + (p0[0] - p1[0]) / d1 * rr, p1[1] + (p0[1] - p1[1]) / d1 * rr)
        b = (p1[0] + (p2[0] - p1[0]) / d2 * rr, p1[1] + (p2[1] - p1[1]) / d2 * rr)
        out.append(('M' if i == 0 else 'L') + f'{n(a[0])} {n(a[1])}Q{n(p1[0])} {n(p1[1])} {n(b[0])} {n(b[1])}')
    return ''.join(out) + 'z'


def inside(pt, pts, margin):
    """Whether pt is inside the convex clockwise polygon pts and at least margin from every edge."""
    for i in range(len(pts)):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
        ex, ey = x2 - x1, y2 - y1
        if -((pt[0] - x1) * ey - (pt[1] - y1) * ex) / math.hypot(ex, ey) < margin:
            return False
    return True


# ------------------------------------------------------------------------------------------------ A: column

def mark_a():
    cw, rh, cols, rows = 8, 11, 10, 11
    cx = 128
    # tone per column in ramp steps (9 or more is solid): a rim, falling into a lit band, then back into shadow
    tone = [9, 4.6, 2.4, 0.8, 0.2, 1.2, 3.0, 5.2, 7.2, 9]
    x0 = cx - cols * cw / 2
    cap_w, cap_h, ech_w, ech_h, neck = 120, 13, 98, 8, 3
    top = 36
    shaft_top = top + cap_h + ech_h + neck
    shaft_h = rows * rh
    parts = [poly([(cx - cap_w / 2, top), (cx + cap_w / 2, top), (cx + cap_w / 2, top + cap_h), (cx + ech_w / 2, top + cap_h),
                   (cx + ech_w / 2, top + cap_h + ech_h), (cx - ech_w / 2, top + cap_h + ech_h), (cx - ech_w / 2, top + cap_h),
                   (cx - cap_w / 2, top + cap_h)])]
    for c in range(cols):
        if tone[c] >= 9:
            parts.append(rect(x0 + c * cw, shaft_top, cw, shaft_h))   # one tall bar, so no seams between cells
            continue
        for r in range(rows):
            level = int(tone[c] + BAYER[r % 2][c % 2])
            parts.append(cell_glyph(RAMP[level], x0 + c * cw, shaft_top + r * rh, cw, rh))
    base_top = shaft_top + shaft_h + neck
    parts.append(poly([(cx - ech_w / 2, base_top), (cx + ech_w / 2, base_top), (cx + ech_w / 2, base_top + ech_h),
                       (cx + cap_w / 2, base_top + ech_h), (cx + cap_w / 2, base_top + ech_h + cap_h),
                       (cx - cap_w / 2, base_top + ech_h + cap_h), (cx - cap_w / 2, base_top + ech_h),
                       (cx - ech_w / 2, base_top + ech_h)]))
    return dict(d=''.join(parts), rule='evenodd', bbox=(cx - cap_w / 2, top, cx + cap_w / 2, base_top + ech_h + cap_h),
                name='column', label='Column')


# ------------------------------------------------------------------------------------------------ B: section cut

def mark_b():
    top, bottom, shift, w, cx = 28, 228, 70, 60, 128
    centre = lambda y: cx + shift / 2 - shift * (y - top) / (bottom - top)
    solid_end = 96
    parts = [poly([(centre(top) - w / 2, top), (centre(top) + w / 2, top),
                   (centre(solid_end) + w / 2, solid_end), (centre(solid_end) - w / 2, solid_end)])]
    pitch, across = 12, 5
    y = solid_end + 1
    while y < bottom - 1:
        f = max(0.0, 1 - (y - solid_end) / (bottom - solid_end + 6))
        r = 6.5 * f ** 1.45          # the first row is wide enough to merge into the solid, then it shrinks to specks
        if r >= 0.85:
            for i in range(across):
                parts.append(circle(centre(y) + (i - (across - 1) / 2) * pitch, y, r))
        y += pitch
    return dict(d=''.join(parts), rule='nonzero', bbox=(cx - 64, top, cx + 64, bottom), name='slash', label='Section cut')


# ------------------------------------------------------------------------------------------------ C: physique

def mark_c():
    cx, gap_c, gap_r, y0 = 128, 7, 7, 34
    row_hs = [50, 56, 58]                                   # the upper blocks are the smallest
    hw_top, hw_bot = 90, 90 - 34 * 1.35
    y_end = y0 + sum(row_hs) + 2 * gap_r
    hw = lambda y: hw_top + (hw_bot - hw_top) * (y - y0) / (y_end - y0)
    cw, rh = 7, 9
    parts = []
    ya = y0
    for row_h in row_hs:
        yb = ya + row_h
        for side in (-1, 1):
            if side < 0:
                pts = [(cx - hw(ya), ya), (cx - gap_c, ya), (cx - gap_c, yb), (cx - hw(yb), yb)]
            else:
                pts = [(cx + gap_c, ya), (cx + hw(ya), ya), (cx + hw(yb), yb), (cx + gap_c, yb)]
            parts.append(rounded_poly(pts, [11, 5, 5, 11] if side < 0 else [5, 11, 11, 5]))
            # characters knocked out of the block: heavy where the light lands (outer top), none in the shadow
            gy = ya + 4
            while gy + rh < yb - 3:
                gx = min(p[0] for p in pts)
                while gx < max(p[0] for p in pts):
                    px, py = gx + cw / 2, gy + rh / 2
                    gx0, gx = gx, gx + cw
                    # all four corners of the cell must clear the edge, so no hole ever breaks the outline
                    if not all(inside((gx0 + dx, gy + dy), pts, 4.5) for dx in (0, cw) for dy in (0, rh)):
                        continue
                    u = abs(px - (cx + side * gap_c)) / hw(py)      # 0 at the channel, 1 at the outer edge
                    v = (py - ya) / row_h                           # 0 at the top, 1 at the bottom
                    k = 1 - (0.62 * v + 0.38 * (1 - u)) * 1.45
                    if k >= 0.1:
                        parts.append(cell_glyph(RAMP[min(7, int(k * 8))], gx0, gy, cw, rh))
                gy += rh
        ya = yb + gap_r
    return dict(d=''.join(parts), rule='evenodd', bbox=(cx - hw_top, y0, cx + hw_top, y_end), name='physique', label='Physique')


MARKS = {'a': mark_a, 'b': mark_b, 'c': mark_c}


# ------------------------------------------------------------------------------------------------ output

def svg(w, h, body, title, bg=None):
    bg_rect = f'<rect width="256" height="256" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(w)} {n(h)}" width="{n(w)}" height="{n(h)}" role="img" '
            f'aria-label="{title}"><title>{title}</title>{bg_rect}{body}</svg>\n')


def path(m, fill):
    return f'<path fill="{fill}" fill-rule="{m["rule"]}" d="{m["d"]}"/>'


def wordmark(x, baseline, size, fill):
    """INTUS in JetBrains Mono Medium, tracked 0.12em like the in-app wordmark. Returns (path, width)."""
    adv = size * 0.72
    d = ''.join(glyph(fonts['medium'], ch, x + i * adv, baseline, size) for i, ch in enumerate('INTUS'))
    return f'<path fill="{fill}" d="{d}"/>', 5 * adv - size * 0.12


def lockup(m, mark_fill, text_fill, title, size=84, gap=44, pad=16):
    x0, y0, x1, y1 = m['bbox']
    mw, mh = x1 - x0, y1 - y0
    word, ww = wordmark(pad + mw + gap, pad + mh / 2 + size * 0.73 / 2, size, text_fill)
    body = f'<g transform="translate({n(pad - x0)} {n(pad - y0)})">{path(m, mark_fill)}</g>{word}'
    return svg(pad * 2 + mw + gap + ww, pad * 2 + mh, body, title)


def icon(m, tile, fill, title, scale=0.9):
    """A full-bleed square: iOS and Android apply their own corner mask."""
    x0, y0, x1, y1 = m['bbox']
    body = f'<g transform="translate(128 128) scale({scale}) translate({n(-(x0 + x1) / 2)} {n(-(y0 + y1) / 2)})">{path(m, fill)}</g>'
    return svg(256, 256, body, title, bg=tile)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fonts', required=True, help='folder holding the @fontsource/jetbrains-mono woff files')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    fonts['bold'] = TTFont(os.path.join(a.fonts, 'jetbrains-mono-latin-700-normal.woff'))
    fonts['medium'] = TTFont(os.path.join(a.fonts, 'jetbrains-mono-latin-500-normal.woff'))
    os.makedirs(a.out, exist_ok=True)
    for key, fn in MARKS.items():
        m = fn()
        t = f'Intus logo {key.upper()}, {m["label"].lower()}'
        name = f'intus-{key}-{m["name"]}'
        files = {
            f'{name}.svg': svg(256, 256, path(m, RED), t),
            f'{name}-ink.svg': svg(256, 256, path(m, INK), t + ', ink'),
            f'{name}-paper.svg': svg(256, 256, path(m, PAPER), t + ', paper'),
            f'{name}-lockup.svg': lockup(m, RED, INK, t + ' with wordmark'),
            f'{name}-lockup-reversed.svg': lockup(m, PAPER, PAPER, t + ' with wordmark, reversed'),
            f'{name}-icon.svg': icon(m, RED, PAPER, t + ', app icon'),
        }
        for fname, body in files.items():
            with open(os.path.join(a.out, fname), 'w') as f:
                f.write(body)
        print(f'{name}: {len(m["d"]) // 1024} KB of path')


if __name__ == '__main__':
    main()
