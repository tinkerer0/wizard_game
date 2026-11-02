// 게임 스프라이트(마법사·적·보스·아이템). 작은 것은 문자열로 직접 찍고, 보스는 도형을 그려 외곽선을 입힌다.
// 모두 오른쪽을 바라보는 그림이고, 왼쪽은 그릴 때 뒤집는다.

import { hex, mix, scale, createFrame, painterFor } from "../../vendor/pixelfx/src/core/index.js";
import { compile, outlined } from "./spritekit.js";

const INK = "#170f1c";

// ---------- 색 도우미 ----------
const toNum = (c) => (typeof c === "number" ? c : hex(c));
export const lighten = (c, k) => mix(toNum(c), hex("#ffffff"), k);
export const darken = (c, k) => scale(toNum(c), 1 - k);

// ---------- 마법사 ----------
// A/B/C: 로브 어두움/중간/밝음, H/h: 모자 띠, s/S: 피부, w/W: 수염, e: 눈, f: 지팡이, g/G: 보석, k: 신발
const WIZARD = [
  "......oo........",
  ".....oBBo.......",
  ".....oBCBo......",
  "......oBBo......",
  "......oABCo.....",
  ".....oABBCo.....",
  ".....oABBBCo....",
  "....oAABBBCo....",
  "....oHHHHHHHo...",
  "..ooAABBBBBCCoo.",
  ".oAAABBBBBBBCCCo",
  "..oooSssssssooo.",
  "....oSssssesoG..",
  "....oWwwwwwwog..",
  "...oAWwwwwwWBof.",
  "..oAABWwwwwWBCso",
  "..oAABBWwwWBBCso",
  "..oAABBBWWBBBCfo",
  "..oAABBBBBBBCCf.",
  "...oAABBBBBBCCf.",
  "...oAABBBBBBCCf.",
  "...okkoooookkof.",
];
// 걷기 발 모양 (마지막 줄 교체)
const WIZ_FEET = [
  "...okkoooookkof.",
  "...okkooooookkf.",
  "...ookkoooookkf.",
  "...okkoooookkof.",
];

/**
 * 마법사 그림 한 벌. look: { color(로브), tier(0~3), branch(swordsman|cannon|ember|null), fx(팔레트) }
 * 반환: { idle:[2], walk:[4] } 각 { w, h, px }
 */
export function wizardSprites(look) {
  const robe = toNum(look.color || "#ff7b2e");
  const fx = look.fx || { main: "#ff7b2e", hi: "#fff4d0", deep: "#ff3a16" };
  const tier = look.tier || 0;
  const pal = {
    o: INK,
    A: darken(robe, 0.45), B: robe, C: lighten(robe, 0.28),
    H: tier >= 1 ? "#f2c14e" : darken(robe, 0.25), h: "#a8742a",
    s: "#f3c9a0", S: "#c98d6a",
    w: "#eee8dc", W: "#b9afa5",
    e: INK,
    f: "#8a5a2c", F: "#5a3618",
    g: toNum(fx.main), G: toNum(fx.hi),
    k: "#3b2a33",
  };
  const rows = WIZARD.map((r) => r);
  // 3차: 로브 밑단에 금장식
  if (tier >= 3) {
    rows[20] = "...oHHBHHBHHCCf.";
  }
  // 2차 이상: 어깨 망토(어두운 색)
  if (tier >= 2) {
    rows[14] = "..oAAWwwwwwWBBof";
    rows[15] = ".oAAABWwwwwWBCso";
    rows[16] = ".oAAABBWwwWBBCso";
  }
  const branch = look.branch;
  if (branch === "swordsman") {
    // 지팡이 대신 화염검 (위로 길게)
    rows[9] = "..ooAABBBBBCCooG";
    rows[10] = ".oAAABBBBBBBCCoG";
    rows[11] = "..oooSssssssoogG";
    rows[12] = "....oSssssesoogo";
    rows[13] = "....oWwwwwwwo.g.";
    rows[14] = (tier >= 2 ? "..oAAWwwwwwWBBog" : "...oAWwwwwwWBoog");
    rows[17] = "..oAABBBWWBBBC.o";
    rows[18] = "..oAABBBBBBBCC..";
    rows[19] = "...oAABBBBBBCC..";
    rows[20] = tier >= 3 ? "...oHHBHHBHHCC.." : "...oAABBBBBBCC..";
  } else if (branch === "cannon") {
    // 큰 보석이 박힌 굵은 지팡이
    rows[11] = "..oooSsssssooooo";
    rows[12] = "....oSssssesoGGo";
    rows[13] = "....oWwwwwwwogGo";
  } else if (branch === "ember") {
    // 지팡이 끝에 떠 있는 불씨 (보석 둘레 빛은 그릴 때 더한다)
    rows[12] = "....oSssssesoGG.";
    rows[13] = "....oWwwwwwwogg.";
  }
  const base = rows.slice(0, 21);
  const idle0 = compile(rows, pal);
  // 숨쉬기: 몸 전체가 1px 내려온 그림
  const idle1 = compile([rows[0].replace(/./g, ".")].concat(rows.slice(0, 20)).slice(0, 21).concat([rows[21]]), pal);
  const walk = WIZ_FEET.map((feet, i) => {
    const body = i % 2 === 1 ? [rows[0].replace(/./g, ".")].concat(base.slice(0, 20)) : base;
    return compile(body.concat([feet]), pal);
  });
  return { idle: [idle0, idle1], walk };
}

