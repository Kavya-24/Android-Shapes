const C = 100;
const R = 88;

const fmt = (v) => (Math.round(v * 10) / 10).toString();

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const along = (from, to, d) => {
  const t = d / dist(from, to);
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
};

function rot(pts, deg) {
  if (!deg) return pts;
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [C + (x - C) * c - (y - C) * s, C + (x - C) * s + (y - C) * c]);
}

function roundedPolyPath(pts, rr) {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const di = Math.min(rr, dist(prev, p) * 0.45);
    const doo = Math.min(rr, dist(p, next) * 0.45);
    const a = along(p, prev, di);
    const b = along(p, next, doo);
    d += i === 0 ? `M${fmt(a[0])} ${fmt(a[1])}` : `L${fmt(a[0])} ${fmt(a[1])}`;
    if (rr > 0.2) d += `Q${fmt(p[0])} ${fmt(p[1])} ${fmt(b[0])} ${fmt(b[1])}`;
    else d += `L${fmt(b[0])} ${fmt(b[1])}`;
  }
  return d + "Z";
}

function catmullPath(pts) {
  const n = pts.length;
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d + "Z";
}

function polarCurve(fn, samples) {
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const a = (2 * Math.PI * i) / samples;
    const r = fn(a) * R;
    pts.push([C + r * Math.sin(a), C - r * Math.cos(a)]);
  }
  return pts;
}

function regularPts(n, scale, phase) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n + phase;
    pts.push([C + scale * R * Math.sin(a), C - scale * R * Math.cos(a)]);
  }
  return pts;
}

function starPts(n, scale, kInner, phase) {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = (Math.PI * i) / n + phase;
    const r = (i % 2 === 0 ? scale : kInner * scale) * R;
    pts.push([C + r * Math.sin(a), C - r * Math.cos(a)]);
  }
  return pts;
}

function gearPts(teeth, th, w, scale) {
  const pts = [];
  const d = (2 * Math.PI) / teeth;
  const push = (ang, s) => pts.push([C + s * R * Math.sin(ang), C - s * R * Math.cos(ang)]);
  for (let i = 0; i < teeth; i++) {
    const a = i * d;
    push(a - 0.5 * w * 0.8, 1 - th);
    push(a - w, scale);
    push(a + w, scale);
    push(a + 0.5 * w * 0.8, 1 - th);
  }
  return pts;
}

const bucket = (v, steps, hi, lo = 0) => Math.min(steps - 1, (((v - lo) * steps) / (hi - lo)) | 0);

function makePoly(i, rnd) {
  const n = 3 + ((i * 7) % 10);
  const rr = Math.round(rnd() * rnd() * 40 * 10) / 10;
  const rotDeg = Math.round(rnd() * 3600) / 10;
  const scale = 0.94 + rnd() * 0.06;
  const d = roundedPolyPath(rot(regularPts(n, scale, 0), rotDeg), rr);
  const rb = rr / 40;
  return {
    d,
    tags: [
      `v${n}`,
      rb === 0 ? "sharp" : rb < 0.25 ? "light" : rb < 0.6 ? "mid" : "soft",
      `r${bucket(rotDeg, 8, 360)}`,
    ],
  };
}

function makeStar(i, rnd) {
  const n = 3 + ((i * 7) % 10);
  const kInner = Math.round((0.32 + rnd() * 0.3) * 100) / 100;
  const rr = Math.round(rnd() * rnd() * 22 * 10) / 10;
  const rotDeg = Math.round(rnd() * 3600) / 10;
  const scale = 0.94 + rnd() * 0.06;
  const d = roundedPolyPath(rot(starPts(n, scale, kInner, 0), rotDeg), rr);
  return {
    d,
    tags: [
      `p${n}`,
      kInner < 0.42 ? "slim" : kInner < 0.52 ? "mid" : "fat",
      rr === 0 ? "sharp" : "round",
      `r${bucket(rotDeg, 8, 360)}`,
    ],
  };
}

function makeBurst(i, rnd) {
  const n = 6 + ((i * 13) % 8);
  const inner = 0.4 + rnd() * 0.16;
  const wild = rnd();
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    const ro = R * (0.86 - wild * 0.12 + wild * 0.22 * rnd());
    pts.push([C + ro * Math.sin(a), C - ro * Math.cos(a)]);
    const ai = a + Math.PI / n;
    const ri = R * inner * (0.8 + 0.4 * rnd());
    pts.push([C + ri * Math.sin(ai), C - ri * Math.cos(ai)]);
  }
  const rotDeg = Math.round(rnd() * 3600) / 10;
  const rr = 2 + rnd() * 6;
  return { d: roundedPolyPath(rot(pts, rotDeg), rr), tags: [`j${n}`, wild > 0.5 ? "wild" : "calm", `r${bucket(rotDeg, 8, 360)}`] };
}

function makeBlob(i, rnd) {
  const m = 8 + ((i * 5) % 6);
  const f1 = 1 + (i % 3);
  const f2 = 2 + ((i + 2) % 3);
  const rb = 0.78 + rnd() * 0.14;
  const a1 = 0.05 + rnd() * 0.2;
  const a2 = 0.04 + rnd() * 0.14;
  const p1 = rnd() * 360;
  const p2 = rnd() * 360;
  const fn = (a) => {
    const t = (a * 180) / Math.PI;
    return rb * (1 + a1 * Math.sin((t * f1 * Math.PI) / 180 + (p1 * Math.PI) / 180) + a2 * Math.sin((t * f2 * Math.PI) / 180 + (p2 * Math.PI) / 180));
  };
  const d = catmullPath(polarCurve(fn, m * 4));
  return {
    d,
    tags: [`f${f1}${f2}`, a1 + a2 > 0.25 ? "wavy" : "gentle", bucket(rb * (1 + a1 + a2), 6, 1.12, 0.9)],
  };
}

