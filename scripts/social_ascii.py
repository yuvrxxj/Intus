#!/usr/bin/env python3
"""
Draws the wordless pre-launch pictures for Instagram and X: one object per picture, in ASCII, on a flat ground of
the brand's red, paper or ink. No text, no people, no numbers. Nothing here posts anywhere.

    pip install pillow numpy
    python3 scripts/social_ascii.py --font path/to/JetBrainsMono-Bold.ttf --out social-out/prelaunch
    python3 scripts/social_ascii.py --font ... --out /tmp/try --only moon --width 1080   (a quick draft)

Every picture is 3840 x 4800 by default (4K wide, 4:5, Instagram's tallest feed ratio) with its subject inside the
middle square, so the 1:1 crop for X (written to OUT/x, 3840 x 3840) keeps all of it. Everything is drawn at the final
size, not scaled up, so the characters and the solid edges are sharp at 4K. OUT/grid.png shows the nine side by side as
the profile grid.

How a picture is made, the same way as the app's own ASCII art (scripts/ascii_scene.py, scripts/ascii_art.py):
  1. a field of how much ink each spot of the picture holds. On paper that is shadow, on red and ink it is light, so
     a lit object always reads as lit
  2. each 0.6em-wide character cell averages the field and picks a glyph from RAMP, lightest to heaviest. RAMP was
     measured in JetBrains Mono Bold, so equal steps of tone are equal steps of ink
  3. the densest cells are not drawn as characters. A solid layer traced at 6x the character grid fills them, so the
     solid edges are smooth and the half-tones step down into characters, like the statue bust on the site
Objects: the hourglass and the blood tubes come from the engravings in docs/art/scenes-source.webp, the rest are
shaded in code (a capsule, a tube, a sphere, a ring), the mark is docs/brand/app-icons/intus-mark-red-2048.png, and
the dot-grid picture is the site's dot grid with a lit trail, as the cursor leaves on the homepage.

Colours are the brand's five: red #A31621, paper #E5ECE9, ink #1F1300, dot #A3988F (and red-ink #8C121C). Green stays
out, the brand keeps it for on-track states.
"""
import argparse
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

PAPER, INK, RED, RED_INK, DOT = (229, 236, 233), (31, 19, 0), (163, 22, 33), (140, 18, 28), (163, 152, 143)

COLS, ROWS, SUB = 108, 81, 6  # character cells 0.6 as wide as tall, and the solid layer's grid
GW, GH = 1080, 1350          # fields are drawn at this size and sampled up to the picture
W = H = CW = CH = K = 0      # the picture's size, set by set_size(); K is its scale against a 2160 wide picture


def set_size(width):
    global W, H, CW, CH, K
    W, H = width, round(width * 5 / 4)
    CW, CH = W / COLS, H / ROWS
    K = W / 2160
RAMP = " `.'-:_;!=>*?([}{#%&$@"  # measured with JetBrains Mono Bold, see scripts/ascii_scene.py

FONT = None


# ---------------------------------------------------------------- drawing

def layer(canvas, dens, glyph, solid=None, solid_th=0.8, lo=0.04, hi=None, gamma=0.8):
    """Draw one field onto the canvas as characters, with a smooth solid fill where it is densest."""
    im = Image.fromarray(np.clip(dens, 0, 1).astype('float32'))
    cell = np.asarray(im.resize((COLS, ROWS), Image.BOX))
    if solid is not None:
        fine = im.resize((COLS * SUB, ROWS * SUB), Image.BOX)
        big = np.asarray(fine.resize((W, H), Image.BICUBIC))
        mask = Image.fromarray(((big > solid_th) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.1 * K))
        canvas.paste(Image.new('RGB', (W, H), solid), mask=mask)
    hi = hi or (solid_th if solid is not None else 1.0)
    d = ImageDraw.Draw(canvas)
    n = len(RAMP)
    for r in range(ROWS):
        for c in range(COLS):
            v = cell[r, c]
            if v < lo or (solid is not None and v >= hi):
                continue
            t = min(1.0, (v - lo) / (hi - lo)) ** gamma
            d.text(((c + 0.5) * CW, r * CH + CH * 0.8), RAMP[1 + min(n - 2, int(t * (n - 1)))], font=FONT, fill=glyph, anchor='ms')


