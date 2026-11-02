// 스테이지 바닥·벽을 480×300 픽셀 배열로 한 번 그려 둔다 (매 프레임 배경으로 재사용).

import { hex, mix, scale, fbm, hash } from "../../vendor/pixelfx/src/core/index.js";
import { LW, LH, WALL, PX } from "../config.js";

const WT = WALL / PX;   // 벽 두께(픽셀) = 12

const THEMES = [
  { // 지하묘지
    a: "#3b3542", b: "#302b38", mortar: "#1b1720", hi: "#4a4352", wallA: "#2a2430", wallB: "#3e3646", wallTop: "#57505f",
    decal: ["#2f4a2c", "#3e5e36"], bone: "#b8ad96", dark: "#14111a",
  },
  { // 서리 동굴
    a: "#33445e", b: "#2b3a52", mortar: "#161f30", hi: "#435874", wallA: "#1e2a40", wallB: "#2e4060", wallTop: "#5a7aa0",
    decal: ["#6a8ab8", "#9ab8e0"], bone: "#d8e8ff", dark: "#0c1220",
  },
  { // 공허의 성소
    a: "#251b35", b: "#1e162c", mortar: "#0d0916", hi: "#33264a", wallA: "#150e22", wallB: "#24183a", wallTop: "#43306a",
    decal: ["#4a2a70", "#6a3aa0"], bone: "#ff5ad8", dark: "#07040c",
  },
];

const cache = new Map();

/** 스테이지 바닥 (Uint32Array LW*LH) */
export function floorFor(stageIndex) {
  if (cache.has(stageIndex)) return cache.get(stageIndex);
  const T = THEMES[stageIndex] || THEMES[0];
  const C = {}; for (const k of Object.keys(T)) C[k] = Array.isArray(T[k]) ? T[k].map(hex) : hex(T[k]);
  const out = new Uint32Array(LW * LH);
  const seed = 11 + stageIndex * 7;
  const TS = 16;
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      // 줄마다 반 칸씩 엇갈린 돌판
      const ox = (ty % 2) * (TS / 2);
      const lx = (x + ox) % TS, ly = y % TS;
      const tile = Math.floor((x + ox) / TS);
      const r = hash(tile, ty, seed) / 4294967296;
      let c = r < 0.5 ? C.a : C.b;
      const n = fbm(x * 0.09, y * 0.09, seed, 3);
      c = scale(c, 0.88 + n * 0.24);
      if (lx === 0 || ly === 0) c = C.mortar;
      else if (lx === 1 || ly === 1) c = mix(c, C.hi, 0.35);       // 돌 모서리 밝은 면
      else if (lx === TS - 1 || ly === TS - 1) c = scale(c, 0.82);
      // 금
      const crack = hash(tile * 3, ty * 5, seed + 1) / 4294967296;
      if (crack < 0.05 && lx > 2 && ly > 2 && Math.abs((lx - 3) - (ly - 3) * (crack < 0.06 ? 1 : 0.5)) < 0.6) c = C.mortar;
      // 얼룩 (이끼·얼음·공허 얼룩)
      const d = fbm(x * 0.035 + 50, y * 0.035, seed + 3, 3);
      if (d > 0.66) c = mix(c, C.decal[0], 0.55);
      if (d > 0.74) c = mix(c, C.decal[1], 0.45);
      // 잔돌
      if (hash(x, y, seed + 9) % 97 === 0) c = mix(c, C.hi, 0.6);
      out[y * LW + x] = c;
    }
  }
  // 바닥 장식 (뼈·얼음 결정·공허 룬)
  decorate(out, stageIndex, C, seed);
  // 벽
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const top = y < WT + 4, side = x < WT || x >= LW - WT, bottom = y >= LH - WT;
    if (!(top || side || bottom)) continue;
    let c;
    if (top && y < WT + 4 && !side) {
      // 위쪽 벽: 벽돌 면 (3D 느낌으로 4px 더 내려옴)
      const by = Math.floor(y / 5), bx = Math.floor((x + (by % 2) * 6) / 12);
      const lx = (x + (by % 2) * 6) % 12, ly = y % 5;
      c = (hash(bx, by, seed + 4) & 1) ? C.wallA : C.wallB;
      if (ly === 0) c = C.wallTop;
      else if (lx === 0 || ly === 4) c = C.dark;
      if (y === 0) c = C.dark;
    } else {
      c = (x + y) % 2 ? C.wallA : scale(C.wallA, 0.9);
      if ((side && (x === WT - 1 || x === LW - WT)) || (bottom && y === LH - WT)) c = C.wallTop;
    }
    out[y * LW + x] = c;
  }
  // 위쪽 벽 아래 그림자 + 가장자리 어둡게 (방 안쪽이 밝다)
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const i = y * LW + x;
    let k = 1;
    const below = y - (WT + 4);
    if (below >= 0 && below < 7 && x >= WT && x < LW - WT) k *= 0.55 + below * 0.065;
    const dx = (x - LW / 2) / (LW / 2), dy = (y - LH / 2) / (LH / 2);
    k *= 1 - Math.min(0.45, (dx * dx * 0.6 + dy * dy * 0.7) * 0.4);
    if (k < 1) out[i] = scale(out[i], k);
  }
  cache.set(stageIndex, out);
  return out;
}