// ---------- 적 (스테이지마다 색이 다르다: 0 지하묘지, 1 서리, 2 공허) ----------

const SLIME = [
  "....oooooo....",
  "..ooCCBBBBoo..",
  ".oCCBBBBBBBBo.",
  ".oCBBBBBBBBBo.",
  "oCBBEeBBBEeBBo",
  "oBBBeeBBBeeBBo",
  "oBBBBBBBBBBBBo",
  "oABBBBBBBBBBAo",
  "oAABBBBBBBBAAo",
  ".oAAAAAAAAAAo.",
  "..oooooooooo..",
];
const SLIME_SQUASH = [
  "..............",
  "....oooooo....",
  "..ooCCBBBBoo..",
  ".oCBBBBBBBBBo.",
  "oCBBEeBBBEeBBo",
  "oBBBeeBBBeeBBo",
  "oBBBBBBBBBBBBo",
  "oABBBBBBBBBBAo",
  "oAABBBBBBBBAAo",
  "oAAAAAAAAAAAAo",
  ".oooooooooooo.",
];
const BAT_UP = [
  "o..............o",
  "oo............oo",
  "oBo..........oBo",
  "oBBo.oo..oo.oBBo",
  ".oBBoBBooBBoBBo.",
  ".oBBBBeBBeBBBBo.",
  "..oABBBBBBBBAo..",
  "...oooABBAooo...",
  "......oooo......",
];
const BAT_DOWN = [
  "................",
  "................",
  "................",
  ".....oo..oo.....",
  "..ooBBBooBBBoo..",
  ".oBBBBeBBeBBBBo.",
  "oBBABBBBBBBBABBo",
  "oBo.oABBBBAo.oBo",
  "oo...oooooo...oo",
];
const BRUTE = [
  "..o..........o..",
  "..oo.oooooo.oo..",
  "...ooMMMMMMoo...",
  "...oMMMMMMMMo...",
  "...oMbbbbbbMo...",
  "...oMbebbebMo...",
  "...oMbbbbbbMo...",
  "....obtbtbto....",
  "..oooMMMMMMooo..",
  ".oMMoMMMMMMoMMo.",
  ".oMMoAMMMMAoMMo.",
  ".oSSSoAMMAobbbo.",
  ".oSRSoMMMMobbbo.",
  ".oSSSoMMMMo.oo..",
  "..ooooAMMAo.....",
  "....oMMooMMo....",
  "....oMMooMMo....",
  "...oKKKooKKKo...",
];
const BRUTE_STEP = [
  "..o..........o..",
  "..oo.oooooo.oo..",
  "...ooMMMMMMoo...",
  "...oMMMMMMMMo...",
  "...oMbbbbbbMo...",
  "...oMbebbebMo...",
  "...oMbbbbbbMo...",
  "....obtbtbto....",
  "..oooMMMMMMooo..",
  ".oMMoMMMMMMoMMo.",
  ".oMMoAMMMMAoMMo.",
  ".oSSSoAMMAobbbo.",
  ".oSRSoMMMMobbbo.",
  ".oSSSoMMMMo.oo..",
  "..ooooAMMAo.....",
  "...oMMo.oMMo....",
  "...oMMo..oMMo...",
  "..oKKKo..oKKKo..",
];
const WISP = [
  ".....oo.....",
  "....oCCo....",
  "...oCCBo....",
  "...oCBBBo...",
  "..oCBBBBo...",
  "..oCBBBBBo..",
  ".oCBEeBEeBo.",
  ".oCBeeBeeBo.",
  ".oBBBBBBBBo.",
  ".oABBBBBBAo.",
  "..oABBBBAo..",
  "..oAABBAAo..",
  "...oAooAo...",
  "...o.oo.o...",
];
const EYE = [
  "....oooooo....",
  "..ooBBBBBBoo..",
  ".oBBCCCCCCBBo.",
  ".oBCwwwwwwCBo.",
  "oBCwwwPPwwwCBo",
  "oBCwwPeePwwCBo",
  "oBCwwPeePwwCBo",
  "oBCwwwPPwwwCBo",
  ".oBCwwwwwwCBo.",
  ".oABCCCCCCBAo.",
  "..ooABBBBAoo..",
  "..oAoAooAoAo..",
  ".oAo.oAAo.oAo.",
  ".oo...oo...oo.",
];
const HOUND = [
  "..o.o...........",
  "..oBoo..........",
  ".oBBBBoooooooo..",
  "oBBeBBBBBBBBBBo.",
  "oBBBBBBBBBBBBBBo",
  "otBBoBBBBBBBBBAo",
  ".ottoABBBBBBAAo.",
  "..ooAAoooooAAo..",
  "...oAo.....oAo..",
  "...oo......oo...",
];
const HOUND_RUN = [
  "..o.o...........",
  "..oBoo..........",
  ".oBBBBoooooooo..",
  "oBBeBBBBBBBBBBo.",
  "oBBBBBBBBBBBBBBo",
  "otBBoBBBBBBBBBAo",
  ".ottoABBBBBBAAo.",
  "..ooAoooooooAAo.",
  "..oAo.......oAo.",
  "..oo.........oo.",
];
const JELLY = [
  "......oooooo......",
  "....ooCCCBBBoo....",
  "...oCCBBBBBBBBo...",
  "..oCBBBBBBBBBBBo..",
  ".oCBBBBBBBBBBBBBo.",
  ".oCBBEeBBBBBEeBBo.",
  "oCBBBeeBBBBBeeBBBo",
  "oBBBBBBBNNBBBBBBBo",
  "oBBBBBBNNNNBBBBBBo",
  "oABBBBBBNNBBBBBBAo",
  "oAABBBBBBBBBBBBAAo",
  ".oAAABBBBBBBBAAAo.",
  "..ooAAAAAAAAAAoo..",
  "....oooooooooo....",
];
const MINI = [
  "..ooooo..",
  ".oCBBBBo.",
  "oCBeBeBBo",
  "oBBBBBBBo",
  "oABBBBBAo",
  ".ooooooo.",
];

