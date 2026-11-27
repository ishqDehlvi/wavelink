"""Score + foley for the Wavelink ad. Synthesized, seeded, 120 BPM, 25 s, 48 kHz stereo.
Every hit reads its time from ../cues.json, the same cue sheet the picture uses.
Writes ../assets/score_raw.wav; build_audio.sh normalises it to -14 LUFS.
"""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
C = json.loads((ROOT / "cues.json").read_text())
SR, DUR = 48000, float(C["duration"])
BEAT = 60 / C["bpm"]
N = int(SR * DUR)
rng = np.random.default_rng(11)
out = np.zeros((N, 2))


def add(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    out[i:i + len(sig), 0] += sig * gain * l
    out[i:i + len(sig), 1] += sig * gain * r


def env(n, a=0.005, d=0.2, s=0.0, hold=0.0, r=0.0):
    parts = [np.linspace(0, 1, max(int(a * SR), 1)), np.linspace(1, s, max(int(d * SR), 1)),
             np.full(int(hold * SR), s), np.linspace(s, 0, max(int(r * SR), 1))]
    e = np.concatenate(parts)
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def osc(f, dur, kind="sine", det=0.0):
    t = np.arange(int(dur * SR)) / SR
    ph = 2 * np.pi * f * (1 + det) * t
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    return 2 * ((f * (1 + det) * t) % 1) - 1


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def hp(x, fc):
    return x - lp(x, fc)


def hz(n):
    k = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    return 440 * 2 ** ((k[n[:-1]] + (int(n[-1]) - 4) * 12) / 12)


# ---------------------------------------------------------------- foley building blocks
def slap(gain=0.5, bright=3200, pan=0.0, t=0.0):
    """paper sticker landing: soft thump + papery crinkle"""
    n = int(0.16 * SR)
    tt = np.arange(n) / SR
    thump = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-tt * 40) + 70) / SR) * env(n, a=0.001, d=0.09)
    crinkle = hp(rng.standard_normal(n), 900)
    crinkle = lp(crinkle, bright) * env(n, a=0.0008, d=0.06) * (0.6 + 0.4 * np.sin(2 * np.pi * 90 * tt))
    add(thump * 0.8 + crinkle * 0.55, t, gain, pan)


def stamp_hit(t, gain=0.9):
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(95 * np.exp(-tt * 14) + 42) / SR) * env(n, a=0.001, d=0.45)
    knock = lp(rng.standard_normal(n), 1800) * env(n, a=0.0005, d=0.05)
    add(boom * 0.9 + knock * 0.6, t, gain)


def whoosh(t0, t1, gain, rise=True):
    n = int((t1 - t0) * SR)
    w = lp(rng.standard_normal(n), 2200)
    shape = np.linspace(0, 1, n) ** (2.2 if rise else 0.5)
    w *= np.sin(np.pi * np.linspace(0, 1, n)) * (shape if rise else shape[::-1])
    add(w, t0, gain)


def tick(t, gain=0.06):
    n = int(0.016 * SR)
    add(hp(rng.standard_normal(n), 2600) * env(n, a=0.0005, d=0.014), t, gain, 0.15)


def chime(t, notes, gain=0.1, step=0.09, dur=0.8):
    for i, nt in enumerate(notes):
        s = (osc(hz(nt), dur) + 0.25 * osc(hz(nt) * 2, dur)) * env(int(dur * SR), a=0.002, d=dur - 0.02)
        add(s, t + i * step, gain, -0.2 + 0.4 * i / max(1, len(notes) - 1))


# ---------------------------------------------------------------- music bed
# hook: low pulse building under the pile-up, resolves on the cut to green
pulse = osc(hz("D2"), 3.5, "saw") * 0.5 + osc(hz("D2"), 3.5, "saw", 0.004) * 0.5
add(lp(pulse, 420) * env(len(pulse), a=0.3, d=0.1, s=1.0, hold=2.9, r=0.2), 0.0, 0.13)