function decorate(out, stageIndex, C, seed) {
  const put = (x, y, c) => { if (x > WT + 2 && x < LW - WT - 2 && y > WT + 8 && y < LH - WT - 2) out[y * LW + x] = c; };
  for (let k = 0; k < 26; k++) {
    const x = WT + 8 + (hash(k, 1, seed) % (LW - WT * 2 - 16));
    const y = WT + 14 + (hash(k, 2, seed) % (LH - WT * 2 - 22));
    const kind = hash(k, 3, seed) % 3;
    if (stageIndex === 0) {
      // 흩어진 뼈
      if (kind === 0) { for (let i = 0; i < 5; i++) put(x + i, y, C.bone); put(x - 1, y - 1, C.bone); put(x - 1, y + 1, C.bone); put(x + 5, y - 1, C.bone); put(x + 5, y + 1, C.bone); }
      else if (kind === 1) { // 작은 해골
        for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) put(x + i, y + j, C.bone);
        put(x + 1, y + 1, C.dark); put(x + 3, y + 1, C.dark); put(x + 1, y + 3, C.bone); put(x + 2, y + 3, C.bone);
      } else { for (let i = 0; i < 3; i++) put(x + i, y + i, C.bone); }
    } else if (stageIndex === 1) {
      // 얼음 결정
      const c1 = C.decal[1], c2 = hex("#e8f6ff");
      if (kind < 2) { for (let i = 0; i < 4; i++) { put(x, y - i, i > 2 ? c2 : c1); } put(x - 1, y, c1); put(x + 1, y - 1, c1); put(x + 1, y, c1); put(x - 1, y - 1, c2); }
      else { for (let i = -2; i <= 2; i++) { put(x + i, y, c1); put(x, y + i, c1); } put(x, y, c2); }
    } else {
      // 공허 룬 (희미하게 빛나는 원)
      if (kind === 0) {
        for (let a = 0; a < 24; a++) { const an = (a / 24) * Math.PI * 2; put(Math.round(x + Math.cos(an) * 6), Math.round(y + Math.sin(an) * 4), C.decal[1]); }
        put(x, y, C.bone); put(x - 2, y, C.decal[1]); put(x + 2, y, C.decal[1]);
      } else if (kind === 1) { for (let i = 0; i < 6; i++) put(x + i, y + (i % 2), C.decal[1]); put(x + 2, y, C.bone); }
    }
  }
}

/** 위쪽 벽 횃불 자리 (픽셀 좌표) */
export function torchSpots() {
  const xs = [0.14, 0.38, 0.62, 0.86].map((f) => Math.round(LW * f));
  return xs.map((x) => ({ x, y: WT + 2 }));
}
