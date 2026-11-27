"""Builds the Wavelink logo kit from exact geometry.

The mark ("Wave-W"): a W drawn as one wave. Arms run at 75 degrees, the troughs are circular arcs, the middle crest is a
smaller, lower arc, and a "sent" dot leaves level with the end of the last arm. Everything is drawn as filled outlines
(no strokes), built from straight segments and circular arcs only, so it scales, cuts and embroiders predictably.

The wordmark is "Wavelink" in Bricolage Grotesque (SIL Open Font License, which allows logo use) at weight 700,
shaped with HarfBuzz for the font's own kerning and converted to outlines.

Run:  <venv with fonttools + uharfbuzz>/bin/python build.py <path to Bricolage Grotesque variable .woff2>
Writes everything into ./final/.
"""
import math
import os
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "final")
os.makedirs(OUT, exist_ok=True)

GREEN = "#0E9F67"   # Wavelink Green: the mark on light backgrounds (3.4:1 on white)
SIGNAL = "#14B874"  # Signal Green: the mark on dark backgrounds (7.3:1 on ink)
INK = "#0D1310"     # Ink: wordmark and one-colour dark version
WHITE = "#FFFFFF"

S75, C75 = math.sin(math.radians(75)), math.cos(math.radians(75))


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def mark_geometry(w=30.0, R=24.0, Rc=10.0, yt=80.0, yb=176.0, yc=130.0, xm=128.0, right_drop=20.0, dot_gap=None, dot_r=None):
    """Centre-line construction of the W, then its filled outline as subpaths (nonzero fill unites them).

    w: line weight. R: trough radius. Rc: crest radius (smaller than w/2, so the crest underside closes to a point).
    yt: top of the left arm. yb: bottom of the troughs. yc: top of the middle crest. xm: centre of the crest.
    right_drop: the right arm ends this much lower than the left, leaving room for the dot.
    """
    h = w / 2
    dot_r = dot_r if dot_r is not None else h
    dDown, dUp = (C75, S75), (C75, -S75)

    # middle crest: centre, tangent points
    oc = (xm, yc + Rc)
    cs = (oc[0] - Rc * S75, oc[1] - Rc * C75)  # start (rising into it)
    ce = (oc[0] + Rc * S75, oc[1] - Rc * C75)  # end (falling out of it)

    # trough 1: its end point E1 lies on the line through cs with direction dUp; E1 = O1 + R*(s, c), O1 = (x1, yb - R)
    # E1y = yb - R + R*c; travel from E1 to cs along dUp: cs - E1 = t*(c, -s)
    e1y = yb - R + R * C75
    t = (e1y - cs[1]) / S75
    e1 = (cs[0] - t * C75, e1y)
    x1 = e1[0] - R * S75
    o1 = (x1, yb - R)
    s1 = (x1 - R * S75, yb - R + R * C75)  # trough start (left arm arrives here)
    # left arm from top A down along dDown to s1
    a = (s1[0] - (s1[1] - yt) * C75 / S75, yt)

    # mirror for trough 2
    x2 = 2 * xm - x1
    o2 = (x2, yb - R)
    s2 = (2 * xm - e1[0], e1y)  # trough 2 start (falling into it), mirror of e1
    e2 = (x2 + R * S75, yb - R + R * C75)
    z = (e2[0] + (e2[1] - (yt + right_drop)) * C75 / S75, yt + right_drop)  # right arm end

    segs = [(a, s1), (e1, cs), (ce, s2), (e2, z)]

    def area(pts):
        return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / 2

    # Every subpath is drawn with the same orientation (positive area in SVG's y-down frame), so where the pieces
    # overlap the nonzero fill unites them instead of cancelling into hairline seams.
    def rect(p, q):
        dx, dy = q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy)
        nx, ny = -dy / L * h, dx / L * h
        pts = [(p[0] + nx, p[1] + ny), (q[0] + nx, q[1] + ny), (q[0] - nx, q[1] - ny), (p[0] - nx, p[1] - ny)]
        if area(pts) < 0:
            pts.reverse()
        return "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts) + " Z"

    def circle(c, r):
        return f"M{f(c[0] - r)} {f(c[1])} A{f(r)} {f(r)} 0 1 1 {f(c[0] + r)} {f(c[1])} A{f(r)} {f(r)} 0 1 1 {f(c[0] - r)} {f(c[1])} Z"

    def trough(o):
        ro, ri = R + h, R - h
        p = lambda r, phi: (o[0] + r * math.sin(math.radians(phi)), o[1] + r * math.cos(math.radians(phi)))
        a0, a1 = p(ro, -75), p(ro, 75)
        b1, b0 = p(ri, 75), p(ri, -75)
        # outer arc goes through the bottom (sweep from left to right below the centre), inner arc back
        # traverse: outer arc right-to-left along the bottom (positive orientation), then the inner arc back
        return (f"M{f(a1[0])} {f(a1[1])} A{f(ro)} {f(ro)} 0 0 1 {f(a0[0])} {f(a0[1])} "
                f"L{f(b0[0])} {f(b0[1])} A{f(ri)} {f(ri)} 0 0 0 {f(b1[0])} {f(b1[1])} Z")

    def crest(o):
        ro = Rc + h
        p = lambda r, psi: (o[0] + r * math.sin(math.radians(psi)), o[1] - r * math.cos(math.radians(psi)))
        a0, a1 = p(ro, -75), p(ro, 75)
        # a pie slice: with Rc < w/2 the swept stroke covers the centre, so slice + the two rise rectangles = the crest
        return f"M{f(o[0])} {f(o[1])} L{f(a0[0])} {f(a0[1])} A{f(ro)} {f(ro)} 0 0 1 {f(a1[0])} {f(a1[1])} Z"

    parts = [rect(p, q) for p, q in segs] + [trough(o1), trough(o2), crest(oc), circle(a, h), circle(z, h)]
    gap = dot_gap if dot_gap is not None else w * 0.55
    dot = (z[0] + h + gap + dot_r, z[1])
    parts.append(circle(dot, dot_r))

    # bounding box of the visible shape
    xs = [a[0] - h, dot[0] + dot_r]
    ys = [a[1] - h, yb + h, dot[1] - dot_r]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    return " ".join(parts), bbox