CHORDS = [["D3", "F#3", "A3", "C#4", "E4"], ["B2", "D3", "F#3", "A3", "D4"], ["G2", "B2", "D3", "F#3", "A3"], ["A2", "C#3", "E3", "G3", "B3"]]
t0, k = 3.5, 0
while t0 < 19.4:
    ln = min(2.0, 19.4 - t0)
    for j, nt in enumerate(CHORDS[k % 4]):
        p = (osc(hz(nt), ln + 0.4, "tri") + osc(hz(nt), ln + 0.4, "tri", 0.003)) * 0.5
        add(p * env(len(p), a=0.2, d=0.2, s=0.7, hold=ln - 0.4, r=0.4), t0, 0.04, -0.5 + j * 0.25)
    b = osc(hz(CHORDS[k % 4][0]) / 2, ln) * env(int(ln * SR), a=0.01, d=0.3, s=0.6, hold=ln - 0.5, r=0.19)
    add(b, t0, 0.22)
    t0 += 2.0
    k += 1
# soft kick on beats, shaker on off-beats (3.5 -> 19.4), a breath for the split and the close
for b in np.arange(3.5, 19.4, BEAT):
    if 14.5 <= b < 15.0:
        continue
    n = int(0.22 * SR)
    tt = np.arange(n) / SR
    kk = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-tt * 30) + 46) / SR) * env(n, a=0.002, d=0.21)
    add(kk, b, 0.3 if (b - 3.5) % 2 < 0.01 else 0.2)
for b in np.arange(7.25, 19.4, BEAT):
    n = int(0.06 * SR)
    add(hp(rng.standard_normal(n), 5000) * env(n, a=0.002, d=0.05), b, 0.05, 0.35)
# marimba-ish plucks during the brief and the voice note
arp = ["A4", "D5", "F#5", "A5", "E5", "F#5", "D5", "A4"]
for i, t in enumerate(np.arange(7.0, 15.0, BEAT / 2)):
    pl = osc(hz(arp[i % 8]), 0.3, "sine") * env(int(0.3 * SR), a=0.002, d=0.28)
    add(pl, t, 0.04, 0.4 if i % 2 else -0.4)

# ---------------------------------------------------------------- scene 1: buzz + slaps + roll ticks, the grow
s1 = C["s1"]
for i, t in enumerate(s1["slaps"]):
    slap(0.55, 2600 + 300 * (i % 3), -0.4 + 0.13 * i, t)
    n = int(0.1 * SR)
    tt = np.arange(n) / SR
    buzz = np.sign(np.sin(2 * np.pi * 160 * tt)) * env(n, a=0.003, d=0.09)
    add(lp(buzz, 800), t - 0.03, 0.06)
for i in range(12):
    tick(s1["roll"][0] + (s1["roll"][1] - s1["roll"][0]) * (i / 12) ** 1.6, 0.05)
whoosh(*s1["grow"], 0.28)

# ---------------------------------------------------------------- scene 2: slams, typing, tap, iris
s2 = C["s2"]
stamp_hit(s2["ask"], 0.55)
stamp_hit(s2["once"], 0.5)
slap(0.35, 2000, 0.0, s2["pill"])
n_chars = 34
for i in range(n_chars):
    tick(s2["type"][0] + (s2["type"][1] - s2["type"][0]) * i / n_chars, 0.06)
slap(0.3, 2400, 0.3, s2["hand"][1])
tick(s2["tap"], 0.35)
chime(s2["tap"] + 0.02, ["A5"], 0.06, dur=0.4)
whoosh(*s2["iris"], 0.24)

# ---------------------------------------------------------------- scene 3: stickers, the stamp, the peel, the push
s3 = C["s3"]
for key, pan in (("invoice", -0.5), ("voice", 0.0), ("clock", 0.2), ("sticky", 0.4), ("team", 0.5)):
    slap(0.55, 3000, pan, s3[key])
for key in ("priya", "sam", "arjun"):
    slap(0.22, 4200, 0.1, s3[key])
whoosh(s3["stamp"][0], s3["stamp"][1], 0.12)
stamp_hit(s3["stamp"][1], 0.8)
n = int(0.35 * SR)
peel = hp(rng.standard_normal(n), 1500) * env(n, a=0.05, d=0.3) * np.linspace(1, 0.2, n)
add(lp(peel, 5000), s3["peel"], 0.18, 0.5)
whoosh(*s3["push"], 0.3)

