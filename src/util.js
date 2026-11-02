// 작은 수학·난수 도우미 (게임 로직용 — 이펙트는 pixelfx의 시드 난수를 쓴다)

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const lerp = (a, b, t) => a + (b - a) * t;

/** 두 각도 차이의 절댓값 (0..π) */
export function angleDiff(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/** 가중치 표에서 하나 고르기: [{w, ...}] */
export function weighted(list) {
  let sum = 0;
  for (const it of list) sum += it.w;
  let r = Math.random() * sum;
  for (const it of list) { if ((r -= it.w) <= 0) return it; }
  return list[list.length - 1];
}

/** 초를 "m:ss"로 */
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
