"""Builds the Wavelink ad in two HyperFrames projects from one source:
    landscape/index.html (1920x1080) and vertical/index.html (1080x1920)
Layout differs per aspect (tables L16 / L9 below); scenes, timing (cues.json) and motion (src/ad.js) are shared.
    python3 build.py
"""
import json
import re
import shutil
from pathlib import Path

HERE = Path(__file__).parent
CUES = json.loads((HERE / "cues.json").read_text())
brand = (HERE.parent.parent / "website" / "src" / "lib" / "brand.ts").read_text()
SYM_VB, SYM_D = re.search(r'export const SYMBOL = \{ viewBox: "([^"]+)", d: "([^"]+)"', brand).groups()
SMALL_VB, SMALL_D = re.search(r'export const SYMBOL_SMALL = \{ viewBox: "([^"]+)", d: "([^"]+)"', brand).groups()
DIMS = {"bubble-green": (900, 549), "bubble-ink": (900, 685), "calendar": (764, 900), "chai": (776, 900), "check": (900, 900),
        "clock": (812, 900), "coin": (900, 896), "hand": (629, 900), "invoice": (759, 900), "mic": (486, 900), "phone": (587, 900),
        "plane": (900, 742), "stamp": (773, 900), "sticky": (790, 900), "team": (900, 688), "voice": (900, 672)}
MARK_ASPECT = 126.01 / 236.24

DRAFT = "Hi Priya, sorry for the delay. Payment goes out tomorrow morning."
HINGLISH = "Bhai, 5 baje wali meeting thodi late kar sakte hain? Saade paanch? Venue ab Park Street office hai."
ENGLISH = "Can we push 5 pm to 5:30? The venue is now the Park Street office."