# ---------------------------------------------------------------- scene 4: voice texture, collapse, words, split
s4 = C["s4"]
n = int((s4["wave"][1] - s4["wave"][0]) * SR)
tt = np.arange(n) / SR
voice = lp(rng.standard_normal(n), 1100) * (0.5 + 0.5 * np.sin(2 * np.pi * 5.3 * tt) * np.sin(2 * np.pi * 1.7 * tt))
add(voice * env(n, a=0.05, d=0.05, s=1.0, hold=n / SR - 0.2, r=0.1), s4["wave"][0], 0.3)
whoosh(s4["collapse"] - 0.1, s4["collapse"] + 0.15, 0.15, rise=False)
for i in range(22):
    tick(s4["words"][0] + (s4["words"][1] - s4["words"][0]) * i / 22, 0.045)
slap(0.45, 3000, 0.2, s4["en"])
whoosh(*s4["split"], 0.26)

# ---------------------------------------------------------------- scene 5: approve, stamp, fold, fly, land, push
s5 = C["s5"]
slap(0.3, 2400, 0.3, s5["approve"])
slap(0.3, 2400, 0.4, s5["hand"][1])
tick(s5["tap"], 0.4)
whoosh(s5["stamp"][0] - 0.1, s5["stamp"][1], 0.12)
stamp_hit(s5["stamp"][1], 0.9)
chime(s5["stamp"][1] + 0.05, ["E6", "A6"], 0.09, 0.12)
n = int(0.25 * SR)
add(hp(rng.standard_normal(n), 2500) * env(n, a=0.01, d=0.22), s5["fold"][0], 0.14)
whoosh(*s5["fly"], 0.3)
slap(0.25, 2000, 0.5, s5["phone"][1])
chime(s5["land"], ["A5", "D6"], 0.09, 0.1, 0.7)
tick(s5["ticks"], 0.2)
tick(s5["ticks"] + 0.08, 0.2)
whoosh(*s5["push"], 0.3)

# ---------------------------------------------------------------- scene 6: draw, dot, iris, lockup, edges, final chord
s6 = C["s6"]
for i, t in enumerate(np.linspace(*s6["draw"], 6)):
    sh = osc(hz(["D6", "F#6", "A6", "D7", "A6", "F#6"][i]), 0.5) * env(int(0.5 * SR), a=0.002, d=0.45)
    add(sh, t, 0.03, -0.5 + i * 0.2)
n = int(0.18 * SR)
tt = np.arange(n) / SR
pop = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-tt * 30) + 300) / SR) * env(n, a=0.001, d=0.15)
add(pop, s6["dot"], 0.25)
whoosh(*s6["iris"], 0.2)
for i, t in enumerate(s6["edges"]):
    slap(0.35, 3000, -0.6 + 0.2 * i, t)
final = ["D3", "A3", "D4", "F#4", "A4", "E5"]
for j, nt in enumerate(final):
    p = (osc(hz(nt), 5.0, "tri") + osc(hz(nt), 5.0, "tri", 0.002)) * 0.5
    add(p * env(len(p), a=0.05, d=0.6, s=0.6, hold=3.2, r=1.0), 19.9, 0.06, -0.6 + j * 0.24)
add(osc(hz("D2"), 5.0) * env(int(5.0 * SR), a=0.01, d=0.8, s=0.5, hold=3.0, r=1.0), 19.9, 0.25)

fade = np.ones(N)
fi = int(23.9 * SR)
fade[fi:] = np.linspace(1, 0, N - fi)
out *= fade[:, None]
out = np.tanh(out * 1.1) / np.tanh(1.1)
pcm = (np.clip(out, -1, 1) * 32767).astype("<i2")
(ROOT / "assets").mkdir(exist_ok=True)
with wave.open(str(ROOT / "assets" / "score_raw.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
(ROOT / "beats.json").write_text(json.dumps({"bpm": C["bpm"], "beats": [round(b, 3) for b in np.arange(0, DUR, BEAT)], "cues": C}, indent=1))
print("score_raw.wav written")
