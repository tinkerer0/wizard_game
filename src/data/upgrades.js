// 영구 성장: 판이 끝나면 받은 "불씨 결정"으로 기본 능력을 조금씩 올린다. 단계마다 효과가 쌓인다.

export const UPGRADES = [
  { id: "vigor",  name: "생명력",   desc: "최대 체력 +8%",     max: 5, cost: [30, 60, 110, 180, 270], apply(p, lv) { const k = 1 + 0.08 * lv; p.maxHp = Math.round(p.maxHp * k); p.hp = p.maxHp; } },
  { id: "power",  name: "화력",     desc: "공격력 +6%",        max: 5, cost: [40, 80, 140, 220, 320], apply(p, lv) { p.damageMul *= 1 + 0.06 * lv; } },
  { id: "swift",  name: "민첩",     desc: "이동 속도 +4%",     max: 5, cost: [25, 50, 90, 150, 230],  apply(p, lv) { p.speed = Math.round(p.speed * (1 + 0.04 * lv)); } },
  { id: "magnet", name: "끌어당김", desc: "경험치 획득 범위 +18%", max: 5, cost: [20, 40, 75, 120, 180],  apply(p, lv) { p.pickupRadius = Math.round(p.pickupRadius * (1 + 0.18 * lv)); } },
  { id: "wisdom", name: "지혜",     desc: "경험치 +7%",        max: 5, cost: [35, 70, 125, 200, 300], apply(p, lv) { p.xpMul *= 1 + 0.07 * lv; } },
];

/** 판 결과 → 받을 불씨 결정 수 */
export function crystalsFor(run) {
  return Math.round(run.kills * 0.12 + (run.gw - 1) * 3 + run.bossKills * 40 + (run.victory ? 100 : 0));
}