def place(d, bbox, box, margin, optical_lift=0.0):
    """Translate/scale so the bbox sits centred (optically lifted) inside a square of size `box` with `margin`."""
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0
    s = (box - 2 * margin) / max(bw, bh)
    tx = (box - bw * s) / 2 - x0 * s
    ty = (box - bh * s) / 2 - y0 * s - optical_lift * box
    return f'<g transform="translate({f(tx)} {f(ty)}) scale({f(s)})"><path d="{d}"/></g>'


def svg(viewbox, body, title, fill):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-label="{title}">'
            f"<title>{title}</title><g fill=\"{fill}\">{body}</g></svg>\n")


def write(name, text):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(text)


# ---------------------------------------------------------------- symbol (master, reversed, small-size cut)
MASTER, MASTER_BBOX = mark_geometry()
REVERSED, REVERSED_BBOX = mark_geometry(w=28.0, dot_r=15.0)  # a touch thinner on dark: light ink spreads
SMALL, SMALL_BBOX = mark_geometry(w=40.0, R=30.0, Rc=6.0, yt=70.0, yb=186.0, yc=128.0, right_drop=18.0, dot_gap=18.0, dot_r=22.0)

for name, (d, bb), fill in [
    ("wavelink-symbol.svg", (MASTER, MASTER_BBOX), GREEN),
    ("wavelink-symbol-ink.svg", (MASTER, MASTER_BBOX), INK),
    ("wavelink-symbol-reversed.svg", (REVERSED, REVERSED_BBOX), WHITE),
    ("wavelink-symbol-small.svg", (SMALL, SMALL_BBOX), GREEN),
]:
    margin = 22 if "small" in name else 32
    write(name, svg("0 0 256 256", place(d, bb, 256, margin, optical_lift=0.01), "Wavelink", fill))

# ---------------------------------------------------------------- wordmark (outlined Bricolage Grotesque 700)
if len(sys.argv) < 2:
    print("symbols written; pass the Bricolage Grotesque font file to build the wordmark and lockups")
    sys.exit(0)

import uharfbuzz as hb  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib.instancer import instantiateVariableFont  # noqa: E402
from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402
from fontTools.pens.transformPen import TransformPen  # noqa: E402
from fontTools.pens.boundsPen import BoundsPen  # noqa: E402
import io  # noqa: E402

src = TTFont(sys.argv[1])
inst = instantiateVariableFont(src, {"wght": 700}, inplace=False)
buf = io.BytesIO()
inst.flavor = None
inst.save(buf)
blob = hb.Blob(buf.getvalue())
face = hb.Face(blob)
font = hb.Font(face)
upem = inst["head"].unitsPerEm
cap = getattr(inst["OS/2"], "sCapHeight", 0) or int(upem * 0.7)
xh = getattr(inst["OS/2"], "sxHeight", 0) or int(upem * 0.5)
glyphset = inst.getGlyphSet()