// 스테이지별 색
const SKIN_PAL = [
  { // 지하묘지: 병든 초록·뼈·녹슨 쇠
    slime: { A: "#1f4a2a", B: "#3f8a3a", C: "#8fd06a", E: "#fff6d8", e: "#10200f" },
    bat: { A: "#2a1830", B: "#5a3a5e", e: "#ff4a3a" },
    brute: { M: "#6c6a72", A: "#3c3a44", b: "#e4dcc8", e: "#ff5a2a", t: "#8a806c", S: "#5a3a24", R: "#c8a050", K: "#2e2a30" },
    hound: { A: "#2e3a2a", B: "#5e6e4e", e: "#ffd23c", t: "#e4dcc8" },
    jelly: { A: "#1f4a2a", B: "#4a9a44", C: "#9fe07a", E: "#fff6d8", e: "#10200f", N: "#d6ff8a" },
  },
  { // 서리 동굴: 얼음 파랑
    slime: { A: "#1a3a6a", B: "#3a7ac8", C: "#9ad8ff", E: "#ffffff", e: "#0c1430" },
    bat: { A: "#22304a", B: "#5a7aa0", e: "#9adcff" },
    brute: { M: "#7ab0d8", A: "#3a6090", b: "#d8f0ff", e: "#5ad8ff", t: "#9ab8d0", S: "#4a6a8a", R: "#d8f4ff", K: "#22304a" },
    hound: { A: "#2a3a5a", B: "#6a8ab0", e: "#9adcff", t: "#d8f4ff" },
    jelly: { A: "#1a3a6a", B: "#4a8ad8", C: "#b0e4ff", E: "#ffffff", e: "#0c1430", N: "#ffffff" },
    wisp: { A: "#1f4f94", B: "#58b4ec", C: "#d8f4ff", E: "#ffffff", e: "#0c1430" },
  },
  { // 공허의 성소: 검보라·자홍
    slime: { A: "#2a1440", B: "#5e2c8a", C: "#b070e0", E: "#ffd2f6", e: "#0a0410" },
    bat: { A: "#1a0c26", B: "#3e2258", e: "#ff5ad8" },
    brute: { M: "#3a2a50", A: "#1c1230", b: "#a970e0", e: "#ff5ad8", t: "#6a4a90", S: "#24183a", R: "#ff5ad8", K: "#120a1c" },
    hound: { A: "#1c1230", B: "#43306a", e: "#ff5ad8", t: "#d0b0ff" },
    jelly: { A: "#2a1440", B: "#6a34a0", C: "#c084f0", E: "#ffd2f6", e: "#0a0410", N: "#ff86e6" },
    eye: { A: "#2c1a4a", B: "#5e3290", C: "#8048b8", w: "#f0e6f8", P: "#ff3ad0", e: "#120818" },
  },
];

