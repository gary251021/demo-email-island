#!/usr/bin/env node
// Deterministic visual metrics for references/visual-scoring.md.
//   annotate <reference.png>                       writes <reference.png>.annotation.json
//   score --reference <png> --target <url|png> [--allow <css selector>] [--wait <ms>] [--screenshot <png>] [--drop <ID,ID> --reason <text>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

export const VIEWPORT = { width: 1600, height: 900 };
const { width: W, height: H } = VIEWPORT;

// ---------- color ----------
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function rgbToLab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [x, y, z].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function ciede2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hue = (b, a) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const hp1 = Cp1 === 0 ? 0 : hue(b1, ap1), hp2 = Cp2 === 0 ? 0 : hue(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2);
  const Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) hm = Math.abs(hp1 - hp2) <= 180 ? hm / 2 : (hm + (hm < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad)
    + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T;
  const RT = -2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function parseRgb(text) {
  const m = /rgba?\(([^)]+)\)/.exec(text ?? "");
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return a === 0 ? null : [r, g, b];
}

// ---------- image analysis ----------
function morph(mask, radius, erode) {
  const tmp = new Uint8Array(mask.length), out = new Uint8Array(mask.length);
  const pass = (src, dst, horizontal) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = erode ? 1 : 0;
      for (let d = -radius; d <= radius && v === (erode ? 1 : 0); d++) {
        const xx = horizontal ? x + d : x, yy = horizontal ? y : y + d;
        const inside = xx >= 0 && xx < W && yy >= 0 && yy < H;
        const s = inside ? src[yy * W + xx] : 0;
        if (erode ? !s : s) v = erode ? 0 : 1;
      }
      dst[y * W + x] = v;
    }
  };
  pass(mask, tmp, true);
  pass(tmp, out, false);
  return out;
}
function components(mask, minArea) {
  const seen = new Uint8Array(mask.length), stack = new Int32Array(mask.length), found = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0, area = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const p = stack[--top], x = p % W, y = (p - x) / W;
      area++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && mask[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
      }
    }
    if (area >= minArea) found.push({ area, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return found;
}
function median(values) {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
}
function union(boxes) {
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function kmeans(points, k, iterations = 15) {
  const sorted = [...points].sort((p, q) => p[0] - q[0]);
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((2 * i + 1) / (2 * k)) * sorted.length)]);
  let assign = new Int32Array(points.length);
  for (let it = 0; it < iterations; it++) {
    points.forEach((p, i) => {
      let best = 0, bestD = Infinity;
      centers.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bestD) { bestD = d; best = j; } });
      assign[i] = best;
    });
    centers = centers.map((c, j) => {
      const members = points.filter((_, i) => assign[i] === j);
      return members.length ? [0, 1, 2].map((d) => members.reduce((s, p) => s + p[d], 0) / members.length) : c;
    });
  }
  const counts = centers.map((_, j) => assign.filter((a) => a === j).length);
  return centers.map((lab, j) => ({ lab: lab.map((v) => +v.toFixed(2)), share: +(counts[j] / points.length).toFixed(4) }))
    .filter((c) => c.share > 0).sort((a, b) => b.share - a.share);
}

export function analyzePixels(rgba, exclude = []) {
  const n = W * H, lab = new Array(n);
  for (let i = 0; i < n; i++) lab[i] = rgbToLab([rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]]);
  const fx = Math.round(W * 0.05), fy = Math.round(H * 0.05), frame = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < fx || x >= W - fx || y < fy || y >= H - fy) frame.push(lab[y * W + x]);
  }
  const water = [0, 1, 2].map((d) => +median(frame.map((p) => p[d])).toFixed(2));

  const raw = new Uint8Array(n);
  const excluded = new Uint8Array(n);
  for (const b of exclude) {
    for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(H, Math.ceil(b.y + b.h)); y++)
      for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(W, Math.ceil(b.x + b.w)); x++) excluded[y * W + x] = 1;
  }
  for (let i = 0; i < n; i++) raw[i] = !excluded[i] && ciede2000(lab[i], water) > 12 ? 1 : 0;
  const opened = morph(morph(raw, 2, true), 2, false);
  const islands = components(opened, n * 0.01).sort((a, b) => b.area - a.area);
  const boardBox = islands.length ? union(islands) : null;
  const mainBox = islands[0] ?? null;

  const samples = [];
  for (let i = 0; i < n; i += 7) if (opened[i]) samples.push(lab[i]);
  const palette = samples.length >= 6 ? kmeans(samples, 6) : [];

  const white = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const [L, a, b] = lab[i]; white[i] = !excluded[i] && L >= 88 && Math.hypot(a, b) <= 12 ? 1 : 0; }
  const pills = components(morph(morph(white, 1, false), 1, true), 150)
    .filter((c) => c.h >= H * 0.015 && c.h <= H * 0.08 && c.w / c.h >= 1.8 && c.area / (c.w * c.h) >= 0.6)
    .map(({ x, y, w, h }) => ({ x, y, w, h }));

  return { viewport: VIEWPORT, water, boardBox, mainBox, palette, pills, pillHeightMedian: median(pills.map((p) => p.h)) };
}