# ---------------------------------------------------------------- layout tables (px, top-left unless noted; rot in degrees)
L16 = {
    "W": 1920, "H": 1080,
    "s1": {"head": (120, 250, 150), "badge": (1500, 530, 540),
           "st": [("voice", 1080, 110, 380, -9), ("invoice", 1560, 610, 400, 12), ("bubble-ink", 920, 690, 420, 6), ("clock", 1630, 70, 250, 14),
                  ("team", 1450, 860, 330, -7), ("sticky", 820, 40, 230, -14), ("chai", 700, 820, 230, 8)],
           "bhai": (0.17, 0.2, 78)},
    "s2": {"ask": (120, 150, 250), "once": (120, 365, 250), "sub": (128, 660, 38, 1100), "pill": (120, 770, 1100, 132, 40),
           "hand": (1080, 840, 230, -16)},
    "s3": {"head": (120, 110, 150), "invoice": (150, 520, 420, -6), "overdue": (190, 650, 80, -12),
           "priya": (420, 900, 30, 3), "voice": (760, 470, 400, 5), "clock": (1040, 380, 200, 12), "sam": (800, 770, 30, -3),
           "sticky": (1310, 300, 360, 7), "stickytxt": (0.14, 0.3, 58, 0.7), "arjun": (1370, 700, 30, 4),
           "team": (1440, 820, 300, -18), "sales": (1660, 960, 24, -8), "stamp": (60, 260, 340, -20),
           "tapes": [(330, 505, -8), (1430, 285, 10)], "push": (1008, 605)},
    "s4": {"head": (120, 100, 110), "bars": (160, 540, 1600, 300, 56), "rule": (160, 536, 1600, 8), "words": (160, 515, 1600, 58),
           "en": (160, 590, 34)},
    "s5": {"head": (120, 100, 110), "rule": (160, 536, 1600, 8), "draft": (160, 515, 1250, 60), "npill": (160, 578, 26),
           "btn": (1460, 560, 300, 96, 34), "hand": (1560, 600, 200, -6), "stamp": (1060, 80, 340, -18), "sent": (1000, 300, 110, -10),
           "plane": (960, 400, 360), "phone": (1300, 90, 440, 900), "bin": (40, 300, 340, 25), "bout": (60, 470, 340), "push": (1544, 677)},
    "s6": {"mark": (170, 330, 380), "word": (602, 300, 240), "tag": (176, 620, 86, 1400), "pills": (176, 850, 30), "big": (960, 520, 900),
           "edges": [("check", 1560, 90, 280, 12), ("plane", 1500, 520, 340, -8), ("chai", 1600, 780, 260, 10), ("coin", 1290, 860, 180, -14),
                     ("clock", 1180, 70, 200, -10), ("voice", -60, 40, 300, 14), ("stamp", -40, 860, 260, -20)]},
}
L9 = {
    "W": 1080, "H": 1920,
    "s1": {"head": (76, 170, 120), "badge": (560, 1130, 500),
           "st": [("voice", 60, 760, 360, -9), ("invoice", 690, 1240, 330, 12), ("bubble-ink", 30, 1380, 380, 6), ("clock", 760, 640, 230, 14),
                  ("team", 600, 1620, 340, -7), ("sticky", 840, 900, 200, -14), ("chai", 60, 1690, 220, 8)],
           "bhai": (0.17, 0.2, 70)},
    "s2": {"ask": (76, 470, 270), "once": (76, 700, 270), "sub": (82, 1030, 40, 920), "pill": (50, 1170, 980, 132, 30),
           "hand": (900, 1240, 220, -16)},
    "s3": {"head": (76, 150, 128), "invoice": (60, 560, 400, -6), "overdue": (80, 700, 76, -12),
           "priya": (250, 1000, 30, 3), "voice": (560, 520, 420, 5), "clock": (860, 440, 180, 12), "sam": (600, 860, 30, -3),
           "sticky": (80, 1160, 360, 7), "stickytxt": (0.14, 0.3, 56, 0.7), "arjun": (110, 1520, 30, 4),
           "team": (600, 1250, 330, -18), "sales": (760, 1560, 24, -8), "stamp": (-10, 300, 320, -20),
           "tapes": [(230, 545, -8), (200, 1145, 10)], "push": (820, 661)},
    "s4": {"head": (76, 200, 120), "bars": (80, 960, 920, 320, 40), "rule": (80, 956, 920, 8), "words": (80, 935, 920, 54),
           "en": (60, 1010, 30)},
    "s5": {"head": (76, 200, 120), "rule": (80, 956, 920, 8), "draft": (80, 935, 920, 56), "npill": (80, 998, 26),
           "btn": (700, 1000, 300, 96, 34), "hand": (795, 1040, 200, -6), "stamp": (500, 360, 320, -18), "sent": (470, 610, 100, -10),
           "plane": (540, 760, 340), "phone": (280, 720, 520, 1060), "bin": (40, 330, 420, 25), "bout": (60, 540, 420), "push": (564, 1356)},
    "s6": {"mark": (80, 620, 440), "word": (72, 880, 210), "tag": (80, 1140, 84, 920), "pills": (80, 1400, 30), "big": (540, 900, 860),
           "edges": [("check", 760, 180, 260, 12), ("plane", 540, 1420, 300, -8), ("chai", 800, 1670, 230, 10), ("coin", 80, 1680, 170, -14),
                     ("clock", 80, 200, 200, -10), ("voice", 380, 70, 300, 14)]},
}


def hgt(name, w):
    W, H = DIMS[name]
    return w * H / W


def mark(vb=SMALL_VB, d=SMALL_D, cls="mark", style=""):
    return f'<svg class="{cls}" viewBox="{vb}" style="{style}"><path d="{d}"/></svg>'


def sticker(sid, name, x, y, w, rot, over=""):
    return (f'<div class="st" id="{sid}" data-rot="{rot}" style="left:{x}px;top:{y}px;width:{w}px">'
            f'<img src="stickers/{name}.png" alt="">{over}</div>')


def lines(*parts, cls="display"):
    return "".join(f'<span class="line"><span>{p}</span></span>' for p in parts)