text = "Wavelink"
hbuf = hb.Buffer()
hbuf.add_str(text)
hbuf.guess_segment_properties()
hb.shape(font, hbuf, {"kern": True, "liga": False})
tracking = -0.02 * upem  # matches the site's tight display setting
order = inst.getGlyphOrder()
pen = SVGPathPen(glyphset, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
bpen = BoundsPen(glyphset)
x = 0.0
for info, pos in zip(hbuf.glyph_infos, hbuf.glyph_positions):
    gname = order[info.codepoint]
    tp = TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, 0))  # flip y: font y-up to SVG y-down, baseline at 0
    glyphset[gname].draw(tp)
    glyphset[gname].draw(TransformPen(bpen, (1, 0, 0, -1, x + pos.x_offset, 0)))
    x += pos.x_advance + tracking
word_d = pen.getCommands()
word_w = x - tracking
# real ink bounds of the word (ascenders of l/k rise above cap height; no descenders)
ink_x0, ink_y0, ink_x1, ink_y1 = bpen.bounds
# wordmark-only file: equal margin on every side of the ink
pad = cap * 0.2
write("wavelink-wordmark.svg", svg(f"{f(ink_x0 - pad)} {f(ink_y0 - pad)} {f(ink_x1 - ink_x0 + 2 * pad)} {f(ink_y1 - ink_y0 + 2 * pad)}", f'<path d="{word_d}"/>', "Wavelink", INK))

# ---------------------------------------------------------------- lockups
def symbol_scaled(d, bb, height):
    x0, y0, x1, y1 = bb
    s = height / (y1 - y0)
    return s, (x1 - x0) * s, (lambda tx, ty: f'<g transform="translate({f(tx - x0 * s)} {f(ty - y0 * s)}) scale({f(s)})"><path d="{d}"/></g>')


def horizontal(d, bb, sym_fill, word_fill, name, title):
    # symbol height = 1.2 x cap height, centred on the cap height; gap = 0.3 x symbol height
    sh = cap * 1.2
    s, sw, draw = symbol_scaled(d, bb, sh)
    gap = sh * 0.3
    top = -cap / 2 - sh / 2  # centre the symbol on the middle of the cap height (cap spans -cap..0)
    body = f'<g fill="{sym_fill}">{draw(0, top)}</g><g fill="{word_fill}" transform="translate({f(sw + gap)} 0)"><path d="{word_d}"/></g>'
    m = cap * 0.35
    y0, y1 = min(top, ink_y0), max(top + sh, ink_y1)
    vb = f"{f(-m)} {f(y0 - m)} {f(sw + gap + ink_x1 + 2 * m)} {f(y1 - y0 + 2 * m)}"
    write(name, f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')


def stacked(d, bb, sym_fill, word_fill, name, title):
    sh = cap * 2.6
    s, sw, draw = symbol_scaled(d, bb, sh)
    gap = cap * 0.55
    sx = (ink_x0 + ink_x1 - sw) / 2
    top = ink_y0 - gap - sh
    body = f'<g fill="{sym_fill}">{draw(sx, top)}</g><g fill="{word_fill}"><path d="{word_d}"/></g>'
    m = cap * 0.4
    vb = f"{f(ink_x0 - m)} {f(top - m)} {f(ink_x1 - ink_x0 + 2 * m)} {f(ink_y1 - top + 2 * m)}"
    write(name, f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')


horizontal(MASTER, MASTER_BBOX, GREEN, INK, "wavelink-horizontal.svg", "Wavelink")
horizontal(MASTER, MASTER_BBOX, INK, INK, "wavelink-horizontal-ink.svg", "Wavelink")
horizontal(REVERSED, REVERSED_BBOX, SIGNAL, WHITE, "wavelink-horizontal-reversed.svg", "Wavelink")
horizontal(REVERSED, REVERSED_BBOX, WHITE, WHITE, "wavelink-horizontal-white.svg", "Wavelink")
stacked(MASTER, MASTER_BBOX, GREEN, INK, "wavelink-stacked.svg", "Wavelink")
stacked(REVERSED, REVERSED_BBOX, SIGNAL, WHITE, "wavelink-stacked-reversed.svg", "Wavelink")

# app icon: white mark on a green rounded square
icon_body = place(SMALL, SMALL_BBOX, 256, 44, optical_lift=0.012)
write("wavelink-app-icon.svg",
      f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Wavelink"><title>Wavelink</title>'
      f'<rect width="256" height="256" rx="58" fill="{GREEN}"/><g fill="{WHITE}">{icon_body}</g></svg>\n')
print(f"kit written to {OUT}  (cap {cap}, x-height {xh}, upem {upem}, word width {f(word_w)})")
