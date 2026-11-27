/* Wavelink ad timeline. One paused root timeline; every frame is a pure function of time.
   Timing comes from window.CUES (cues.json, shared with the score), positions from window.L (build.py layout).
   Match cuts: 47 badge -> green field · send button -> paper iris · voice sticker waveform -> big waveform ·
   waveform -> one line -> split -> the draft's underline · sent bubble -> green field -> the W. */
(function () {
  const C = window.CUES, L = window.L;
  const tl = gsap.timeline({ paused: true });
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const R = (el) => Number((typeof el === "string" ? $(el) : el).dataset.rot || 0);
  const coverScale = (cx, cy, size) => (2 * Math.max(Math.hypot(cx, cy), Math.hypot(L.W - cx, cy), Math.hypot(cx, L.H - cy), Math.hypot(L.W - cx, L.H - cy))) / size + 0.2;

  // ---------------------------------------------------------------- motion vocabulary
  const slap = (sel, t, dur = 0.34) => {
    const el = typeof sel === "string" ? $(sel) : sel;
    const r = R(el);
    tl.fromTo(el, { scale: 1.38, rotation: r - 12, y: -26, opacity: 0 }, { scale: 1, rotation: r, y: 0, opacity: 1, duration: dur, ease: "back.out(2.4)" }, t);
  };
  const pop = (sel, t) => {
    const el = $(sel);
    const r = R(el);
    tl.fromTo(el, { scale: 0.82, rotation: r + 7, y: 18, opacity: 0 }, { scale: 1, rotation: r, y: 0, opacity: 1, duration: 0.32, ease: "back.out(2.2)" }, t);
  };
  const lines = (sel, t, stagger = 0.12) => tl.fromTo(`${sel} .line > span`, { yPercent: 112 }, { yPercent: 0, duration: 0.6, ease: "power4.out", stagger }, t);
  const shake = (sel, t) => tl.to(sel, { keyframes: { x: [0, -12, 9, -6, 3, 0], y: [0, 7, -5, 3, -1, 0] }, duration: 0.3, ease: "none" }, t);
  const stampDrop = (sel, [t0, t1, t2]) => {
    const r = R(sel);
    tl.fromTo(sel, { y: -1100, rotation: r - 12 }, { y: 0, rotation: r, duration: t1 - t0, ease: "power3.in" }, t0);
    tl.to(sel, { scaleY: 0.9, duration: 0.06, ease: "power2.out", transformOrigin: "50% 100%" }, t1);
    tl.to(sel, { scaleY: 1, duration: 0.1, ease: "power2.out" }, t1 + 0.06);
    tl.to(sel, { y: -1100, rotation: r + 10, duration: t2 - t1, ease: "power2.in" }, t1 + 0.12);
  };
  // counter as rolling digit strips (no callbacks): finalStr, digit sequences supplied per column
  const roll = (el, columns, t, dur, ease) => {
    el.textContent = "";
    columns.forEach((seq) => {
      const box = document.createElement("span");
      box.className = "dg";
      const strip = document.createElement("span");
      strip.className = "strip";
      seq.forEach((d) => {
        const b = document.createElement("b");
        b.textContent = d;
        b.setAttribute("data-layout-allow-occlusion", "");
        strip.appendChild(b);
      });
      box.appendChild(strip);
      el.appendChild(box);
      tl.fromTo(strip, { yPercent: 0 }, { yPercent: (-100 * (seq.length - 1)) / seq.length, duration: dur, ease }, t);
    });
  };
  // seeded noise (mulberry32) for the waveform
  const rand = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------- 1 · the morning pile-up (macro badge, pull back)
  const s1 = C.s1;
  const [bx, by, bd] = L.badge;
  tl.fromTo("#s1-world", { scale: 2.8 }, { scale: 1, duration: s1.pull[1] - s1.pull[0], ease: "expo.out", transformOrigin: `${bx}px ${by}px` }, s1.pull[0]);
  const ones = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let l = 0; l < 3; l++) for (let d = 0; d < 10; d++) ones.push(String(d));
  for (let d = 0; d <= 7; d++) ones.push(String(d));
  roll($("#badge-num"), [[" ", "1", "2", "3", "4"], ones], s1.roll[0], s1.roll[1] - s1.roll[0], "power3.inOut");
  $$("#s1 .st").forEach((el, i) => slap(el, s1.slaps[i]));
  lines("#s1-head", s1.head);
  // match cut 1: the badge swells into the green field, stickers blown outward
  tl.set("#badge", { zIndex: 30 }, s1.grow[0]);
  tl.to("#badge-num", { opacity: 0, duration: 0.15 }, s1.grow[0]);
  tl.to("#badge", { scale: coverScale(bx, by, bd), duration: s1.grow[1] - s1.grow[0], ease: "power3.in" }, s1.grow[0]);
  $$("#s1 .st").forEach((el) => {
    const cx = parseFloat(el.style.left) + parseFloat(el.style.width) / 2;
    const cy = parseFloat(el.style.top) + parseFloat(el.style.width) / 2;
    const len = Math.hypot(cx - bx, cy - by) || 1;
    tl.to(el, { x: ((cx - bx) / len) * 900, y: ((cy - by) / len) * 900, rotation: R(el) + 30, duration: 0.5, ease: "power2.in" }, s1.grow[0] + 0.03);
  });
  tl.to("#s1-head", { x: -260, opacity: 0, duration: 0.4, ease: "power2.in" }, s1.grow[0]);

  // ---------------------------------------------------------------- 2 · ask once (green field)
  const s2 = C.s2;
  tl.fromTo("#s2-ask", { scale: 1.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "expo.out", transformOrigin: "0% 100%" }, s2.ask);
  tl.fromTo("#s2-once", { scale: 1.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "expo.out", transformOrigin: "0% 100%" }, s2.once);
  tl.fromTo("#s2-sub", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }, s2.sub);
  tl.fromTo("#pill", { y: 170, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, s2.pill);
  const q = $("#q");
  for (const ch of "What did I miss on WhatsApp today?") {
    const i = document.createElement("i");
    i.textContent = ch;
    q.appendChild(i);
  }
  tl.fromTo("#q i", { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: (s2.type[1] - s2.type[0]) / 34, ease: "none" }, s2.type[0]);
  tl.fromTo("#s2-hand", { x: 520, y: 460, rotation: R("#s2-hand") + 22 }, { x: 0, y: 0, rotation: R("#s2-hand"), duration: s2.hand[1] - s2.hand[0], ease: "power3.out" }, s2.hand[0]);
  tl.to("#s2-hand", { scale: 0.9, duration: 0.08, ease: "power2.in" }, s2.tap - 0.08);
  tl.to("#s2-hand", { scale: 1, duration: 0.25, ease: "back.out(3)" }, s2.tap);
  tl.to("#send", { scale: 0.82, duration: 0.08 }, s2.tap - 0.06);
  tl.to("#send", { scale: 1, duration: 0.25, ease: "back.out(3)" }, s2.tap + 0.02);
  // match cut 2: the send button opens an iris back onto paper
  const iris1 = $("#iris1");
  const ix = parseFloat(iris1.style.left) + 50, iy = parseFloat(iris1.style.top) + 50;
  tl.fromTo("#iris1", { scale: 0 }, { scale: coverScale(ix, iy, 100), duration: s2.iris[1] - s2.iris[0], ease: "power3.in" }, s2.iris[0]);

  // ---------------------------------------------------------------- 3 · here's what matters (the board)
  const s3 = C.s3;
  lines("#s3-head", s3.head);
  slap("#s3-invoice", s3.invoice);
  pop("#s3-tape0", s3.invoice + 0.12);
  stampDrop("#s3-stamp", s3.stamp);
  tl.fromTo("#s3-overdue", { scale: 1.3, rotation: R("#s3-overdue"), opacity: 0 }, { scale: 1, opacity: 0.9, duration: 0.12, ease: "power2.out" }, s3.stamp[1]);
  shake("#s3-world", s3.stamp[1]);
  pop("#s3-priya", s3.priya);
  slap("#s3-voice", s3.voice);
  slap("#s3-clock", s3.clock);
  pop("#s3-sam", s3.sam);
  slap("#s3-sticky", s3.sticky);
  pop("#s3-tape1", s3.sticky + 0.12);
  pop("#s3-arjun", s3.arjun);
  slap("#s3-team", s3.team);
  pop("#s3-sales", s3.team + 0.15);
  tl.to(["#s3-team", "#s3-sales"], { x: 90, y: 70, rotation: "-=14", opacity: 0.36, duration: 0.5, ease: "power2.inOut" }, s3.peel);
  // match cut 3: dive into Sam's voice-note waveform
  const [p3x, p3y] = L.s3push;
  tl.set("#s3-world", { transformOrigin: `${p3x}px ${p3y}px` }, C.scenes.s3[0]);
  tl.to("#s3-world", { scale: 9, duration: s3.push[1] - s3.push[0], ease: "power3.in" }, s3.push[0]);

  // ---------------------------------------------------------------- 4 · the voice note becomes words (green field)
  const s4 = C.s4;
  lines("#s4-head", s4.head);
  const bars = $$("#s4-bars i");
  const rnd = rand(29);
  bars.forEach((b, i) => {
    const center = 1 - Math.abs(i / (bars.length - 1) - 0.5) * 1.3;
    const ks = Array.from({ length: 8 }, () => Math.max(0.08, (0.25 + 0.75 * rnd()) * center));
    tl.set(b, { scaleY: ks[0] }, s4.wave[0]);
    tl.to(b, { keyframes: { scaleY: ks }, duration: s4.wave[1] - s4.wave[0], ease: "none" }, s4.wave[0]);
  });
  tl.to(bars, { scaleY: 0.03, duration: 0.22, ease: "power3.in", stagger: { each: 0.004, from: "center" } }, s4.collapse);
  tl.fromTo("#s4-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power3.out", transformOrigin: "50% 50%" }, s4.collapse + 0.12);
  const w4 = $$("#s4-words span");
  tl.fromTo(w4, { y: -44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: "power3.out", stagger: (s4.words[1] - s4.words[0]) / w4.length }, s4.words[0]);
  slap("#s4-en", s4.en);
  // match cut 4: the field splits along the line; the line stays and turns green
  tl.to(["#s4-head", "#s4-words", "#s4-en", "#s4-bars"], { opacity: 0, y: -30, duration: 0.2, ease: "power2.in" }, s4.split[0]);
  tl.to("#s4-top", { yPercent: -101, duration: s4.split[1] - s4.split[0], ease: "power3.inOut" }, s4.split[0]);
  tl.to("#s4-bot", { yPercent: 101, duration: s4.split[1] - s4.split[0], ease: "power3.inOut" }, s4.split[0]);
  tl.to("#s4-rule", { backgroundColor: "#0e9f67", duration: 0.3, ease: "none" }, s4.split[0]);

  // ---------------------------------------------------------------- 5 · you approve, then it sends
  const s5 = C.s5;
  const w5 = $$("#s5-draft span");
  tl.fromTo(w5, { y: -36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: "power3.out", stagger: (s5.draft[1] - s5.draft[0]) / w5.length }, s5.draft[0]);
  pop("#s5-npill", s5.draft[1]);
  lines("#s5-head", s5.head);
  tl.fromTo("#s5-btn", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2.2)" }, s5.approve);
  tl.fromTo("#s5-hand", { x: 480, y: 560, rotation: R("#s5-hand") + 20 }, { x: 0, y: 0, rotation: R("#s5-hand"), duration: s5.hand[1] - s5.hand[0], ease: "power3.out" }, s5.hand[0]);
  tl.to("#s5-hand", { scale: 0.9, duration: 0.08, ease: "power2.in" }, s5.tap - 0.08);
  tl.to("#s5-hand", { scale: 1, duration: 0.25, ease: "back.out(3)" }, s5.tap);
  tl.to("#s5-btn", { scale: 0.9, backgroundColor: "#0a7a4c", duration: 0.08 }, s5.tap - 0.06);
  tl.to("#s5-btn", { scale: 1, duration: 0.25, ease: "back.out(3)" }, s5.tap + 0.02);
  tl.to("#s5-hand", { x: 420, y: 520, duration: 0.4, ease: "power2.in" }, s5.stamp[1] + 0.05);
  stampDrop("#s5-stamp", s5.stamp);
  tl.fromTo("#s5-sent", { scale: 1.3, rotation: R("#s5-sent"), opacity: 0 }, { scale: 1, opacity: 0.95, duration: 0.12, ease: "power2.out" }, s5.stamp[1]);
  tl.to("#s5-npill", { opacity: 0, duration: 0.15 }, s5.stamp[1]);
  shake("#s5-group", s5.stamp[1]);
  // the message folds into a paper plane and flies into Priya's chat
  const [pfx, pfy] = L.planeFrom;
  const [ptx, pty] = L.planeTo;
  tl.to("#s5-group", { scale: 0.06, opacity: 0, duration: s5.fold[1] - s5.fold[0], ease: "power3.in", transformOrigin: `${pfx}px ${pfy}px` }, s5.fold[0]);
  tl.fromTo("#s5-plane", { scale: 0, rotation: -50 }, { scale: 1, rotation: -8, duration: 0.3, ease: "back.out(2)" }, s5.fold[1] - 0.08);
  tl.to("#s5-plane", { keyframes: { x: [0, (ptx - pfx) * 0.3, ptx - pfx], y: [0, -200, pty - pfy], scale: [1, 0.8, 0.22], rotation: [-8, -22, 12] }, duration: s5.fly[1] - s5.fly[0], ease: "power1.inOut" }, s5.fly[0]);
  tl.to("#s5-plane", { opacity: 0, duration: 0.1 }, s5.fly[1] - 0.06);
  tl.fromTo("#s5-phone", L.phoneFrom === "right" ? { x: L.W } : { y: L.H }, { x: 0, y: 0, duration: s5.phone[1] - s5.phone[0], ease: "power3.out" }, s5.phone[0]);
  tl.fromTo("#s5-bubble", { scale: 0.55, y: 30, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)", transformOrigin: "100% 100%" }, s5.land);
  tl.fromTo("#s5-ticks", { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.15 }, s5.ticks);
  // match cut 5: push into the green bubble until it is the frame
  const [p5x, p5y] = L.s5push;
  tl.set("#s5-world", { transformOrigin: `${p5x}px ${p5y}px` }, C.scenes.s5[0]);
  tl.to(["#s5-bubble", "#s5-ticks"], { color: "#0e9f67", duration: 0.18, ease: "none" }, s5.push[0]);
  tl.to("#s5-world", { scale: 32, duration: s5.push[1] - s5.push[0], ease: "power3.in" }, s5.push[0]);

  // ---------------------------------------------------------------- 6 · one wave becomes the W
  const s6 = C.s6;
  tl.set("#s6-mark", { x: L.move.dx, y: L.move.dy, scale: L.move.s, transformOrigin: "50% 50%" }, C.scenes.s6[0]);
  tl.set("#s6-solid", { opacity: 0 }, C.scenes.s6[0]);
  tl.fromTo("#s6-stroke", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: s6.draw[1] - s6.draw[0], ease: "power2.inOut" }, s6.draw[0]);
  tl.fromTo("#s6-dot", { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(3)", svgOrigin: "251.69 100" }, s6.dot);
  const iris2 = $("#iris2");
  const i2x = parseFloat(iris2.style.left) + 50, i2y = parseFloat(iris2.style.top) + 50;
  tl.fromTo("#iris2", { scale: 0 }, { scale: coverScale(i2x, i2y, 100), duration: s6.iris[1] - s6.iris[0], ease: "power3.in" }, s6.iris[0]);
  tl.to("#s6-stroke", { stroke: "#0e9f67", duration: 0.25, ease: "none" }, s6.iris[0] + 0.15);
  tl.to("#s6-dot", { fill: "#0e9f67", duration: 0.25, ease: "none" }, s6.iris[0] + 0.15);
  tl.to("#s6-solid", { opacity: 1, duration: 0.2, ease: "none" }, s6.iris[1]);
  tl.to("#s6-mark", { x: 0, y: 0, scale: 1, duration: s6.move[1] - s6.move[0], ease: "power3.inOut" }, s6.move[0]);
  tl.fromTo("#s6-word", { yPercent: 112 }, { yPercent: 0, duration: 0.6, ease: "power4.out" }, s6.word);
  tl.fromTo("#s6-tag span", { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, stagger: 0.07, ease: "power3.out" }, s6.tag);
  tl.fromTo("#s6-pills span", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.12, ease: "power3.out" }, s6.pills);
  $$("#s6 .st").forEach((el, i) => slap(el, s6.edges[i]));

  window.__timelines["main"] = tl;
})();
