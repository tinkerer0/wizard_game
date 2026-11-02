// 게임 전역 상수. 게임 로직은 960×600 "월드 좌표"로 돌고, 화면은 그 절반(480×300) 픽셀로 그린 뒤 2배로 키운다.
// 월드 좌표를 그대로 둔 이유: 기존 전직 39종의 사거리·속도·반경 밸런스 수치를 바꾸지 않기 위해서.

export const W = 960, H = 600;            // 월드 크기
export const WALL = 24;                   // 방 벽 두께(월드)
export const MIN = WALL, MAXX = W - WALL, MAXY = H - WALL;

export const PX = 2;                      // 월드 → 픽셀 배율 (월드 2 = 픽셀 1)
export const LW = W / PX, LH = H / PX;    // 픽셀 화면 480×300

export const STAGE_WAVES = 10;            // 스테이지당 웨이브 수 (마지막 웨이브는 보스)
export const STAGE_COUNT = 3;

export const VERSION = "1.0.0";
