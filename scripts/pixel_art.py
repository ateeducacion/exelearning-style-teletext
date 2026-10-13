#!/usr/bin/env python3
"""Draw the example's teletext illustrations as pixel SVGs in the eight teletext colours.

    python3 scripts/pixel_art.py

Each picture is a 48 x 36 grid; every row of same-coloured pixels becomes one run of a path.
"""
from pathlib import Path
import math

W, H = 48, 36
PALETTE = {"K": "#000", "R": "#f00", "G": "#0f0", "Y": "#ff0", "B": "#00f", "M": "#f0f", "C": "#0ff", "W": "#fff"}
FONT = {  # 3 x 5
    "0": ["WWW", "W.W", "W.W", "W.W", "WWW"],
    "1": [".W.", "WW.", ".W.", ".W.", "WWW"],
    "2": ["WW.", "..W", ".W.", "W..", "WWW"],
    "3": ["WW.", "..W", ".W.", "..W", "WW."],
    "4": ["W.W", "W.W", "WWW", "..W", "..W"],
    "V": ["W.W", "W.W", "W.W", "W.W", ".W."],
    "F": ["WWW", "W..", "WW.", "W..", "W.."],
    "?": ["WW.", "..W", ".W.", "...", ".W."],
}


class Canvas:
    def __init__(self, background="K"):
        self.cells = [[background] * W for _ in range(H)]

    def px(self, x, y, colour):
        if 0 <= x < W and 0 <= y < H:
            self.cells[y][x] = colour

    def rect(self, x, y, w, h, colour):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.px(i, j, colour)

    def disc(self, cx, cy, r, colour):
        for j in range(cy - r, cy + r + 1):
            for i in range(cx - r, cx + r + 1):
                if (i - cx) ** 2 + (j - cy) ** 2 <= r * r + r * 0.8:
                    self.px(i, j, colour)

    def line(self, x0, y0, x1, y1, colour):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(steps + 1):
            self.px(round(x0 + (x1 - x0) * k / steps), round(y0 + (y1 - y0) * k / steps), colour)

    def sprite(self, x, y, rows, colour=None, scale=1):
        for j, row in enumerate(rows):
            for i, cell in enumerate(row):
                if cell != ".":
                    self.rect(x + i * scale, y + j * scale, scale, scale, colour or cell)

    def text(self, x, y, text, colour, scale=1):
        for k, char in enumerate(text):
            self.sprite(x + k * 4 * scale, y, FONT[char], colour, scale)

    def svg(self):
        paths = {}
        for y, row in enumerate(self.cells):
            x = 0
            while x < W:
                end = x
                while end + 1 < W and row[end + 1] == row[x]:
                    end += 1
                paths.setdefault(row[x], []).append(f"M{x} {y}h{end - x + 1}v1h-{end - x + 1}z")
                x = end + 1
        body = "".join(f'<path fill="{PALETTE[c]}" d="{"".join(d)}"/>' for c, d in paths.items())
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W * 10}" height="{H * 10}" '
                f'shape-rendering="crispEdges">{body}</svg>\n')


# ---------- Pieces ----------

def sun(c, cx, cy, r=5):
    c.disc(cx, cy, r, "Y")
    for k in range(8):
        a = k * math.pi / 4
        c.line(round(cx + (r + 2) * math.cos(a)), round(cy + (r + 2) * math.sin(a)),
               round(cx + (r + 3) * math.cos(a)), round(cy + (r + 3) * math.sin(a)), "Y")