const cache = new Map();
function build(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/** 적 그림: 프레임 배열 */
export function enemySprites(type, skin) {
  skin = skin || 0;
  return build(`${type}:${skin}`, () => {
    const P = SKIN_PAL[skin];
    const pal = (k) => ({ o: INK, ...(P[k] || SKIN_PAL[0][k] || SKIN_PAL[1][k]) });
    switch (type) {
      case "slime": return [compile(SLIME, pal("slime")), compile(SLIME_SQUASH, pal("slime"))];
      case "bat": return [compile(BAT_UP, pal("bat")), compile(BAT_DOWN, pal("bat"))];
      case "brute": return [compile(BRUTE, pal("brute")), compile(BRUTE_STEP, pal("brute"))];
      case "charger": return [compile(HOUND, pal("hound")), compile(HOUND_RUN, pal("hound"))];
      case "splitter": return [compile(JELLY, pal("jelly"))];
      case "mini": return [compile(MINI, pal("slime"))];
      case "caster":
        if (skin === 2) return [compile(EYE, pal("eye"))];
        return [compile(WISP, { o: INK, ...SKIN_PAL[1].wisp })];
      default: return [compile(SLIME, pal("slime"))];
    }
  });
}

// ---------- 보스: 도형으로 그린 뒤 외곽선 ----------

function shapeSprite(w, h, draw) {
  const f = createFrame(w, h);
  const p = painterFor(f);
  draw(p, w, h);
  const px = new Uint32Array(w * h);
  for (let i = 0; i < px.length; i++) px[i] = f.color[i] >>> 24 ? (f.color[i] | 0xff000000) >>> 0 : 0;
  return outlined({ w, h, px }, INK);
}

function boneKing(frame) {
  const bob = frame ? 1 : 0;
  return shapeSprite(46, 50, (p) => {
    const C = (c) => hex(c);
    // 망토
    p.poly([[12, 14 + bob], [34, 14 + bob], [42, 48], [4, 48]], C("#3a1a4a"));
    p.poly([[14, 16 + bob], [32, 16 + bob], [38, 46], [8, 46]], C("#5a2a6e"));
    p.poly([[18, 18 + bob], [28, 18 + bob], [30, 44], [16, 44]], C("#47205a"));
    // 갈비뼈 몸통
    p.ellipse(23, 27 + bob, 8, 10, C("#d8cfb8"));
    for (let i = 0; i < 4; i++) p.rect(17, 21 + i * 4 + bob, 12, 1, C("#7a705c"));
    p.rect(22, 18 + bob, 2, 20, C("#b8ad96"));
    // 다리뼈
    p.rect(18, 37, 3, 9, C("#d8cfb8")); p.rect(25, 37, 3, 9, C("#d8cfb8"));
    p.rect(16, 45, 6, 3, C("#5e5648")); p.rect(24, 45, 6, 3, C("#5e5648"));
    // 해골 머리
    p.ellipse(23, 10 + bob, 8, 8, C("#ece4d0"));
    p.rect(17, 14 + bob, 12, 4, C("#d8cfb8"));
    p.ellipse(20, 10 + bob, 2.2, 2.6, C("#1a0f14")); p.ellipse(27, 10 + bob, 2.2, 2.6, C("#1a0f14"));
    p.px(20, 10 + bob, C("#ff3a2a")); p.px(27, 10 + bob, C("#ff3a2a"));
    p.rect(19, 16 + bob, 9, 1, C("#5e5648"));
    for (let i = 0; i < 4; i++) p.px(20 + i * 2, 15 + bob, C("#5e5648"));
    // 왕관
    p.poly([[15, 4 + bob], [31, 4 + bob], [31, 0 + bob], [28, 2 + bob], [26, -1 + bob], [23, 2 + bob], [20, -1 + bob], [18, 2 + bob], [15, 0 + bob]], C("#f0b424"));
    p.rect(15, 3 + bob, 16, 2, C("#c48412"));
    p.px(23, 1 + bob, C("#ff3a5a"));
    // 대검 (오른손)
    p.poly([[33, 4], [37, 4], [37, 34], [35, 38], [33, 34]], C("#9aa6ba"));
    p.rect(34, 6, 1, 26, C("#d0d8e6"));
    p.rect(30, 33, 10, 3, C("#c48412"));
    p.rect(34, 36, 2, 6, C("#4a2c14"));
    // 팔
    p.rect(29, 24 + bob, 5, 2, C("#d8cfb8")); p.rect(32, 26 + bob, 2, 8, C("#d8cfb8"));
    p.rect(12, 24 + bob, 5, 2, C("#d8cfb8")); p.rect(11, 25 + bob, 2, 9, C("#d8cfb8"));
  });
}

function frostWitch(frame) {
  const bob = frame ? 1 : 0;
  return shapeSprite(42, 52, (p) => {
    const C = (c) => hex(c);
    // 얼음 지팡이
    p.rect(35, 6 + bob, 2, 40, C("#5a7aa0"));
    p.poly([[36, -1 + bob], [40, 5 + bob], [36, 11 + bob], [32, 5 + bob]], C("#9bdcff"));
    p.poly([[36, 1 + bob], [38, 5 + bob], [36, 8 + bob], [34, 5 + bob]], C("#ffffff"));
    // 로브 (아래로 갈수록 넓게, 들쭉날쭉한 얼음 밑단)
    p.poly([[14, 16 + bob], [28, 16 + bob], [36, 44 + bob], [32, 48 + bob], [28, 45 + bob], [24, 49 + bob], [20, 45 + bob], [16, 49 + bob], [12, 45 + bob], [6, 46 + bob]], C("#1f4f94"));
    p.poly([[16, 18 + bob], [26, 18 + bob], [31, 42 + bob], [11, 42 + bob]], C("#2f7fcc"));
    p.poly([[19, 20 + bob], [23, 20 + bob], [25, 40 + bob], [17, 40 + bob]], C("#58b4ec"));
    // 팔
    p.poly([[26, 20 + bob], [34, 26 + bob], [33, 29 + bob], [25, 25 + bob]], C("#2f7fcc"));
    p.circle(34, 27 + bob, 2, C("#d8f4ff"));
    // 두건과 얼굴
    p.ellipse(21, 12 + bob, 9, 9, C("#1f4f94"));
    p.ellipse(22, 13 + bob, 5.5, 6, C("#e8f4ff"));
    p.rect(19, 12 + bob, 2, 2, C("#0c1430")); p.rect(24, 12 + bob, 2, 2, C("#0c1430"));
    p.px(19, 12 + bob, C("#9bdcff")); p.px(24, 12 + bob, C("#9bdcff"));
    p.rect(21, 16 + bob, 3, 1, C("#58b4ec"));
    // 얼음 왕관
    for (let i = 0; i < 5; i++) p.tri(13 + i * 4, 6 + bob, 17 + i * 4, 6 + bob, 15 + i * 4, (i % 2 ? 0 : -3) + bob, C(i % 2 ? "#9bdcff" : "#d8f4ff"));
  });
}

function voidLord(frame) {
  const bob = frame ? 1 : 0;
  return shapeSprite(58, 58, (p) => {
    const C = (c) => hex(c);
    // 찢어진 망토 (촉수 밑단)
    p.poly([[14, 18 + bob], [44, 18 + bob], [54, 50], [6, 50]], C("#120a1c"));
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * 8;
      p.poly([[x, 48], [x + 6, 48], [x + 3 + (i % 2 ? 2 : -2), 57 - (i % 3)]], C("#1c1230"));
    }
    p.poly([[18, 20 + bob], [40, 20 + bob], [46, 46], [12, 46]], C("#2c1a4a"));
    p.poly([[23, 22 + bob], [35, 22 + bob], [37, 44], [21, 44]], C("#432468"));
    // 갑옷 가슴
    p.poly([[22, 24 + bob], [36, 24 + bob], [33, 36 + bob], [29, 39 + bob], [25, 36 + bob]], C("#1c1230"));
    p.circle(29, 29 + bob, 2.5, C("#ff3ad0"));
    // 머리와 뿔
    p.ellipse(29, 14 + bob, 9, 8, C("#1c1230"));
    p.poly([[21, 10 + bob], [12, 1 + bob], [16, 0 + bob], [24, 7 + bob]], C("#5e3290"));
    p.poly([[37, 10 + bob], [46, 1 + bob], [42, 0 + bob], [34, 7 + bob]], C("#5e3290"));
    p.poly([[13, 1 + bob], [10, -1 + bob], [15, 0 + bob]], C("#a970e0"));
    p.poly([[45, 1 + bob], [48, -1 + bob], [43, 0 + bob]], C("#a970e0"));
    // 외눈
    p.ellipse(29, 14 + bob, 4.5, 3, C("#f0e6f8"));
    p.ellipse(29, 14 + bob, 2.2, 2.6, C("#ff3ad0"));
    p.rect(29, 13 + bob, 1, 3, C("#120818"));
    // 어깨 가시
    p.poly([[14, 20 + bob], [8, 16 + bob], [18, 24 + bob]], C("#5e3290"));
    p.poly([[44, 20 + bob], [50, 16 + bob], [40, 24 + bob]], C("#5e3290"));
    // 손 (공허 구슬)
    p.circle(10, 34 + bob, 3, C("#2c1a4a")); p.circle(48, 34 + bob, 3, C("#2c1a4a"));
  });
}

