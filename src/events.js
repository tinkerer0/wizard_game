// 게임 로직 → 화면·소리 알림 통로. 로직은 무엇이 일어났는지만 알리고, 그림·소리는 구독자가 맡는다.
// 봇 시뮬레이션(runSim)에서는 muted=true로 두어 화면 일을 건너뛴다.

const handlers = new Map();
export const bus = { muted: false };

export function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push(fn);
}

export function emit(type, data) {
  if (bus.muted) return;
  const list = handlers.get(type);
  if (!list) return;
  for (const fn of list) fn(data || {});
}
