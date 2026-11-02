// 문자열 스프라이트 → 픽셀 배열. 색은 pixelfx와 같은 32비트 형식(ABGR, ImageData와 같은 바이트 순서).
// 그리기는 프레임 버퍼(Uint32Array)에 직접 쓴다 — 캔버스 호출 없이 빠르다.

import { hex } from "../../vendor/pixelfx/src/core/index.js";

/** rows: 같은 길이 문자열 배열, pal: { 문자: "#rrggbb" | 숫자 }. "."·" "는 빈칸 */
export function compile(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const px = new Uint32Array(w * h);
  const cache = {};
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) throw new Error(`sprite row ${y} width ${row.length} != ${w}: "${row}"`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      let c = cache[ch];
      if (c === undefined) {
        const v = pal[ch];
        if (v === undefined) throw new Error(`sprite: no color for "${ch}"`);
        c = cache[ch] = typeof v === "number" ? v : hex(v);
      }
      px[y * w + x] = c;
    }
  }
  return { w, h, px };
}

/** 빈 스프라이트 */
export function blank(w, h) { return { w, h, px: new Uint32Array(w * h) }; }

/** 불투명 픽셀 둘레에 1px 외곽선 */
export function outlined(spr, color) {
  const { w, h, px } = spr;
  const W2 = w + 2, H2 = h + 2, out = new Uint32Array(W2 * H2), c = typeof color === "number" ? color : hex(color);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x]) out[(y + 1) * W2 + x + 1] = px[y * w + x];
  const copy = out.slice();
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    if (copy[y * W2 + x]) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W2 && ny < H2 && copy[ny * W2 + nx]) { near = true; break; }
    }
    if (near) out[y * W2 + x] = c;
  }
  return { w: W2, h: H2, px: out };
}

/** 색 바꾸기: map은 { 원래색(숫자): 새색(숫자) } */
export function recolor(spr, map) {
  const px = spr.px.map((c) => (map[c] !== undefined ? map[c] : c));
  return { w: spr.w, h: spr.h, px };
}

/** 한 색으로 칠한 실루엣 (피격 번쩍임용) */
export function silhouette(spr, color) {
  const c = typeof color === "number" ? color : hex(color);
  return { w: spr.w, h: spr.h, px: spr.px.map((v) => (v ? c : 0)) };
}

/** 좌우 반전 */
export function flipped(spr) {
  const { w, h, px } = spr, out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + (w - 1 - x)] = px[y * w + x];
  return { w, h, px: out };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * 프레임에 스프라이트 찍기. (x, y)는 스프라이트 왼쪽 위 (정수로 내림).
 * opts: { a: 0..1 (디더 투명), tint: 색(숫자, 전체를 한 색으로), flip }
 */
export function blit(frame, spr, x, y, opts) {
  const W = frame.w, H = frame.h, C = frame.color;
  const sx0 = Math.floor(x), sy0 = Math.floor(y);
  const a = opts && opts.a != null ? opts.a : 1;
  const tint = opts && opts.tint;
  const flip = opts && opts.flip;
  const { w, h, px } = spr;
  for (let j = 0; j < h; j++) {
    const fy = sy0 + j;
    if (fy < 0 || fy >= H) continue;
    for (let i = 0; i < w; i++) {
      const c = px[j * w + (flip ? w - 1 - i : i)];
      if (!c) continue;
      const fx = sx0 + i;
      if (fx < 0 || fx >= W) continue;
      if (a < 1 && a <= BAYER[((fy & 3) << 2) | (fx & 3)]) continue;
      C[fy * W + fx] = tint || c;
    }
  }
}

/** 반투명 어두운 타원 그림자 (색 버퍼에 직접 섞음) */
export function shadow(frame, cx, cy, rx, ry, k = 0.45) {
  const W = frame.w, H = frame.h, C = frame.color, bg = frame.bg;
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= H) continue;
    const dy = (y + 0.5 - cy) / ry;
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= W) continue;
      const dx = (x + 0.5 - cx) / rx;
      if (dx * dx + dy * dy > 1) continue;
      const i = y * W + x;
      const base = C[i] || (bg ? bg[i] : 0);
      if (!base) continue;
      const f = 1 - k;
      const r = (base & 255) * f, g = ((base >>> 8) & 255) * f, b = ((base >>> 16) & 255) * f;
      C[i] = (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
    }
  }
}