def html(L, cls):
    W, H = L["W"], L["H"]
    s1, s2, s3, s4, s5, s6 = (L[k] for k in ("s1", "s2", "s3", "s4", "s5", "s6"))
    # scene 1
    hx, hy, hf = s1["head"]
    bx, by, bd = s1["badge"]
    sts = []
    for i, (name, x, y, w, rot) in enumerate(s1["st"]):
        over = ""
        if name == "bubble-ink":
            fx, fy, fs = s1["bhai"]
            over = f'<span class="over w" data-layout-allow-occlusion style="left:{fx * 100}%;top:{fy * 100}%;font-size:{fs}px">bhai??</span>'
        sts.append(sticker(f"s1-st{i}", name, x, y, w, rot, over))
    S1 = f"""
      <section id="s1" class="scene paper clip" data-start="{CUES['scenes']['s1'][0]}" data-duration="{CUES['scenes']['s1'][1] - CUES['scenes']['s1'][0]}" data-track-index="1">
        <div class="world" id="s1-world">
          <h1 class="display abs" id="s1-head" style="left:{hx}px;top:{hy}px;font-size:{hf}px;z-index:5">{lines('Your', 'WhatsApp,', '<span class="g">this morning.</span>')}</h1>
          {''.join(sts)}
          <div class="badge" id="badge" style="left:{bx - bd / 2}px;top:{by - bd / 2}px;width:{bd}px;height:{bd}px;z-index:3"><span class="num" id="badge-num" data-layout-allow-occlusion style="font-size:{bd * 0.6}px">47</span></div>
        </div>
      </section>"""
    # scene 2
    ax, ay, af = s2["ask"]
    ox, oy, of = s2["once"]
    sx, sy, sf, sw = s2["sub"]
    px, py, pw, ph, pf = s2["pill"]
    hx2, hy2, hw2, hr2 = s2["hand"]
    send_cx, send_cy = px + pw - 22 - 42, py + ph / 2
    S2 = f"""
      <section id="s2" class="scene greenbg clip" data-start="{CUES['scenes']['s2'][0]}" data-duration="{CUES['scenes']['s2'][1] - CUES['scenes']['s2'][0]}" data-track-index="1">
        <div class="display abs w" id="s2-ask" style="left:{ax}px;top:{ay}px;font-size:{af}px">Ask</div>
        <div class="display abs w" id="s2-once" style="left:{ox}px;top:{oy}px;font-size:{of}px">once.</div>
        <p class="abs" id="s2-sub" style="left:{sx}px;top:{sy}px;font-size:{sf}px;max-width:{sw}px;color:#e3f6ec;font-weight:600">In ChatGPT or Claude, with Wavelink connected.</p>
        <div class="pill" id="pill" style="left:{px}px;top:{py}px;width:{pw}px;height:{ph}px">
          <span class="chip">{mark()}Wavelink</span>
          <span class="q" id="q" style="font-size:{pf}px"></span>
          <span class="send" id="send"><svg width="38" height="38" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </div>
        {sticker('s2-hand', 'hand', hx2, hy2, hw2, hr2)}
        <div class="iris" id="iris1" style="left:{send_cx - 50}px;top:{send_cy - 50}px"></div>
      </section>"""
    # scene 3
    t3x, t3y, t3f = s3["head"]
    ix, iy, iw, ir = s3["invoice"]
    odx, ody, odf, odr = s3["overdue"]
    vx, vy, vw, vr = s3["voice"]
    cx_, cy_, cw_, cr_ = s3["clock"]
    kx, ky, kw, kr = s3["sticky"]
    ktx, kty, ktf, ktw = s3["stickytxt"]
    tx_, ty_, tw_, tr_ = s3["team"]
    stx, sty, stw, strr = s3["stamp"]

    def tag(tid, spec, main, sub):
        x, y, f, r = spec
        return f'<div class="tag" id="{tid}" data-rot="{r}" style="left:{x}px;top:{y}px;font-size:{f}px;z-index:7">{main}<small>{sub}</small></div>'
    tapes = "".join(f'<div class="tape" id="s3-tape{i}" data-rot="{r}" style="left:{x}px;top:{y}px;z-index:8"></div>' for i, (x, y, r) in enumerate(s3["tapes"]))
    S3 = f"""
      <section id="s3" class="scene paper clip" data-start="{CUES['scenes']['s3'][0]}" data-duration="{CUES['scenes']['s3'][1] - CUES['scenes']['s3'][0]}" data-track-index="1">
        <div class="world" id="s3-world">
          <h1 class="display abs" id="s3-head" style="left:{t3x}px;top:{t3y}px;font-size:{t3f}px;z-index:5">{lines("Here's what", '<span class="g">matters.</span>')}</h1>
          {sticker('s3-invoice', 'invoice', ix, iy, iw, ir)}
          <div class="imprint" id="s3-overdue" data-layout-allow-occlusion data-rot="{odr}" style="left:{odx}px;top:{ody}px;font-size:{odf}px;color:var(--stamp);border-color:var(--stamp);z-index:6">OVERDUE</div>
          {tag('s3-priya', s3['priya'], 'Priya Sharma · ₹48,400', 'wants it confirmed tonight')}
          {sticker('s3-voice', 'voice', vx, vy, vw, vr)}
          {sticker('s3-clock', 'clock', cx_, cy_, cw_, cr_)}
          {tag('s3-sam', s3['sam'], 'Sam · voice note', '5:30, Park Street office')}
          {sticker('s3-sticky', 'sticky', kx, ky, kw, kr, f'<span class="over" data-layout-allow-occlusion style="left:{ktx * 100}%;top:{kty * 100}%;width:{ktw * 100}%;font-size:{ktf}px">3 GST bills by the 20th</span>')}
          {tag('s3-arjun', s3['arjun'], 'Arjun (CA)', 'needs the purchase bills')}
          {sticker('s3-team', 'team', tx_, ty_, tw_, tr_)}
          {tag('s3-sales', s3['sales'], 'Sales team', 'can wait')}
          {tapes}
          {sticker('s3-stamp', 'stamp', stx, sty, stw, strr)}
        </div>
      </section>"""
    # scene 4
    h4x, h4y, h4f = s4["head"]
    brx, bry, brw, brh, brn = s4["bars"]
    rx, ry, rw, rh = s4["rule"]
    wx, wy, ww, wf = s4["words"]
    ex, ey, ef = s4["en"]
    bars = "".join(f'<i style="height:{brh}px"></i>' for _ in range(brn))
    words = "".join(f"<span>{w}</span>" for w in HINGLISH.split(" "))
    S4 = f"""
      <section id="s4" class="scene paper clip" data-start="{CUES['scenes']['s4'][0]}" data-duration="{CUES['scenes']['s4'][1] - CUES['scenes']['s4'][0]}" data-track-index="1">
        <div class="abs greenbg" id="s4-top" style="left:0;top:0;width:{W}px;height:{ry + rh / 2}px"></div>
        <div class="abs greenbg" id="s4-bot" style="left:0;top:{ry + rh / 2}px;width:{W}px;height:{H - ry - rh / 2}px"></div>
        <h1 class="display abs w" id="s4-head" style="left:{h4x}px;top:{h4y}px;font-size:{h4f}px">{lines('Voice notes?', 'Read them.')}</h1>
        <div class="bars" id="s4-bars" style="left:{brx}px;top:{bry - brh / 2}px;width:{brw}px;height:{brh}px">{bars}</div>
        <div class="rule" id="s4-rule" style="left:{rx}px;top:{ry}px;width:{rw}px;height:{rh}px;background:#fff"></div>
        <div class="words w" id="s4-words" style="left:{wx}px;bottom:{H - wy}px;width:{ww}px;font-size:{wf}px">{words}</div>
        <div class="tag" id="s4-en" data-rot="-2" style="left:{ex}px;top:{ey}px;font-size:{ef}px;white-space:normal;max-width:{W - 2 * ex}px"><span class="en">EN</span>{ENGLISH}</div>
      </section>"""
    # scene 5
    h5x, h5y, h5f = s5["head"]
    r5x, r5y, r5w, r5h = s5["rule"]
    dx_, dy_, dw_, df_ = s5["draft"]
    nx, ny, nf = s5["npill"]
    btx, bty, btw, bth, btf = s5["btn"]
    hx5, hy5, hw5, hr5 = s5["hand"]
    sx5, sy5, sw5, sr5 = s5["stamp"]
    snx, sny, snf, snr = s5["sent"]
    plx, ply, plw = s5["plane"]
    phx, phy, phw, phh = s5["phone"]
    bix, biy, biw, bif = s5["bin"]
    box_, boy, bow = s5["bout"]
    dwords = "".join(f"<span>{w}</span>" for w in DRAFT.split(" "))
    S5 = f"""
      <section id="s5" class="scene paper clip" data-start="{CUES['scenes']['s5'][0]}" data-duration="{CUES['scenes']['s5'][1] - CUES['scenes']['s5'][0]}" data-track-index="1">
        <div class="world" id="s5-world">
          <h1 class="display abs" id="s5-head" style="left:{h5x}px;top:{h5y}px;font-size:{h5f}px">{lines('You approve.', 'Then it <span class="g">sends.</span>')}</h1>
          <div class="abs" id="s5-group" style="left:0;top:0;width:{W}px;height:{H}px">
            <div class="rule" id="s5-rule" style="left:{r5x}px;top:{r5y}px;width:{r5w}px;height:{r5h}px;background:var(--green)"></div>
            <div class="words" id="s5-draft" data-layout-allow-overlap style="left:{dx_}px;bottom:{H - dy_}px;width:{dw_}px;font-size:{df_}px">{dwords}</div>
            <div class="npill" id="s5-npill" style="left:{nx}px;top:{ny}px;font-size:{nf}px">Not sent</div>
            <div class="btn" id="s5-btn" style="left:{btx}px;top:{bty}px;width:{btw}px;height:{bth}px;font-size:{btf}px">Approve</div>
            <div class="imprint" id="s5-sent" data-layout-allow-overlap data-layout-allow-occlusion data-rot="{snr}" style="left:{snx}px;top:{sny}px;font-size:{snf}px;color:var(--green);border-color:var(--green)">SENT ✓</div>
          </div>
          {sticker('s5-hand', 'hand', hx5, hy5, hw5, hr5)}
          {sticker('s5-stamp', 'stamp', sx5, sy5, sw5, sr5)}
          {sticker('s5-plane', 'plane', plx - plw / 2, ply - hgt('plane', plw) / 2, plw, -8)}
          <div class="phone" id="s5-phone" style="left:{phx}px;top:{phy}px;width:{phw}px;height:{phh}px"><div class="screen">
            <div class="ph-head"><span class="av">PS</span><b>Priya Sharma</b></div>
            <div class="bub in" style="left:{bix}px;top:{biy}px;width:{biw}px">Can you confirm by tonight?</div>
            <div class="bub out" id="s5-bubble" style="left:{box_}px;top:{boy}px;width:{bow}px">{DRAFT}<span class="ticks" id="s5-ticks">✓✓</span></div>
          </div></div>
        </div>
      </section>"""
    # scene 6
    mx, my, mw = s6["mark"]
    mh = mw * MARK_ASPECT
    wdx, wdy, wdf = s6["word"]
    tgx, tgy, tgf, tgw = s6["tag"]
    pix, piy, pif = s6["pills"]
    bigx, bigy, bigw = s6["big"]
    edges = "".join(sticker(f"s6-e{i}", n, x, y, w, r) for i, (n, x, y, w, r) in enumerate(s6["edges"]))
    tagwords = " ".join(f"<span>{w}</span>" for w in "Your WhatsApp, inside ChatGPT and Claude.".split(" "))
    S6 = f"""
      <section id="s6" class="scene greenbg clip" data-start="{CUES['scenes']['s6'][0]}" data-duration="{CUES['scenes']['s6'][1] - CUES['scenes']['s6'][0]}" data-track-index="1">
        <div class="iris" id="iris2" style="left:{bigx - 50}px;top:{bigy - 50}px"></div>
        {edges}
        <svg class="draw" id="s6-mark" viewBox="{SYM_VB}" style="left:{mx}px;top:{my}px;width:{mw}px;height:{mh}px;z-index:5">
          <path class="stroke" id="s6-stroke" pathLength="1" stroke="#ffffff" d="M45.45 80 L66.4 158.21 A24 24 0 1 0 112.77 158.21 L118.34 137.41 A10 10 0 0 1 137.66 137.41 L143.23 158.21 A24 24 0 1 0 189.6 158.21 L205.19 100" />
          <path id="s6-solid" fill="#0e9f67" d="{SYM_D}" />
          <circle id="s6-dot" cx="251.69" cy="100" r="15" fill="#ffffff" />
        </svg>
        <div class="display abs" style="left:{wdx}px;top:{wdy}px;font-size:{wdf}px;font-weight:700;letter-spacing:-0.045em;overflow:hidden;padding-bottom:0.12em;z-index:5"><span id="s6-word" style="display:block">Wavelink</span></div>
        <div class="display abs" id="s6-tag" style="left:{tgx}px;top:{tgy}px;font-size:{tgf}px;font-weight:700;letter-spacing:-0.035em;line-height:1.02;max-width:{tgw}px;z-index:5">{tagwords}</div>
        <div class="foot" id="s6-pills" style="left:{pix}px;top:{piy}px;font-size:{pif}px;z-index:5"><span style="background:var(--green);color:#fff">Open source</span><span style="border:2px solid #c9c2b3">On your own server</span></div>
      </section>"""
    move = {"dx": bigx - (mx + mw / 2), "dy": bigy - (my + mh / 2), "s": bigw / mw}
    layout_js = json.dumps({"W": W, "H": H, "badge": s1["badge"], "s3push": s3["push"], "s5push": s5["push"], "move": move,
                            "planeTo": [box_ + phx + 14 + bow / 2, boy + phy + 14 + 90], "planeFrom": [plx, ply],
                            "phoneFrom": "right" if W > H else "bottom"})
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Wavelink ad {W}x{H}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Bricolage"; src: url("fonts/bricolage-latin.woff2") format("woff2"); font-weight: 200 800; }}
      @font-face {{ font-family: "Bricolage"; src: url("fonts/bricolage-ext.woff2") format("woff2"); font-weight: 200 800; unicode-range: U+20B9; }}
      @font-face {{ font-family: "Inter"; src: url("fonts/inter.woff2") format("woff2"); font-weight: 100 900; }}
      html, body {{ width: {W}px; height: {H}px; }}
    </style>
    <link rel="stylesheet" href="ad.css" />
  </head>
  <body class="{cls}">
    <div id="root" data-composition-id="main" data-start="0" data-duration="{CUES['duration']}" data-width="{W}" data-height="{H}">
      <audio id="score" src="score.wav" data-start="0" data-duration="{CUES['duration']}" data-volume="1" data-track-index="9"></audio>
      {S1}{S2}{S3}{S4}{S5}{S6}
      <div id="grain" class="clip" data-start="0" data-duration="{CUES['duration']}" data-track-index="8"></div>
      <div id="vig" class="clip" data-start="0" data-duration="{CUES['duration']}" data-track-index="7"></div>
    </div>
    <script>window.CUES = {json.dumps(CUES)}; window.L = {layout_js};</script>
    <script src="ad.js"></script>
  </body>
</html>
"""


for folder, L, cls in (("landscape", L16, "h"), ("vertical", L9, "v")):
    d = HERE / folder
    d.mkdir(exist_ok=True)
    if folder == "vertical":
        for f in ("hyperframes.json", "package.json", "meta.json"):
            shutil.copy(HERE / "landscape" / f, d / f)
    for sub in ("stickers", "fonts"):
        shutil.rmtree(d / sub, ignore_errors=True)
        shutil.copytree(HERE / sub, d / sub, ignore=shutil.ignore_patterns("raw"))
    shutil.copy(HERE / "src" / "ad.css", d / "ad.css")
    shutil.copy(HERE / "src" / "ad.js", d / "ad.js")
    shutil.copy(HERE / "assets" / "score.wav", d / "score.wav")
    (d / "index.html").write_text(html(L, cls))
    print("wrote", folder + "/index.html")