def blur(a, sigma):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(sigma))
    return np.asarray(im).astype('float32') / 255


def shift(a, dx, dy):
    out = np.zeros_like(a)
    h, w = a.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def coords():
    y, x = np.mgrid[0:GH, 0:GW].astype('float32')
    return x - GW / 2 + 0.5, y - GH / 2 + 0.5


def to_canvas(x, y):
    return (x + GW / 2) * W / GW, (y + GH / 2) * W / GW


def dots(canvas, pts, radius, fill, alpha=1.0):
    """Anti-aliased round dots at canvas positions, drawn at 2x or 3x and scaled down."""
    pad, k = round(40 * K), (3 if W <= 2160 else 2)
    layer_ = Image.new('RGBA', ((W + 2 * pad) * k, (H + 2 * pad) * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer_)
    for (x, y), rad, a in pts:
        rr = rad * k
        d.ellipse(((x + pad) * k - rr, (y + pad) * k - rr, (x + pad) * k + rr, (y + pad) * k + rr),
                  fill=(*fill, int(255 * a * alpha)))
    layer_ = layer_.resize((W + 2 * pad, H + 2 * pad), Image.LANCZOS).crop((pad, pad, pad + W, pad + H))
    canvas.paste(layer_, (0, 0), layer_)


def stadium_points(cx, cy, a, r, deg, gap):
    """Evenly spaced points round a capsule's outline, in field pixels."""
    th = math.radians(deg)
    c, s = math.cos(th), math.sin(th)
    L = 2 * a * 2 + 2 * math.pi * r
    out, k = [], 0
    n = int(L / gap)
    for i in range(n):
        d = i * L / n
        if d < 2 * a:
            u, v = -a + d, -r
        elif d < 2 * a + math.pi * r:
            ang = (d - 2 * a) / r
            u, v = a + r * math.sin(ang), -r * math.cos(ang)
        elif d < 4 * a + math.pi * r:
            u, v = a - (d - 2 * a - math.pi * r), r
        else:
            ang = (d - 4 * a - math.pi * r) / r
            u, v = -a - r * math.sin(ang), r * math.cos(ang)
        out.append((cx + u * c - v * s, cy + u * s + v * c))
    return out


def fbm(seed, octaves=5):
    rng = np.random.default_rng(seed)
    out, amp, tot = np.zeros((GH, GW), 'float32'), 1.0, 0.0
    for o in range(octaves):
        n = 3 * 2 ** o
        g = Image.fromarray(rng.random((int(n * GH / GW) + 3, n + 3)).astype('float32'))
        out += amp * np.asarray(g.resize((GW, GH), Image.BICUBIC))
        tot += amp
        amp *= 0.5
    return out / tot


# ---------------------------------------------------------------- shading

def norm(v):
    v = np.array(v, 'float32')
    return v / np.linalg.norm(v)


LIGHT = norm((-0.5, -0.7, 0.55))  # from the upper left, towards the viewer


def shade(nx, ny, nz, spec=0.5, amb=0.12):
    lam = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1)
    h = norm(LIGHT + np.array((0, 0, 1), 'float32'))
    sp = np.clip(nx * h[0] + ny * h[1] + nz * h[2], 0, 1) ** 60
    rim = (1 - nz) ** 3 * np.clip(nx * 0.7 + ny * 0.7, 0, 1)
    return np.clip(amb + 0.82 * lam + spec * sp + 0.3 * rim, 0, 1)


def capsule(X, Y, cx, cy, a, r, deg):
    """A capsule: a cylinder of half-length a and radius r with a hemisphere at each end, turned deg degrees."""
    th = math.radians(deg)
    c, s = math.cos(th), math.sin(th)
    dx, dy = X - cx, Y - cy
    u, v = dx * c + dy * s, -dx * s + dy * c
    qu, qv = u - np.clip(u, -a, a), v
    d = np.hypot(qu, qv)
    nu, nv = qu / r, qv / r
    nz = np.sqrt(np.clip(1 - nu ** 2 - nv ** 2, 0, 1))
    return dict(alpha=np.clip(r - d + 0.5, 0, 1), nx=nu * c - nv * s, ny=nu * s + nv * c, nz=nz, u=u, v=v)