// ---------- browser ----------
async function decode(page, png) {
  const data = await page.evaluate(async ({ src, W, H }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    const bytes = ctx.getImageData(0, 0, W, H).data;
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, { src: `data:image/png;base64,${png.toString("base64")}`, W, H });
  return new Uint8ClampedArray(Buffer.from(data, "base64"));
}

function collectDom(allow) {
  const vw = innerWidth, vh = innerHeight, chrome = [], pills = [];
  const allowed = allow ? [...document.querySelectorAll(allow)].map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }) : [];
  const painted = (el, cs) => el instanceof SVGElement
    ? !["none", "transparent", "rgba(0, 0, 0, 0)"].includes(cs.fill) || cs.stroke !== "none"
    : cs.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(cs.borderTopWidth) > 0 || el.tagName === "CANVAS" || el.tagName === "IMG";
  for (const el of document.querySelectorAll("body *, svg *, svg")) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    if (allow && el.closest(allow)) continue;
    const background = r.width >= vw * 0.95 && r.height >= vh * 0.95;
    const edge = r.left <= vw * 0.02 || r.top <= vh * 0.02 || r.right >= vw * 0.98 || r.bottom >= vh * 0.98;
    if (!background && edge && (r.width > vw * 0.3 || r.height > vh * 0.3) && painted(el, cs)) {
      chrome.push({ tag: el.tagName, x: r.x, y: r.y, w: r.width, h: r.height });
    }
    const isSvgRect = el.tagName.toLowerCase() === "rect";
    const radius = isSvgRect ? parseFloat(el.getAttribute("rx") ?? "0") * (r.height / el.height.baseVal.value) : parseFloat(cs.borderTopLeftRadius);
    if (r.height < 12 || r.height > 80 || r.width < r.height || background || !painted(el, cs)) continue;
    if (radius < r.height / 2 - 1 && !(isSvgRect && radius > 0)) continue;
    let text = el, fg = cs.color, font = cs.fontFamily;
    if (isSvgRect) {
      text = [...el.parentNode.querySelectorAll("text")].find((t) => {
        const b = t.getBoundingClientRect();
        return b.x >= r.x - 1 && b.right <= r.right + 1 && b.y >= r.y - 1 && b.bottom <= r.bottom + 1;
      });
      if (!text) continue;
      const tcs = getComputedStyle(text);
      fg = tcs.fill; font = tcs.fontFamily;
    } else if (!el.textContent.trim()) continue;
    pills.push({ x: r.x, y: r.y, w: r.width, h: r.height, radius, bg: isSvgRect ? cs.fill : cs.backgroundColor, fg, font, text: text.textContent.trim() });
  }
  return { chrome, pills, allowed };
}

async function capture(target, { allow, wait = 0, screenshot }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    let png, dom = null;
    if (extname(target).toLowerCase() === ".png" && !/^[a-z]+:\/\//.test(target)) {
      png = readFileSync(target);
    } else {
      await page.goto(/^[a-z]+:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href, { waitUntil: "networkidle" });
      if (wait) await page.waitForTimeout(wait);
      png = await page.screenshot();
      if (screenshot) writeFileSync(screenshot, png);
      dom = await page.evaluate(collectDom, allow ?? null);
      await page.goto("about:blank");
    }
    return { rgba: await decode(page, png), dom };
  } finally {
    await browser.close();
  }
}