def cloud(c, x, y, w=16, colour="W"):
    """A cloud w pixels wide whose flat base sits on row y."""
    r = max(2, w // 5)
    c.rect(x + r // 2, y - r, w - r, r + 1, colour)
    c.disc(x + r, y - r, r, colour)
    c.disc(x + w - r - 1, y - r, r, colour)
    c.disc(x + w // 2, y - r - r // 2 - 1, r + 1, colour)


def sea(c, top, phase=0):
    c.rect(0, top, W, H - top, "B")
    for row in range(top + 1, H, 3):
        for x in range(W):
            c.px(x, row + (((x + phase + row) // 4) % 2), "C")


def wavy_arrow(c, x, bottom, top, colour="C"):
    for y in range(top + 3, bottom + 1):
        c.rect(x + (0, 0, 1, 1, 0, 0, -1, -1)[(y - top) % 8], y, 2, 1, colour)
    c.sprite(x - 2, top, ["..CC..", ".CCCC.", "CCCCCC"], colour)


def arrow(c, x0, y0, x1, y1, colour="M"):
    """A straight two-pixel arrow, horizontal or vertical, pointing at (x1, y1)."""
    head = {(1, 0): ["C..", "CC.", "CCC", "CC.", "C.."], (-1, 0): ["..C", ".CC", "CCC", ".CC", "..C"],
            (0, 1): ["CCCCC", ".CCC.", "..C.."], (0, -1): ["..C..", ".CCC.", "CCCCC"]}
    dx, dy = (x1 > x0) - (x1 < x0), (y1 > y0) - (y1 < y0)
    if dy:
        c.rect(x0, min(y0, y1), 2, abs(y1 - y0) + 1, colour)
        c.sprite(x1 - 1, y1 - (2 if dy > 0 else 0), head[(0, dy)], colour)
    else:
        c.rect(min(x0, x1), y0, abs(x1 - x0) + 1, 2, colour)
        c.sprite(x1 - (2 if dx > 0 else 0), y0 - 1, head[(dx, 0)], colour)


def drop(c, x, y, colour="C"):
    c.sprite(x, y, ["..C..", ".CCC.", "CCCCC", ".CCC."], colour)


def snowflake(c, x, y):
    c.sprite(x, y, ["W.W.W", ".WWW.", "WW.WW", ".WWW.", "W.W.W"])


def mountain(c, peak_x, peak_y, half, base, colour="G"):
    for y in range(peak_y, base + 1):
        spread = (y - peak_y) * half // max(1, base - peak_y)
        c.rect(peak_x - spread, y, 2 * spread + 1, 1, colour)
    for y in range(peak_y, peak_y + 3):
        spread = (y - peak_y) * half // max(1, base - peak_y)
        c.rect(peak_x - spread, y, 2 * spread + 1, 1, "W")


# ---------- Pictures ----------

def inicio():
    c = Canvas()
    sun(c, 8, 7, 3)
    cloud(c, 33, 9, 12)
    sea(c, 30)
    # A big drop over the sea, with a highlight.
    for y in range(4, 22):
        half = (y - 4) * 9 // 18
        c.rect(24 - half, y, 2 * half + 1, 1, "C")
    c.disc(24, 21, 9, "C")
    c.rect(19, 17, 2, 6, "W")
    c.rect(21, 24, 2, 2, "W")
    for x, y in ((6, 20), (41, 18), (10, 26), (38, 25)):
        drop(c, x, y)
    return c


def ciclo():
    c = Canvas()
    sun(c, 8, 7, 4)
    cloud(c, 28, 13, 17)
    for x, y in ((29, 16), (35, 18), (41, 16), (32, 22), (38, 23)):
        drop(c, x, y)
    sea(c, 28)
    # Evaporation, the vapour carried to the cloud, and the rain back to the sea.
    wavy_arrow(c, 8, 26, 15)
    arrow(c, 17, 9, 25, 9, "M")
    arrow(c, 46, 14, 46, 25, "M")
    return c


def evaporacion():
    c = Canvas()
    sun(c, 24, 8, 5)
    for x in (13, 24, 35):
        wavy_arrow(c, x, 27, 17)
    for x, y in ((6, 18), (19, 22), (30, 20), (42, 17), (9, 25), (40, 24)):
        c.px(x, y, "C")
    sea(c, 28)
    return c


def condensacion():
    c = Canvas()
    cloud(c, 14, 14, 22)
    cloud(c, 2, 9, 10)
    cloud(c, 37, 8, 9)
    for k, (x, y) in enumerate(((10, 30), (16, 26), (22, 31), (28, 24), (34, 29), (40, 25), (19, 20), (31, 19), (25, 17))):
        c.px(x, y, "C" if k % 2 else "W")
        if y > 22:
            c.px(x, y - 3, "C")
    c.rect(0, 34, W, 2, "B")
    return c


def precipitacion():
    c = Canvas()
    cloud(c, 4, 10, 22, "W")
    cloud(c, 24, 9, 20, "C")
    for x in (7, 13, 19):
        for y in (13, 20, 27):
            c.line(x + (y // 7) % 2, y, x + (y // 7) % 2 - 1, y + 3, "C")
    for x, y in ((28, 14), (36, 20), (30, 26)):
        snowflake(c, x, y)
    for x, y in ((42, 13), (40, 23), (44, 28)):
        c.rect(x, y, 2, 2, "W")
    c.rect(0, 33, W, 3, "G")
    return c


def recogida():
    c = Canvas()
    sun(c, 40, 6, 3)
    mountain(c, 10, 4, 12, 20)
    mountain(c, 22, 9, 9, 20)
    c.rect(0, 20, 36, 16, "G")
    c.rect(0, 30, 36, 6, "B")  # aquifer
    for x in range(2, 34, 5):
        c.px(x, 32 + x % 2, "C")
    # A river winding down to the sea.
    for y in range(20, 29):
        x = 12 + round(3 * math.sin(y / 2.2)) + (y - 20) * 2
        c.rect(x, y, 4, 1, "C")
    c.rect(29, 27, 7, 2, "C")
    sea(c, 26, 1)
    c.rect(36, 20, 12, 6, "K")
    return c


def actividades():
    c = Canvas()
    for k, y in enumerate((5, 15, 25)):
        c.rect(6, y, 7, 7, "W")
        c.rect(7, y + 1, 5, 5, "K")
        c.rect(17, y + 2, 24 - k * 4, 3, "C" if k != 1 else "Y")
        if k < 2:
            c.sprite(7, y - 1, ["......G", ".....GG", "G...GG.", "GG.GG..", ".GGG...", "..G...."])
    return c


def ordena():
    c = Canvas()
    for k, colour in enumerate(("Y", "W", "C", "G")):
        x = 1 + k * 12
        c.rect(x, 11, 9, 14, colour)
        c.text(x + 2, 13, str(k + 1), "K", 2)
        if k < 3:
            c.sprite(x + 9, 16, ["M..", "MM.", "MMM", "MM.", "M.."])
    c.rect(1, 29, 46, 1, "B")
    c.rect(1, 6, 46, 1, "B")
    return c


def verdadero_falso():
    c = Canvas()
    c.rect(3, 6, 19, 24, "G")
    c.sprite(5, 11, ["KK...KK", "KK...KK", ".KK.KK.", ".KK.KK.", "..KKK..", "..KKK..", "...K..."], scale=2)
    c.rect(26, 6, 19, 24, "R")
    c.sprite(29, 11, ["WWWWWW.", "WW.....", "WW.....", "WWWWW..", "WW.....", "WW.....", "WW....."], scale=2)
    return c


def recursos():
    c = Canvas()
    # An open book.
    c.rect(4, 12, 20, 18, "W")
    c.rect(13, 12, 2, 18, "B")
    for y in range(15, 28, 3):
        c.rect(6, y, 6, 1, "B")
        c.rect(16, y, 6, 1, "B")
    # The globe.
    c.disc(35, 18, 9, "B")
    for x, y, w in ((31, 12, 4), (30, 13, 6), (31, 14, 5), (32, 15, 3), (36, 19, 5), (37, 20, 6), (38, 21, 4), (39, 22, 2), (29, 22, 3)):
        c.rect(x, y, w, 1, "G")
    c.rect(34, 28, 3, 2, "Y")
    c.rect(30, 30, 11, 1, "Y")
    return c


def creditos():
    c = Canvas()
    # A television showing the colour bars.
    c.rect(4, 3, 40, 27, "W")
    c.rect(6, 5, 36, 23, "K")
    for k, colour in enumerate("WYCGMRB"):
        c.rect(7 + 34 * k // 7, 6, 34 * (k + 1) // 7 - 34 * k // 7, 15, colour)
    c.rect(7, 22, 34, 5, "B")
    c.text(9, 22, "100", "W")
    c.line(16, 30, 12, 34, "W")
    c.line(31, 30, 35, 34, "W")
    return c


PICTURES = {
    "SP00000003/01-inicio.svg": inicio,
    "SP00000006/02-el-ciclo-del-agua.svg": ciclo,
    "SP00000011/03-evaporacion.svg": evaporacion,
    "SP00000014/04-condensacion.svg": condensacion,
    "SP00000017/05-precipitacion.svg": precipitacion,
    "SP00000020/06-recogida.svg": recogida,
    "SP00000023/07-actividades.svg": actividades,
    "SP00000026/08-ordena-las-fases.svg": ordena,
    "SP00000031/09-verdadero-o-falso.svg": verdadero_falso,
    "SP00000036/10-recursos.svg": recursos,
    "SP00000039/11-creditos-y-descargas.svg": creditos,
}

if __name__ == "__main__":
    resources = Path(__file__).resolve().parents[1] / "content/resources"
    for name, draw in PICTURES.items():
        target = resources / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(draw().svg())
    print(f"Drew {len(PICTURES)} pictures into {resources}")