# ---------------------------------------------------------------- the nine pictures

def engraving(name):
    """An engraving from docs/art/scenes-source.webp as ink on paper, scaled to the given height."""
    crops = {'hourglass': ((100, 69, 581, 891), 0.95, 99.5, 1000)}
    crop, gamma, hi, target_h = crops[name]
    src = Image.open(os.path.join(ROOT, 'docs/art/scenes-source.webp')).convert('RGB').crop(crop)
    w, h = src.size
    sc = target_h / h
    a = np.asarray(src).astype(float)
    d = np.array((80, 0, 8), float) - 255
    t = np.clip(((a - 255) @ d) / (d @ d), 0, 1)
    g = Image.fromarray((t * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(GW / COLS / sc * 0.45))
    g = g.filter(ImageFilter.UnsharpMask(radius=GW / COLS / sc * 8, percent=50, threshold=0))
    g = g.filter(ImageFilter.UnsharpMask(radius=GW / COLS / sc * 0.8, percent=50, threshold=0))
    arr = np.asarray(g).astype(float) / 255
    on = arr[arr > 0.02]
    arr = np.clip((arr - np.percentile(on, 0.5)) / (np.percentile(on, hi) - np.percentile(on, 0.5)), 0, 1) ** gamma
    arr = np.asarray(Image.fromarray((arr * 255).astype('uint8')).resize((round(w * sc), round(h * sc)), Image.BICUBIC)).astype('float32') / 255
    f = np.zeros((GH, GW), 'float32')
    y0, x0 = (GH - arr.shape[0]) // 2, (GW - arr.shape[1]) // 2
    f[y0:y0 + arr.shape[0], x0:x0 + arr.shape[1]] = arr
    return f


def draw_hourglass(font=None):
    c = Image.new('RGB', (W, H), PAPER)
    layer(c, engraving('hourglass'), RED, solid=RED, solid_th=0.92, lo=0.03, gamma=0.6)
    return c


def draw_bottle():
    """A supplement bottle with a blank label, turned from a profile: red body, ink cap, paper label."""
    X, Y = coords()
    y = Y[:, 0]
    top, cap_bot, neck_bot, sh_bot, base = -340, -215, -190, -60, 330
    R_body, R_neck, R_cap = 235, 150, 172
    r = np.zeros(GH, 'float32')
    r[(y >= top) & (y < cap_bot)] = R_cap
    r[(y >= cap_bot) & (y < neck_bot)] = R_neck
    m = (y >= neck_bot) & (y < sh_bot)
    r[m] = R_neck + (R_body - R_neck) * np.sin((y[m] - neck_bot) / (sh_bot - neck_bot) * math.pi / 2)
    r[(y >= sh_bot) & (y <= base)] = R_body
    cr = 50
    m = (y > base - cr) & (y <= base)
    r[m] = R_body - cr + cr * np.sqrt(1 - ((y[m] - (base - cr)) / cr) ** 2)
    drdy = np.gradient(r, y)[:, None]
    rr = np.maximum(r, 1)[:, None]
    alpha = np.clip(rr - np.abs(X) + 0.5, 0, 1) * (r[:, None] > 0)
    nx0 = np.clip(X / rr, -1, 1)
    nz0 = np.sqrt(1 - nx0 ** 2)
    n = np.sqrt(nx0 ** 2 + drdy ** 2 + nz0 ** 2)
    s = shade(nx0 / n, -drdy / n, nz0 / n)
    is_cap = (Y < cap_bot).astype('float32')
    ridge = 0.5 + 0.5 * np.cos(np.arcsin(nx0) * 30)
    label = np.clip((Y - 30) / 3, 0, 1) * np.clip((250 - Y) / 3, 0, 1)
    body = alpha * (1 - is_cap) * (0.50 + 0.50 * (1 - s) ** 0.8) * (1 - 0.97 * label)
    cap = alpha * is_cap * (0.55 + 0.45 * (1 - s * (0.85 + 0.15 * ridge)) ** 0.8)
    lit = np.clip((s - 0.62) / 0.38, 0, 1)
    paper_label = alpha * label * (0.10 + 0.60 * (1 - nz0) ** 2.2)
    shadow = np.exp(-(((X - 50) / 280) ** 2 + ((Y - (base + 8)) / 24) ** 2)) * 0.30
    c = Image.new('RGB', (W, H), PAPER)
    layer(c, shadow, RED, lo=0.05, hi=0.5)
    layer(c, body, RED, solid=RED, solid_th=0.62, lo=0.05)
    layer(c, alpha * (1 - is_cap) * (1 - label) * lit * (Y > sh_bot + 6), PAPER, lo=0.12)
    layer(c, paper_label, RED, lo=0.05, hi=0.9)
    layer(c, cap, INK, solid=INK, solid_th=0.62, lo=0.05)
    layer(c, alpha * is_cap * lit, PAPER, lo=0.12)
    return c


def draw_mark():
    c = Image.new('RGB', (W, H), RED)
    m = Image.open(os.path.join(ROOT, 'docs/brand/app-icons/intus-mark-red-2048.png')).convert('RGBA')
    a = m.getchannel('A')
    box = a.getbbox()
    a = a.crop(box)
    sc = 1760 * K / a.size[1]
    a = a.resize((round(a.size[0] * sc), round(a.size[1] * sc)), Image.LANCZOS)
    c.paste(Image.new('RGB', a.size, PAPER), ((W - a.size[0]) // 2, (H - a.size[1]) // 2), a)
    return c


def draw_capsule():
    X, Y = coords()
    cap = capsule(X, Y, 0, -10, 280, 195, -38)
    s = shade(cap['nx'], cap['ny'], cap['nz'])
    seam = 1 - 0.95 * np.exp(-(cap['u'] / 7) ** 2)
    right = np.clip(cap['u'] / 3 + 0.5, 0, 1)
    f = cap['alpha'] * seam * s
    c = Image.new('RGB', (W, H), INK)
    layer(c, f * (1 - right), RED, solid=RED, solid_th=0.36, lo=0.05)
    layer(c, f * (1 - right) * np.clip((s - 0.78) / 0.22, 0, 1), PAPER, lo=0.12)
    layer(c, f * right, PAPER, lo=0.04, gamma=0.5)
    return c


def draw_three_capsules():
    X, Y = coords()
    c = Image.new('RGB', (W, H), PAPER)
    specs = [(-70, -330), (50, -10)]
    a_, r_ = 118, 84
    total, shadow = np.zeros((GH, GW), 'float32'), np.zeros((GH, GW), 'float32')
    for cx, cy in specs:
        cap = capsule(X, Y, cx, cy, a_, r_, 0)
        s = shade(cap['nx'], cap['ny'], cap['nz'])
        total = np.maximum(total, cap['alpha'] * (0.50 + 0.50 * (1 - s) ** 0.8))
        shadow = np.maximum(shadow, shift(cap['alpha'], 20, 30))
    layer(c, blur(shadow, 12) * 0.22, RED, lo=0.05, hi=0.5)
    layer(c, total, RED, solid=RED, solid_th=0.62, lo=0.05)
    ghost = stadium_points(-40, 310, a_, r_, 0, 26)
    dots(c, [(to_canvas(x, y), 5.5 * K, 1.0) for x, y in ghost], 1, DOT)
    return c


def draw_moon():
    X, Y = coords()
    R, cx, cy = 400, 20, -20
    nx, ny = (X - cx) / R, (Y - cy) / R
    rr = nx ** 2 + ny ** 2
    nz = np.sqrt(np.clip(1 - rr, 0, 1))
    alpha = np.clip((1 - np.sqrt(rr)) * R + 0.5, 0, 1)
    L = norm((0.85, 0.10, -0.18))
    lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    tex = 0.80 + 0.20 * fbm(7, 5)
    s = np.clip(lam * 1.45, 0, 1) * tex
    c = Image.new('RGB', (W, H), INK)
    ring = stadium_points(cx, cy, 0.01, R, 0, 26)
    dots(c, [(to_canvas(x, y), 4.5 * K, 0.9) for x, y in ring], 1, DOT)
    layer(c, alpha * s, PAPER, solid=PAPER, solid_th=0.86, lo=0.05, gamma=0.7)
    return c


def draw_tube():
    X, Y = coords()
    Y = Y - 30  # drawn about the middle of the picture, so the 1:1 crop keeps the cap
    r, top = 118, -440
    body = capsule(X, Y, 0, -325, 675, r, 90)
    inner = capsule(X, Y, 0, -325, 675, r - 12, 90)
    open_ = (Y > top).astype('float32')
    glass_a = body['alpha'] * open_
    s_edge = (1 - body['nz']) ** 1.1
    streak = np.exp(-((X + 0.52 * r) / 7) ** 2) * (Y > top + 30) * (Y < 330)
    glass = np.clip(glass_a * (0.95 * s_edge + 0.9 * streak), 0, 1)
    level = -90 + 10 * (X / r) ** 2
    liquid_a = inner['alpha'] * (Y > level)
    liquid = liquid_a * np.clip(0.35 + 0.95 * inner['nz'] ** 1.4, 0, 1)
    # the cap: a wider cylinder with ridges
    cw = r * 1.14
    cn = np.clip(X / cw, -1, 1)
    cap_a = ((np.abs(X) < cw) & (Y > top - 90) & (Y <= top + 6)).astype('float32')
    cap_nz = np.sqrt(1 - cn ** 2)
    grooves = sum(np.exp(-((Y - (top - 14 - 24 * k)) / 2.6) ** 2) for k in range(3))
    cap_s = shade(cn, np.zeros_like(cn), cap_nz) * (1 - 0.6 * np.clip(grooves, 0, 1))
    c = Image.new('RGB', (W, H), INK)
    layer(c, liquid_a * 0 + liquid, RED, solid=RED, solid_th=0.50, lo=0.05)
    layer(c, liquid_a * np.exp(-((X + 0.52 * r) / 8) ** 2) * 0.9, PAPER, lo=0.15)
    layer(c, glass, PAPER, solid=PAPER, solid_th=0.9, lo=0.06)
    layer(c, cap_a * cap_s, RED, solid=RED, solid_th=0.55, lo=0.05)
    layer(c, cap_a * np.clip((cap_s - 0.8) / 0.2, 0, 1), PAPER, lo=0.12)
    return c


def sdf_torus(px, py, pz, M, R, r):
    lx = M[0, 0] * px + M[1, 0] * py + M[2, 0] * pz
    ly = M[0, 1] * px + M[1, 1] * py + M[2, 1] * pz
    lz = M[0, 2] * px + M[1, 2] * py + M[2, 2] * pz
    return np.hypot(np.hypot(lx, ly) - R, lz) - r


def draw_torus():
    X, Y = coords()
    ax, az = math.radians(44), math.radians(-24)
    Rx = np.array([[1, 0, 0], [0, math.cos(ax), -math.sin(ax)], [0, math.sin(ax), math.cos(ax)]])
    Rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
    M = (Rz @ Rx).astype('float32')
    R, r = 360, 88
    t = np.zeros_like(X)
    z0 = -900.0
    for _ in range(70):
        t = t + sdf_torus(X, Y, z0 + t, M, R, r) * 0.9
    z = z0 + t
    dist = sdf_torus(X, Y, z, M, R, r)
    hit = dist < 1.0
    e = 1.0
    gx = sdf_torus(X + e, Y, z, M, R, r) - sdf_torus(X - e, Y, z, M, R, r)
    gy = sdf_torus(X, Y + e, z, M, R, r) - sdf_torus(X, Y - e, z, M, R, r)
    gz = sdf_torus(X, Y, z + e, M, R, r) - sdf_torus(X, Y, z - e, M, R, r)
    n = np.sqrt(gx ** 2 + gy ** 2 + gz ** 2) + 1e-6
    s = shade(gx / n, gy / n, -gz / n, spec=0.45, amb=0.10)
    alpha = np.clip(1 - dist / 1.5, 0, 1) * hit
    c = Image.new('RGB', (W, H), RED)
    layer(c, alpha * s, PAPER, solid=PAPER, solid_th=0.97, lo=0.05, gamma=0.7)
    return c


def draw_timeline():
    """The site's dot grid with a lit trail ending in a ring, as the homepage cursor leaves one."""
    c = Image.new('RGB', (W, H), RED)
    pitch, ncol, nrow = 54 * K, 40, 50
    x0, y0 = (W - (ncol - 1) * pitch) / 2, (H - (nrow - 1) * pitch) / 2
    node = lambda i, j: (x0 + i * pitch, y0 + j * pitch)
    base = [(node(i, j), 4.6 * K, 1.0) for i in range(ncol) for j in range(nrow)]
    dots(c, base, 1, RED_INK)
    lit = {}
    cols = list(range(4, 36))
    for k, i in enumerate(cols):
        t = k / (len(cols) - 1)
        j = round(33 - 14 * t ** 1.15 + 4.2 * math.sin(2 * math.pi * (1.25 * t + 0.08)))
        a = 0.28 + 0.72 * t ** 1.2
        lit[(i, j)] = max(lit.get((i, j), 0), a)
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            lit[(i + di, j + dj)] = max(lit.get((i + di, j + dj), 0), a * 0.38)
    head = max(lit, key=lambda k: k[0] + (0.01 if lit[k] > 0.9 else 0))
    hi_, hj_ = [k for k in lit if lit[k] >= 0.99][0]
    pts = [(node(i, j), (6.0 + 15 * a ** 1.5) * K, min(1, a * 1.1)) for (i, j), a in lit.items()]
    dots(c, pts, 1, PAPER)
    hx, hy = node(hi_, hj_)
    dots(c, [((hx, hy), 30 * K, 1.0)], 1, PAPER)
    ring = [((hx + 84 * K * math.cos(k * math.pi / 28), hy + 84 * K * math.sin(k * math.pi / 28)), 4.2 * K, 0.9) for k in range(56)]
    dots(c, ring, 1, PAPER)
    return c


PICTURES = [  # grid position, name, ground, drawing
    ('01', 'hourglass', 'paper', draw_hourglass),
    ('02', 'mark', 'red', draw_mark),
    ('03', 'capsule', 'ink', draw_capsule),
    ('04', 'trail', 'red', draw_timeline),
    ('05', 'moon', 'ink', draw_moon),
    ('06', 'three-capsules', 'paper', draw_three_capsules),
    ('07', 'bottle', 'paper', draw_bottle),
    ('08', 'ring', 'red', draw_torus),
    ('09', 'test-tube', 'ink', draw_tube),
]


def main():
    global FONT
    p = argparse.ArgumentParser()
    p.add_argument('--font', required=True, help='a JetBrains Mono Bold .ttf')
    p.add_argument('--out', default=os.path.join(ROOT, 'social-out/prelaunch'))
    p.add_argument('--only', help='draw one picture by name')
    p.add_argument('--width', type=int, default=3840, help='picture width in pixels, 3840 is 4K; the height is 5/4 of it')
    a = p.parse_args()
    set_size(a.width)
    try:
        FONT = ImageFont.truetype(a.font, CH)
    except TypeError:
        FONT = ImageFont.truetype(a.font, round(CH))
    os.makedirs(os.path.join(a.out, 'x'), exist_ok=True)

    made = []
    for pos, name, ground, fn in PICTURES:
        if a.only and a.only != name:
            continue
        im = fn()
        path = os.path.join(a.out, f'{pos}-{name}-{ground}.png')
        im.save(path, optimize=True)
        sq = im.crop((0, (H - W) // 2, W, (H - W) // 2 + W))
        sq.save(os.path.join(a.out, 'x', f'{pos}-{name}-{ground}.png'), optimize=True)
        made.append(im)
        print(path)

    if not a.only:
        tw, th, gap = 540, 675, 14
        sheet = Image.new('RGB', (3 * tw + 4 * gap, 3 * th + 4 * gap), (24, 24, 24))
        for k, im in enumerate(made):
            sheet.paste(im.resize((tw, th), Image.LANCZOS), (gap + (k % 3) * (tw + gap), gap + (k // 3) * (th + gap)))
        sheet.save(os.path.join(a.out, 'grid.png'))
        print('grid.png')


if __name__ == '__main__':
    main()
