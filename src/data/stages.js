// 스테이지 구성. 한 판 = 스테이지 3개 × 웨이브 10개, 각 스테이지 마지막 웨이브는 보스.
// 3스테이지 보스를 쓰러뜨리면 클리어 → 원하면 무한 모드(웨이브 31부터, 10웨이브마다 보스 재등장).

export const STAGES = [
  {
    id: "crypt", name: "잿빛 지하묘지", sub: "STAGE 1", boss: "boneKing",
    // 지역 웨이브(1~9)별로 나오는 적의 가중치
    mix(lw) {
      return [
        { type: "slime", w: 10 },
        { type: "bat", w: lw >= 2 ? 5 : 0 },
        { type: "brute", w: lw >= 4 ? 2 + lw * 0.3 : 0 },
        { type: "charger", w: lw >= 7 ? 2 : 0 },
      ];
    },
    eliteWaves: [6, 9],
  },
  {
    id: "frost", name: "서리 동굴", sub: "STAGE 2", boss: "frostWitch",
    mix(lw) {
      return [
        { type: "slime", w: 7 },
        { type: "bat", w: 4 },
        { type: "caster", w: 3 + lw * 0.25 },
        { type: "splitter", w: lw >= 3 ? 3 : 0 },
        { type: "brute", w: lw >= 5 ? 2.5 : 0 },
      ];
    },
    eliteWaves: [4, 7, 9],
  },
  {
    id: "void", name: "공허의 성소", sub: "STAGE 3", boss: "voidLord",
    mix(lw) {
      return [
        { type: "slime", w: 6 },
        { type: "bat", w: 4 },
        { type: "caster", w: 3.5 },
        { type: "splitter", w: 3 },
        { type: "charger", w: 3 + lw * 0.2 },
        { type: "brute", w: 3 },
      ];
    },
    eliteWaves: [3, 5, 7, 9],
  },
];

export const ENDLESS_STAGE = STAGES[2];

/** 전체 웨이브 번호(1부터) → { stageIndex, local(1~10), isBoss, endless } */
export function waveInfo(gw) {
  const idx = Math.floor((gw - 1) / 10);
  const local = ((gw - 1) % 10) + 1;
  const endless = idx >= STAGES.length;
  return { stageIndex: Math.min(idx, STAGES.length - 1), local, isBoss: local === 10, endless };
}

/** 이번 웨이브에 나올 일반 몬스터 수 */
export function waveCount(gw) {
  return 6 + Math.round(gw * 1.55);
}