export function bossSprites(id) {
  return build(`boss:${id}`, () => {
    if (id === "boneKing") return [boneKing(0), boneKing(1)];
    if (id === "frostWitch") return [frostWitch(0), frostWitch(1)];
    return [voidLord(0), voidLord(1)];
  });
}

// ---------- 아이템 ----------

const GEM = [
  "..o..",
  ".oCo.",
  "oCBBo",
  "oBBAo",
  ".oAo.",
  "..o..",
];
const GEM_BIG = [
  "...o...",
  "..oCo..",
  ".oCCBo.",
  "oCCBBBo",
  "oBBBBAo",
  ".oBAAo.",
  "..oAo..",
  "...o...",
];
const HEART = [
  ".oo.oo.",
  "oCBoBBo",
  "oBBBBBo",
  "oBBBBAo",
  ".oBBAo.",
  "..oAo..",
  "...o...",
];
const CHEST = [
  ".oooooooooooo.",
  "oBBBBBBBBBBBBo",
  "oBCCCCCCCCCCBo",
  "oGGGGGGGGGGGGo",
  "oBBBBBGGBBBBBo",
  "oooooGYYGooooo",
  "oBBBBBGGBBBBBo",
  "oBAAAAAAAAAABo",
  "oBAAAAAAAAAABo",
  "oGGGGGGGGGGGGo",
  ".oooooooooooo.",
];

export const ITEMS = {
  gem: () => build("gem", () => compile(GEM, { o: INK, A: "#1f8a8a", B: "#4ce8d8", C: "#d8fff8" })),
  gemBig: () => build("gemBig", () => compile(GEM_BIG, { o: INK, A: "#a8680f", B: "#ffd23c", C: "#fff6c4" })),
  heart: () => build("heart", () => compile(HEART, { o: INK, A: "#a01824", B: "#ff4a5a", C: "#ffd0d4" })),
  chest: () => build("chest", () => compile(CHEST, { o: INK, A: "#4a2c14", B: "#8e5c2c", C: "#b47c40", G: "#f0b424", Y: "#fff6c4" })),
};
