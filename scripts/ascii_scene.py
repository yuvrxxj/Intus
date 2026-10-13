#!/usr/bin/env python3
"""
Turns the five page pictures in docs/art/scenes-source.webp (maroon engravings on white) into tone grids of characters,
written as TypeScript modules that src/components/ui/ascii-scene.tsx animates.

    pip install pillow numpy
    python3 scripts/ascii_scene.py docs/art/scenes-source.webp src/components/art
    python3 scripts/ascii_scene.py docs/art/scenes-source.webp src/components/art --only sisyphus --preview /tmp/preview

How it reads a picture, in order:
  1. coverage: every pixel is placed on the line from paper to the maroon ink, 0 for paper and 1 for full ink
  2. descreen: a blur about half a character wide, because the engravings are halftone dots and sampling dots at
     character size speckles; this is what makes the shading smooth
  3. local contrast, then a light sharpen, so forms keep their volume and edges survive the downsampling
  4. each character cell averages its pixels; the tones are stretched between two percentiles of the ink
  5. a cell picks the glyph at its darkness from RAMP. The ramp was measured, not guessed: every printable symbol was
     drawn in JetBrains Mono Bold and the glyphs were taken at even steps of ink. Symbols only, no letters, because
     letters read as noise next to each other. Pass --font to measure again with a font file of your own.
The output holds only the character grid. The motion is not stored: the engine moves tones about at run time.
"""
import argparse
import json
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# measured with JetBrains Mono Bold, 26 steps, symbols only (see above)
RAMP = " `.'-:_;!=>*?([}{#%&$@"
SYMBOLS = ".'`^,:;~-_=+<>!/\\|()[]{}?*#%&$@"
INK = (80, 0, 8)
CELL = 0.6  # JetBrains Mono cells are 0.6 as wide as they are tall

# name: (crop x0,y0,x1,y1 in source pixels, rows, gamma, ink percentile mapped to the darkest glyph)
SCENES = {
    'hourglass': ((100, 69, 581, 891), 150, 0.95, 99.5),
    'archery': ((709, 94, 1337, 904), 140, 0.75, 98.0),
    'bloodwork': ((1346, 158, 1969, 837), 120, 0.90, 99.5),
    'supplements': ((74, 1154, 919, 1870), 100, 0.90, 99.5),
    'sisyphus': ((1023, 1059, 2000, 1880), 100, 0.95, 99.5),
}


def measure_ramp(font_path, levels=26):
    """Glyphs from SYMBOLS at even steps of ink, lightest to darkest, led by a space."""
    size = 100
    font = ImageFont.truetype(font_path, size)
    cw = int(round(font.getlength('M')))
    ink = {}
    for c in SYMBOLS:
        im = Image.new('L', (cw, size), 0)
        ImageDraw.Draw(im).text((0, size * 0.8), c, font=font, fill=255, anchor='ls')
        ink[c] = np.asarray(im).mean() / 255
    top, pool, ramp = max(ink.values()), dict(ink), [' ']
    for k in range(1, levels):
        best = min(pool, key=lambda c: abs(pool[c] - top * k / (levels - 1)))
        pool.pop(best)
        if ink[best] > ink.get(ramp[-1], 0):  # each glyph must be darker than the one before it
            ramp.append(best)
    return ''.join(ramp)


def tone_grid(img, rows, gamma, hi, ramp):
    w, h = img.size
    cols = round(rows * w / (CELL * h))
    cell_w = w / cols
    a = np.asarray(img.convert('RGB')).astype(float)
    d = np.array(INK, float) - 255
    t = np.clip(((a - 255) @ d) / (d @ d), 0, 1)
    g = Image.fromarray((t * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(cell_w * 0.45))
    g = g.filter(ImageFilter.UnsharpMask(radius=cell_w * 8, percent=50, threshold=0))
    g = g.filter(ImageFilter.UnsharpMask(radius=cell_w * 0.8, percent=50, threshold=0))
    arr = np.asarray(g).astype(float) / 255
    on = arr[arr > 0.02]
    lo_v, hi_v = np.percentile(on, 0.5), np.percentile(on, hi)
    arr = np.clip((arr - lo_v) / max(hi_v - lo_v, 1e-6), 0, 1) ** gamma
    cells = np.asarray(Image.fromarray((arr * 255).astype(np.uint8)).resize((cols, rows), Image.BOX)).astype(float) / 255
    n = len(ramp)
    return cols, [''.join(ramp[min(n - 1, int(v * n))] if v > 0.02 else ' ' for v in row).rstrip() for row in cells]


def preview(lines, cols, ramp, path, font_path, scale=1.5):
    cw, lh = 6 * scale, 10 * scale
    im = Image.new('RGB', (int(cols * cw) + 1, int(len(lines) * lh) + 1), (229, 236, 233))
    d, font = ImageDraw.Draw(im), ImageFont.truetype(font_path, int(10 * scale))
    for r, line in enumerate(lines):
        for c, ch in enumerate(line):
            if ch != ' ':
                d.text((c * cw, r * lh + lh * 0.8), ch, font=font, fill=(163, 22, 33), anchor='ls')
    im.save(path)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('source')
    p.add_argument('outdir')
    p.add_argument('--only', choices=sorted(SCENES))
    p.add_argument('--font', help='a JetBrains Mono Bold .ttf: measure the ramp again and draw --preview with it')
    p.add_argument('--preview', help='also write a PNG of each picture into this folder (needs --font)')
    a = p.parse_args()

    ramp = measure_ramp(a.font) if a.font else RAMP
    src = Image.open(a.source).convert('RGB')
    for name, (crop, rows, gamma, hi) in SCENES.items():
        if a.only and name != a.only:
            continue
        cols, lines = tone_grid(src.crop(crop), rows, gamma, hi, ramp)
        n = name.upper()
        path = os.path.join(a.outdir, f'scene-{name}.ts')
        body = ',\n'.join('  ' + json.dumps(line) for line in lines)
        with open(path, 'w') as f:
            f.write(f'''// Generated by scripts/ascii_scene.py from docs/art/scenes-source.webp (the {name} picture). Do not edit by hand.
// A tone grid: each character stands for how dark its cell is, lightest to darkest along the ramp, so the engine in
// src/components/ui/scene-engine.ts can move tones about and pick the characters again. {cols} columns by {rows} rows.

export const {n}_COLS = {cols};
export const {n}_ROWS = {rows};
export const {n}_RAMP = {json.dumps(ramp)};

/** One line per row, trailing spaces trimmed. */
export const {n}_TEXT: readonly string[] = [
{body},
];
''')
        if a.preview:
            os.makedirs(a.preview, exist_ok=True)
            preview(lines, cols, ramp, os.path.join(a.preview, f'{name}.png'), a.font)
        print(f'{path}: {cols} x {rows}')


if __name__ == '__main__':
    main()