// ---------- metrics ----------
const tierAtMost = (value, [t5, t4, t3, t2]) => (value <= t5 ? 5 : value <= t4 ? 4 : value <= t3 ? 3 : value <= t2 ? 2 : 1);
const metric = (id, value, tier) => ({ id, value: typeof value === "number" ? +value.toFixed(4) : value, tier });
const blocked = (id, reason) => ({ id, status: "BLOCKED", reason });
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];
const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Area left for the board once scope-allowed panels spanning half the viewport are removed.
export function freeArea(allowed = []) {
  let left = 0, right = W, top = 0, bottom = H;
  for (const b of allowed) {
    if (b.h >= H * 0.5) { if (b.x + b.w / 2 > W / 2) right = Math.min(right, b.x); else left = Math.max(left, b.x + b.w); }
    if (b.w >= W * 0.5) { if (b.y + b.h / 2 > H / 2) bottom = Math.min(bottom, b.y); else top = Math.max(top, b.y + b.h); }
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function scoreMetrics(ref, app, dom, drop = {}) {
  const out = [];
  const diag = Math.hypot(W, H);
  out.push(dom ? metric("L1", dom.chrome.length, dom.chrome.length ? 1 : 5) : blocked("L1", "No DOM for an image target."));
  if (ref.boardBox && app.boardBox) {
    const d = Math.abs(app.boardBox.w / W - ref.boardBox.w / W);
    out.push(metric("L2", d, tierAtMost(d, [0.05, 0.1, 0.15, 0.25])));
    const free = freeArea(dom?.allowed);
    const [ax, ay] = center(app.boardBox), [rx, ry] = center(ref.boardBox);
    const dx = ((ax - free.x) / free.w - rx / W) * W, dy = ((ay - free.y) / free.h - ry / H) * H;
    const off = (Math.hypot(dx, dy) / diag) * 100;
    out.push(metric("L3", off, tierAtMost(off, [3, 6, 10, 15])));
  } else out.push(blocked("L2", "Board not detected."), blocked("L3", "Board not detected."));
  if (ref.mainBox && app.mainBox) {
    const r = Math.abs((app.mainBox.w / app.mainBox.h) / (ref.mainBox.w / ref.mainBox.h) - 1) * 100;
    out.push(metric("G1", r, tierAtMost(r, [5, 10, 15, 25])));
  } else out.push(blocked("G1", "Main island not detected."));
  if (ref.palette.length && app.palette.length) {
    const d = ref.palette.reduce((s, c) => s + c.share * Math.min(...app.palette.map((a) => ciede2000(c.lab, a.lab))), 0);
    out.push(metric("C1", d, tierAtMost(d, [5, 10, 15, 25])));
  } else out.push(blocked("C1", "Palette not available."));
  const dw = ciede2000(ref.water, app.water);
  out.push(metric("C2", dw, tierAtMost(dw, [5, 10, 15, 25])));
  if (dom) {
    let pairs = 0;
    dom.pills.forEach((a, i) => dom.pills.slice(i + 1).forEach((b) => { if (intersects(a, b)) pairs++; }));
    out.push(metric("B1", pairs, pairs === 0 ? 5 : pairs === 1 ? 3 : pairs === 2 ? 2 : 1));
  } else out.push(blocked("B1", "No DOM for an image target."));
  const appHeights = dom?.pills.length ? median(dom.pills.map((p) => p.h)) : app.pillHeightMedian;
  if (ref.pillHeightMedian && appHeights) {
    const r = Math.abs(appHeights / ref.pillHeightMedian - 1) * 100;
    out.push(metric("B2", r, tierAtMost(r, [10, 20, 35, 50])));
  } else out.push(blocked("B2", "Labels not detected."));
  if (dom?.pills.length) {
    const checks = {
      pillRadius: dom.pills.every((p) => p.radius >= p.h / 2 - 1),
      lightBackground: dom.pills.every((p) => { const c = parseRgb(p.bg); return c && luminance(c) >= 0.85; }),
      contrast7: dom.pills.every((p) => { const b = parseRgb(p.bg), f = parseRgb(p.fg); return b && f && contrast(b, f) >= 7; }),
      sansSerif: dom.pills.every((p) => /sans-serif|system-ui|inter|helvetica|arial|noto sans|pingfang/i.test(p.font) && !/(^|,\s*)serif\b/i.test(p.font)),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    out.push(metric("B3", checks, passed + 1));
  } else out.push(blocked("B3", "No DOM labels."));
  return out.map((m) => (drop[m.id] ? { id: m.id, status: "DROPPED", reason: drop[m.id] } : m));
}

// ---------- CLI ----------
function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) o[argv[i].replace(/^--/, "")] = argv[i + 1];
  return o;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "annotate") {
    const file = rest[0];
    const { rgba } = await capture(file, {});
    const annotation = { source: file, ...analyzePixels(rgba) };
    writeFileSync(`${file}.annotation.json`, JSON.stringify(annotation, null, 2) + "\n");
    console.log(JSON.stringify(annotation, null, 2));
  } else if (command === "score") {
    const o = args(rest);
    const annotationPath = `${o.reference}.annotation.json`;
    if (!existsSync(annotationPath)) throw new Error(`Missing ${annotationPath}; run annotate first.`);
    const ref = JSON.parse(readFileSync(annotationPath, "utf8"));
    const { rgba, dom } = await capture(o.target, { allow: o.allow, wait: Number(o.wait ?? 0), screenshot: o.screenshot });
    const app = analyzePixels(rgba, dom?.allowed ?? []);
    const drop = Object.fromEntries((o.drop ?? "").split(",").filter(Boolean).map((id) => [id, o.reason ?? "Dropped by reviewer."]));
    console.log(JSON.stringify({ reference: o.reference, target: o.target, viewport: VIEWPORT, measured: { ...app, dom }, metrics: scoreMetrics(ref, app, dom, drop) }, null, 2));
  } else {
    console.log("Usage: visualMetrics.mjs annotate <reference.png> | score --reference <png> --target <url|png> [--allow <selector>] [--wait <ms>] [--screenshot <png>] [--drop <ID,ID> --reason <text>]");
    process.exitCode = command ? 1 : 0;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