function makeFlower(i, rnd) {
  const k = 4 + ((i * 7) % 9);
  const depth = 0.2 + rnd() * 0.26;
  const rotDeg = Math.round(rnd() * 3600) / 10;
  const fn = (a) => {
    const t = (a * 180) / Math.PI;
    return 1 - depth + depth * Math.abs(Math.cos((k * t * Math.PI) / 360));
  };
  const d = roundedPolyPath(rot(polarCurve(fn, k * 9), rotDeg), 1.4);
  return { d, tags: [`k${k}`, depth > 0.38 ? "deep" : depth > 0.28 ? "mid" : "shallow", `r${bucket(rotDeg, 8, 360)}`] };
}

function makeGear(i, rnd) {
  const teeth = 6 + ((i * 11) % 10);
  const th = 0.12 + rnd() * 0.2;
  const w = 0.14 + rnd() * 0.14;
  const rr = Math.round(rnd() * rnd() * 14 * 10) / 10;
  const rotDeg = Math.round(rnd() * 3600) / 10;
  const scale = 0.95 + rnd() * 0.05;
  const d = roundedPolyPath(rot(gearPts(teeth, th, w, scale), rotDeg), rr);
  return {
    d,
    tags: [`t${teeth}`, th > 0.25 ? "tall" : th > 0.18 ? "even" : "low", rr === 0 ? "sharp" : "round", `r${bucket(rotDeg, 8, 360)}`],
  };
}

function makeSquircle(i, rnd) {
  const e = 2.4 + rnd() * 4.4;
  const eggY = 0.78 + rnd() * 0.46;
  const eggX = i % 3 === 0 ? 1 / eggY : 1;
  const pts = [];
  for (let k = 0; k < 48; k++) {
    const t = (2 * Math.PI * k) / 48;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    pts.push([
      C + R * eggX * Math.sign(ct) * Math.abs(ct) ** (2 / e),
      C + R * eggY * Math.sign(st) * Math.abs(st) ** (2 / e),
    ]);
  }
  const d = catmullPath(pts);
  return { d, tags: [`e${Math.round(e)}`, i % 3 === 0 ? "rot0" : "egg", Math.round(eggY * 10) / 10] };
}

function teardropPath(splay, tipY, r) {
  const cx = 100;
  const cy = 100 + r;
  const d0 = cy - tipY;
  const sinB = r / d0;
  const bx = r * Math.sqrt(1 - sinB * sinB);
  const ly = cy - r * sinB;
  const lx = cx - bx;
  const rx = cx + bx;
  const ry = ly;
  const dt = Math.hypot(lx - 100, ly - tipY);
  const ux = (lx - 100) / dt;
  const uy = (ly - tipY) / dt;
  const e = 18;
  return (
    `M100 ${fmt(tipY)}` +
    `C${fmt(100 - splay)} ${fmt(tipY + 22)} ${fmt(lx - ux * e)} ${fmt(ly - uy * e)} ${fmt(lx)} ${fmt(ly)}` +
    `A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(rx)} ${fmt(ry)}` +
    `C${fmt(rx - ux * e)} ${fmt(ry - uy * e)} ${fmt(100 + splay)} ${fmt(tipY + 22)} 100 ${fmt(tipY)}Z`
  );
}

function leafPath(bulge, twist) {
  const wd = bulge * 95;
  return `M100 24Q${fmt(100 + wd)} ${fmt(100 + twist)} 100 176Q${fmt(100 - wd)} ${fmt(100 - twist)} 100 24Z`;
}

function crescentPath(dx, dy) {
  const r2 = Math.hypot(dx, 80 + Math.abs(dy));
  const y0 = 20 + dy;
  const y1 = 180 + dy;
  return `M100 ${fmt(y0)}A80 80 0 0 0 100 ${fmt(y1)}A${fmt(r2)} ${fmt(r2)} 0 0 1 100 ${fmt(y0)}Z`;
}

function shieldPath(w, notch) {
  return (
    `M${fmt(C - w)} 46Q${fmt(C - w)} 24 ${fmt(C - w + 22)} 24` +
    `L${fmt(C + w - 22)} 24Q${fmt(C + w)} 24 ${fmt(C + w)} 46` +
    `L${fmt(C + w)} 96Q${fmt(C + w)} ${fmt(30 + notch)} 100 172` +
    `Q${fmt(C - w)} ${fmt(30 + notch)} ${fmt(C - w)} 96Z`
  );
}

function makeDrop(i, rnd) {
  const sub = i % 4;
  if (sub === 0) {
    const splay = 14 + rnd() * 40;
    const tipY = 24 + rnd() * 12;
    const r = 44 + rnd() * 10;
    return { d: teardropPath(splay, tipY, r), tags: ["teardrop", splay > 34 ? "slim" : "plump"] };
  }
  if (sub === 1) {
    const bulge = 0.3 + rnd() * 0.7;
    const twist = -13 + rnd() * 26;
    return { d: leafPath(bulge, twist), tags: ["leaf", bulge > 0.65 ? "plump" : "slim"] };
  }
  if (sub === 2) {
    const dx = 10 + rnd() * 56;
    const dy = Math.round((rnd() - 0.5) * 24);
    return { d: crescentPath(dx, dy), tags: ["crescent", dx > 38 ? "thin" : "even"] };
  }
  const w = 40 + rnd() * 26;
  const notch = 26 + rnd() * 30;
  return { d: shieldPath(w, notch), tags: ["shield", w > 53 ? "broad" : "narrow"] };
}

export { makePoly, makeStar, makeBurst, makeBlob, makeFlower, makeGear, makeSquircle, makeDrop };
