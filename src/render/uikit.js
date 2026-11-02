// UI 그리기 도구: 960×600 캔버스 위에 2px 격자로 맞춘 픽셀 패널·막대·글자(Galmuri).

export const FONT = {
  title: "48px Galmuri11Bold",
  big: "36px Galmuri11Bold",
  h: "24px Galmuri11Bold",
  m: "24px Galmuri11",
  s: "20px Galmuri9",
  xs: "16px Galmuri7",
};

export const COL = {
  ink: "#0d0911", panel: "#15101c", panel2: "#1d1626", line: "#3a2f48", lineHi: "#5a4a6e",
  text: "#f2ecf8", muted: "#a596b8", faint: "#6f6485",
  gold: "#ffcf5a", goldDeep: "#c8862a", fire: "#ff7b2e", red: "#ff4a5a", cyan: "#5fe0ff", green: "#7ee88a", purple: "#c684ff",
};

export async function loadFonts(base) {
  const list = [
    ["Galmuri11", "Galmuri11.woff2"],
    ["Galmuri11Bold", "Galmuri11-Bold.woff2"],
    ["Galmuri9", "Galmuri9.woff2"],
    ["Galmuri7", "Galmuri7.woff2"],
  ];
  await Promise.all(list.map(async ([name, file]) => {
    try {
      const f = new FontFace(name, `url(${base}${file})`);
      await f.load();
      document.fonts.add(f);
    } catch (e) { console.warn("font load failed", name, e); }
  }));
}

const even = (v) => Math.round(v / 2) * 2;

/** 글자 (그림자 포함). opts: { font, color, align, base, shadow, alpha } */
export function text(ctx, str, x, y, opts = {}) {
  ctx.save();
  ctx.font = opts.font || FONT.m;
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = opts.base || "top";
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  const X = even(x), Y = even(y);
  if (opts.shadow !== false) {
    ctx.fillStyle = opts.shadowColor || "rgba(8,4,12,0.9)";
    ctx.fillText(str, X + 2, Y + 2);
  }
  if (opts.outline) {
    ctx.fillStyle = opts.outline;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.fillText(str, X + dx, Y + dy);
  }
  ctx.fillStyle = opts.color || COL.text;
  ctx.fillText(str, X, Y);
  ctx.restore();
}

export function measure(ctx, str, font) {
  ctx.save(); ctx.font = font || FONT.m; const w = ctx.measureText(str).width; ctx.restore(); return w;
}

/** 픽셀 패널: 모서리를 깎은 사각형 + 2px 테두리 */
export function panel(ctx, x, y, w, h, opts = {}) {
  x = even(x); y = even(y); w = even(w); h = even(h);
  const fill = opts.fill || COL.panel, line = opts.line || COL.line, hi = opts.hi || COL.lineHi;
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  ctx.fillStyle = COL.ink;
  ctx.fillRect(x + 4, y, w - 8, h); ctx.fillRect(x, y + 4, w, h - 8); ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = line;
  ctx.fillRect(x + 4, y + 2, w - 8, 2); ctx.fillRect(x + 4, y + h - 4, w - 8, 2);
  ctx.fillRect(x + 2, y + 4, 2, h - 8); ctx.fillRect(x + w - 4, y + 4, 2, h - 8);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = hi;
  ctx.fillRect(x + 6, y + 4, w - 12, 2);
  if (opts.glow) {
    ctx.fillStyle = opts.glow;
    ctx.fillRect(x + 4, y, w - 8, 2); ctx.fillRect(x + 4, y + h - 2, w - 8, 2);
    ctx.fillRect(x, y + 4, 2, h - 8); ctx.fillRect(x + w - 2, y + 4, 2, h - 8);
    ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + w - 4, y + 2, 2, 2); ctx.fillRect(x + 2, y + h - 4, 2, 2); ctx.fillRect(x + w - 4, y + h - 4, 2, 2);
  }
  ctx.restore();
}

/** 막대: 값 비율 k, 단계 색(어두움·밝음) */
export function bar(ctx, x, y, w, h, k, c1, c2, opts = {}) {
  x = even(x); y = even(y); w = even(w); h = even(h);
  ctx.fillStyle = COL.ink; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = opts.back || "#2a2032"; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const fw = even(Math.max(0, Math.min(1, k)) * (w - 4));
  if (opts.ghost != null) {
    const gw = even(Math.max(0, Math.min(1, opts.ghost)) * (w - 4));
    ctx.save(); ctx.fillStyle = "#ffffff"; ctx.globalAlpha *= 0.5; ctx.fillRect(x + 2, y + 2, gw, h - 4); ctx.restore();
  }
  ctx.fillStyle = c1; ctx.fillRect(x + 2, y + 2, fw, h - 4);
  ctx.fillStyle = c2; ctx.fillRect(x + 2, y + 2, fw, Math.max(2, even((h - 4) * 0.4)));
  if (opts.ticks) { ctx.fillStyle = COL.ink; for (const t of opts.ticks) ctx.fillRect(x + 2 + even(t * (w - 4)), y + 2, 2, h - 4); }
}

/** 화면 전체 어둡게 */
export function dim(ctx, a = 0.6) {
  ctx.fillStyle = `rgba(6,3,10,${a})`;
  ctx.fillRect(0, 0, 960, 600);
}

/** 작은 불꽃 커서 */
export function flameCursor(ctx, x, y, t) {
  x = even(x); y = even(y);
  const f = Math.floor(t * 8) % 2;
  ctx.fillStyle = "#ff3a16"; ctx.fillRect(x, y + 4, 8, 8);
  ctx.fillStyle = "#ff8a2e"; ctx.fillRect(x + 2, y + 2 - f * 2, 4, 8);
  ctx.fillStyle = "#ffe27a"; ctx.fillRect(x + 2, y + 6, 4, 4);
}

/** 픽셀 그림 크게 찍기 (스프라이트 → 캔버스) */
const sprCanvasCache = new WeakMap();
export function spriteCanvas(spr) {
  let c = sprCanvasCache.get(spr);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = spr.w; c.height = spr.h;
  const cx = c.getContext("2d"), img = cx.createImageData(spr.w, spr.h);
  new Uint32Array(img.data.buffer).set(spr.px);
  cx.putImageData(img, 0, 0);
  sprCanvasCache.set(spr, c);
  return c;
}
export function drawSprite(ctx, spr, x, y, scale = 2, flip = false) {
  const c = spriteCanvas(spr);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.translate(even(x) + spr.w * scale, even(y)); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, spr.w * scale, spr.h * scale); }
  else ctx.drawImage(c, even(x), even(y), spr.w * scale, spr.h * scale);
  ctx.restore();
}

/** 클릭 영역 기록 (마우스·터치) */
export const hits = { list: [] };
export function hitArea(x, y, w, h, onClick, onHover) { hits.list.push({ x, y, w, h, onClick, onHover }); }
