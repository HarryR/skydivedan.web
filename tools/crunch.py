#!/usr/bin/env python3
"""Make a small, crunchy 8-bit-style copy of a PNG; the source file is left untouched.

The output is cropped to its visible pixels, downscaled to WIDTH, and given
1-bit alpha plus an N-colour palette with no dithering. In CSS, display it with
`image-rendering: pixelated` so it stays crisp when scaled up.

If `pngcrush` is installed, the output is then crushed in place (lossless,
pixels identical, metadata stripped), typically saving another ~25%.

Uses only Python + Pillow, plus the optional system pngcrush; no npm / Node tooling.

    python3 tools/crunch.py SRC.png OUT.png --width 256 --colors 16
"""
import argparse
import os
import shutil
import subprocess
import tempfile

from PIL import Image


def crunch(src: str, out: str, width: int, colors: int, alpha_cutoff: int) -> None:
    im = Image.open(src).convert('RGBA')
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    height = max(1, round(im.height * width / im.width))
    im = im.resize((width, height), Image.LANCZOS)
    im.putalpha(im.getchannel('A').point(lambda v: 255 if v >= alpha_cutoff else 0))
    q = im.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.NONE)
    q.save(out, optimize=True)
    crushed = crush(out)
    print(f'{src} -> {out}: {width}x{height}, {colors} colours, '
          f'{os.path.getsize(src) / 1024:.0f} KB -> {os.path.getsize(out) / 1024:.1f} KB'
          f'{" (pngcrushed)" if crushed else ""}')


def crush(path: str) -> bool:
    """Losslessly recompress `path` with pngcrush if available; keep whichever is smaller."""
    exe = shutil.which('pngcrush')
    if not exe:
        return False
    fd, tmp = tempfile.mkstemp(suffix='.png', dir=os.path.dirname(os.path.abspath(path)))
    os.close(fd)
    try:
        subprocess.run([exe, '-q', '-brute', '-reduce', '-rem', 'alla', path, tmp],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if 0 < os.path.getsize(tmp) < os.path.getsize(path):
            os.replace(tmp, path)
            os.chmod(path, 0o644)  # mkstemp creates 0600; shipped assets must be world-readable
            return True
        return False
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('src')
    p.add_argument('out')
    p.add_argument('--width', type=int, required=True, help='output width in pixels')
    p.add_argument('--colors', type=int, default=16, help='palette size (default 16)')
    p.add_argument('--alpha-cutoff', type=int, default=128, help='alpha >= this becomes opaque (default 128)')
    a = p.parse_args()
    crunch(a.src, a.out, a.width, a.colors, a.alpha_cutoff)
