import { on } from "./events.js";

// Everything is synthesized locally. Importing subscribes, but never unlocks audio.
const TRACKS = {
  title:   { bpm: 78, root: 45, chords: [0, 5, 3, 7, 0, 5, 8, 7], soft: true },
  crypt:   { bpm: 96, root: 38, chords: [0, 0, 5, 3, 0, 8, 5, 7] },
  frost:   { bpm: 84, root: 50, chords: [0, 3, 8, 5, 0, 3, 5, 7], bell: true },
  void:    { bpm: 110, root: 33, chords: [0, 1, 0, 6, 0, 1, 8, 7], dark: true },
  boss:    { bpm: 140, root: 38, chords: [0, 0, 1, 7, 0, 5, 1, 7], urgent: true },
  victory: { bpm: 100, root: 48, chords: [0, 5, 7, 0, 9, 5, 7, 0], major: true, soft: true },
  defeat:  { bpm: 64, root: 45, chords: [0, -2], soft: true },
};
const MAX_VOICES = 24;
const voices = new Set();
const musicLayers = new Set();
const rateTimes = new Map();
let context, master, sfxBus, musicBus, musicDuck, noiseBuffer;
let volumes = { sfx: 0.8, music: 0.5 };
let requestedTrack = null;
let currentLayer = null;
let timer = null;
let resuming = null;
let gemTime = -Infinity, gemCombo = 0, killTime = -Infinity, killCombo = 0;
let duckUntil = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback) => Number.isFinite(value) ? value : fallback;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const ready = () => context && context.state === "running";

export function initAudio() {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!context) {
    let candidate;
    try {
      candidate = new AudioContext();
      context = candidate;
      master = context.createGain();
      master.gain.value = 0.65;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.knee.value = 12;
      compressor.ratio.value = 10;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      master.connect(compressor);
      compressor.connect(context.destination);
      sfxBus = context.createGain();
      musicBus = context.createGain();
      musicDuck = context.createGain();
      sfxBus.gain.value = volumes.sfx;
      musicBus.gain.value = volumes.music * 0.34;
      sfxBus.connect(master);
      musicDuck.connect(musicBus);
      musicBus.connect(master);
      noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const noise = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    } catch {
      if (candidate) {
        try { Promise.resolve(candidate.close()).catch(() => {}); } catch { /* unavailable */ }
      }
      context = undefined;
      return;
    }
  }
  if (ready()) {
    syncMusic();
    return;
  }
  if (!resuming && context.state !== "closed") {
    try {
      resuming = Promise.resolve(context.resume())
        .then(() => { if (ready()) syncMusic(); })
        .catch(() => {})
        .finally(() => { resuming = null; });
    } catch { /* A later user gesture can retry. */ }
  }
  return resuming;
}

export function setVolumes(settings = {}) {
  if (!settings || typeof settings !== "object") return;
  for (const key of ["sfx", "music"]) {
    if (Number.isFinite(settings[key])) volumes[key] = clamp(settings[key], 0, 1);
  }
  if (!context) return;
  sfxBus.gain.setTargetAtTime(volumes.sfx, context.currentTime, 0.025);
  musicBus.gain.setTargetAtTime(volumes.music * 0.34, context.currentTime, 0.025);
}

function disposeVoice(voice) {
  if (!voices.delete(voice)) return;
  voice.source.onended = null;
  for (const node of voice.nodes) node.disconnect();
}

// Future scheduled notes also count toward the cap; music leaves room for combat.
function voice({ frequency = 440, endFrequency = frequency, duration = 0.15,
  gain = 0.15, type = "sine", noise = false, cutoff = 2600,
  endCutoff = cutoff, filter = "lowpass", at, layer = null, attack = 0.006 }) {
  if (!ready()) return;
  const now = context.currentTime;
  for (const old of voices) if (old.end <= now) disposeVoice(old);
  if (voices.size >= (layer ? 16 : MAX_VOICES)) return;
  const start = Math.max(now, at ?? now);
  duration = clamp(duration, 0.025, 3);
  const end = start + duration;
  const source = noise ? context.createBufferSource() : context.createOscillator();
  if (noise) {
    source.buffer = noiseBuffer;
    source.loop = true;
  } else {
    source.type = type;
    source.frequency.setValueAtTime(clamp(frequency, 25, 7000), start);
    source.frequency.exponentialRampToValueAtTime(clamp(endFrequency, 25, 7000), end);
  }
  const tone = context.createBiquadFilter();
  tone.type = filter;
  tone.Q.value = 0.65;
  tone.frequency.setValueAtTime(clamp(cutoff, 50, 7500), start);
  tone.frequency.exponentialRampToValueAtTime(clamp(endCutoff, 50, 7500), end);
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(clamp(gain, 0, 0.55), start + Math.min(attack, duration / 3));
  envelope.gain.exponentialRampToValueAtTime(0.0001, end - 0.005);
  envelope.gain.linearRampToValueAtTime(0, end);
  source.connect(tone);
  tone.connect(envelope);
  envelope.connect(layer ? layer.bus : sfxBus);
  const item = { source, nodes: [source, tone, envelope], end, layer };
  voices.add(item);
  source.onended = () => disposeVoice(item);
  source.start(start);
  source.stop(end);
}

function limited(key, perSecond) {
  if (!ready() || volumes.sfx === 0) return false;
  const now = context.currentTime;
  const last = rateTimes.get(key) ?? -Infinity;
  if (now - last < 1 / perSecond) return false;
  rateTimes.set(key, now);
  return true;
}

function notes(midi, { spacing = 0.085, duration = 0.25, gain = 0.14, type = "sine" } = {}) {
  if (!ready()) return;
  const now = context.currentTime;
  midi.forEach((pitch, i) => voice({ frequency: hz(pitch), duration, gain, type, at: now + i * spacing }));
}

function whoosh(weight = 1, gain = 0.13) {
  voice({ noise: true, duration: 0.14 + weight * 0.025, gain,
    cutoff: 2500, endCutoff: 240, filter: "bandpass" });
  if (weight > 1.5) voice({ frequency: 160, endFrequency: 65, duration: 0.16, gain: 0.09 });
}

function explosion(data = {}, force = 1) {
  const size = clamp(number(data.r, 65) / 80, 0.45, 1.8) * (data.style === "mini" ? 0.55 : 1);
  const sharp = data.style === "flash";
  voice({ noise: true, duration: 0.16 + size * 0.13, gain: Math.min(0.35, 0.15 * size * force),
    cutoff: sharp ? 4700 : 1700, endCutoff: sharp ? 700 : 120 });
  voice({ frequency: 130 / Math.sqrt(size), endFrequency: 36, duration: 0.2 + size * 0.1,
    gain: Math.min(0.4, 0.22 * size * force) });
}

export function sfx(name) {
  if (!limited(`ui:${name}`, 12)) return;
  switch (name) {
    case "uiMove": notes([76], { duration: 0.055, gain: 0.08 }); break;
    case "uiSelect": notes([72, 79], { duration: 0.13, gain: 0.13, spacing: 0.055 }); break;
    case "uiBack": notes([72, 67], { duration: 0.12, gain: 0.1, spacing: 0.05 }); break;
    case "buy": notes([72, 76, 79, 84], { duration: 0.17, gain: 0.12, spacing: 0.05 }); break;
    case "error": notes([48, 47], { duration: 0.12, gain: 0.11, type: "triangle" }); break;
  }
}

export function playMusic(track) {
  if (track !== null && !Object.prototype.hasOwnProperty.call(TRACKS, track)) return;
  if (requestedTrack === track) return;
  requestedTrack = track;
  if (ready()) syncMusic();
}

function fadeLevel(layer, time) {
  const fraction = clamp((time - layer.fadeStart) / 0.5, 0, 1);
  return layer.fadeFrom + (layer.fadeTo - layer.fadeFrom) * fraction;
}

function fadeLayer(layer, value, now) {
  const from = fadeLevel(layer, now);
  layer.bus.gain.cancelScheduledValues(now);
  layer.bus.gain.setValueAtTime(from, now);
  layer.bus.gain.linearRampToValueAtTime(value, now + 0.5);
  Object.assign(layer, { fadeStart: now, fadeFrom: from, fadeTo: value });
}

function syncMusic() {
  if (!ready() || currentLayer?.name === requestedTrack) return;
  const now = context.currentTime;
  if (currentLayer) {
    fadeLayer(currentLayer, 0, now);
    currentLayer.retireAt = now + 0.5;
    currentLayer = null;
  }
  if (requestedTrack !== null) {
    const bus = context.createGain();
    bus.gain.value = 0;
    bus.connect(musicDuck);
    currentLayer = { name: requestedTrack, bus, step: 0, next: now + 0.02,
      fadeStart: now, fadeFrom: 0, fadeTo: 0, retireAt: Infinity, finished: false };
    musicLayers.add(currentLayer);
    fadeLayer(currentLayer, 1, now);
  }
  if (timer === null && musicLayers.size) timer = window.setInterval(scheduleMusic, 25);
  scheduleMusic();
}

function removeLayer(layer) {
  for (const item of voices) {
    if (item.layer !== layer) continue;
    try { item.source.stop(); } catch { /* already stopped */ }
    disposeVoice(item);
  }
  layer.bus.disconnect();
  musicLayers.delete(layer);
}

function scheduleMusic() {
  if (!ready()) return;
  const now = context.currentTime;
  for (const layer of musicLayers) {
    if (now >= layer.retireAt) { removeLayer(layer); continue; }
    if (layer.retireAt !== Infinity || layer.finished) continue;
    const config = TRACKS[layer.name];
    const stepLength = 60 / config.bpm / 4;
    // Skip missed beats after background throttling instead of dumping a backlog.
    if (layer.next < now - 0.1) {
      const missed = Math.ceil((now - layer.next) / stepLength);
      layer.step += missed;
      layer.next += missed * stepLength;
    }
    while (layer.next < now + 0.1) {
      if (layer.name === "defeat" && layer.step >= 32) {
        layer.finished = true;
        layer.retireAt = layer.next + 1.2;
        break;
      }
      musicStep(layer, config, layer.next);
      layer.step++;
      layer.next += stepLength;
    }
  }
  if (!musicLayers.size && timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function musicStep(layer, config, at) {
  const step = layer.step;
  const beat = step % 16;
  const bar = Math.floor(step / 16) % config.chords.length;
  const root = config.root + config.chords[bar];
  const beatLength = 60 / config.bpm;
  const major = config.major && ![9].includes(config.chords[bar]);
  const third = major ? 4 : 3;
  const chord = [0, third, 7, 12, 7, third, 14, 7];
  const play = options => voice({ ...options, layer, at });
  if (layer.name === "defeat") {
    if (beat % 4 === 0) play({ frequency: hz(config.root + 12 - Math.floor(step / 4) * 2),
      duration: 0.7, gain: 0.17, type: "triangle", cutoff: 1200 });
    if (beat === 0) play({ frequency: hz(root - 12), duration: 1, gain: 0.16, cutoff: 500 });
    return;
  }
  // One opening fanfare, then an eight-bar loop for victory.
  if (layer.name === "victory" && step < 32) {
    if (beat % 2 === 0) {
      const melody = [0, 4, 7, 12, 7, 12, 16, 19];
      play({ frequency: hz(config.root + 12 + melody[Math.floor(beat / 2)]),
        duration: 0.25, gain: 0.2, type: "triangle" });
    }
  } else if (beat % (config.urgent ? 1 : 2) === 0) {
    const pitch = root + 24 + chord[(Math.floor(beat / (config.urgent ? 1 : 2)) + bar) % chord.length];
    play({ frequency: hz(pitch), duration: config.bell ? 0.6 : beatLength * 0.65,
      gain: config.dark ? 0.075 : 0.13, type: config.bell || config.soft ? "sine" : "triangle",
      cutoff: config.dark ? 900 : 3600 });
    if (config.bell && beat % 4 === 0) play({ frequency: hz(pitch + 12), duration: 0.25, gain: 0.025 });
  }
  if (beat % (config.urgent ? 2 : 4) === 0) {
    play({ frequency: hz(root + (beat === 8 ? 7 : 0) - (config.dark ? 0 : 12)),
      duration: beatLength * 0.8, gain: 0.22, type: "triangle", cutoff: 650 });
  }
  if (beat === 0 || beat === 8 || (config.urgent && beat === 10)) {
    play({ frequency: 110, endFrequency: 38, duration: 0.14, gain: config.soft ? 0.12 : 0.21 });
  }
  if (beat % (config.soft ? 4 : 2) === (config.soft ? 2 : 0)) {
    play({ noise: true, duration: 0.035, gain: config.soft ? 0.018 : 0.032,
      filter: "highpass", cutoff: 3400 });
  }
  if (!config.soft && (beat === 4 || beat === 12)) {
    play({ noise: true, duration: 0.085, gain: 0.045, filter: "bandpass", cutoff: 1300 });
  }
}

// Every event handler accepts the actual bus payload and tolerates missing fields.
function listen(type, rate, callback, audible = () => true) {
  on(type, data => {
    const payload = data || {};
    if (audible(payload) && limited(type, rate)) callback(payload);
  });
}

on("scene", ({ scene } = {}) => {
  if (["title", "upgrades", "codex", "settings"].includes(scene)) playMusic("title");
});
on("waveStart", (data = {}) => {
  playMusic(data.isBoss ? "boss" : ["crypt", "frost", "void"][clamp(Math.trunc(number(data.stageIndex, 0)), 0, 2)]);
  if (limited("waveStart", 2)) notes(data.isBoss ? [43, 50, 55] : [62, 69], { gain: 0.12 });
});
on("victory", () => playMusic("victory"));
on("runEnd", (data = {}) => { if (!data.victory) playMusic("defeat"); });
listen("runStart", 2, () => notes([48, 55, 60, 67], { spacing: 0.07 }));
listen("shoot", 12, data => {
  if (data.kind === "cannon") explosion({ r: 55 }, 0.75);
  else {
    whoosh(0.5, 0.065);
    voice({ frequency: 440, endFrequency: 150, duration: 0.1, gain: 0.065, type: "triangle" });
  }
}, data => !data.quiet && data.kind !== "orb");
listen("slash", 8, data => whoosh(clamp(number(data.tier, 1), 1, 4), 0.12));
for (const type of ["burst", "explode"]) {
  on(type, (data = {}) => { if (limited("explosions", 6)) explosion(data); });
}
listen("hit", 20, data => {
  voice({ frequency: data.heavy ? 180 : 650, endFrequency: 100,
    duration: data.heavy ? 0.075 : 0.035, gain: data.heavy ? 0.12 : 0.065, type: "triangle" });
}, data => !data.dot && !data.quiet);
listen("kill", 12, data => {
  killCombo = context.currentTime - killTime < 0.3 ? (killCombo + 1) % 5 : 0;
  killTime = context.currentTime;
  voice({ frequency: 320 * 2 ** (killCombo / 12), endFrequency: 140,
    duration: 0.08, gain: 0.095 });
}, data => !data.quiet);
listen("ignite", 8, () => voice({ noise: true, duration: 0.12, gain: 0.06, cutoff: 1800, endCutoff: 600 }));
listen("playerHurt", 5, data => {
  voice({ frequency: 140, endFrequency: 45, duration: 0.23,
    gain: 0.22 + clamp(number(data.dmg, 0), 0, 30) * 0.002, type: "triangle" });
  voice({ noise: true, duration: 0.1, gain: 0.12, cutoff: 750 });
});
listen("playerDeath", 1, () => {
  voice({ frequency: 360, endFrequency: 40, duration: 1.1, gain: 0.25, type: "triangle", cutoff: 1300 });
  notes([57, 52, 48, 40], { spacing: 0.15, duration: 0.35, gain: 0.12 });
});
listen("enemySpawn", 3, () => notes([58, 59], { gain: 0.1, duration: 0.16 }), data => data.elite);
listen("enemyShoot", 6, data => {
  const pitch = { shard: 700, bone: 340, orb: 230, void: 160 }[data.kind] || 280;
  voice({ frequency: pitch, endFrequency: pitch * 0.55, duration: 0.1, gain: 0.045, type: "triangle" });
});
for (const type of ["enemyDash", "bossDash"]) listen(type, 4, () => whoosh(1.5, 0.1));
listen("bossSpawn", 1, () => {
  explosion({ r: 170 }, 1.2);
  notes([31, 38, 43], { spacing: 0.12, gain: 0.23, duration: 0.9, type: "triangle" });
});
listen("bossPhase", 1, () => notes([50, 51, 62, 63], { spacing: 0.14, duration: 0.25, gain: 0.19, type: "triangle" }));
listen("bossCast", 4, () => voice({ frequency: 120, endFrequency: 600, duration: 0.3, gain: 0.16, type: "triangle" }));
listen("bossSlam", 3, () => explosion({ r: 150 }, 1.15));
listen("bossSummon", 3, () => notes([48, 55, 63, 72], { spacing: 0.05, duration: 0.3, gain: 0.12 }));
listen("bossBlink", 4, () => {
  voice({ frequency: 900, endFrequency: 170, duration: 0.16, gain: 0.13 });
  whoosh(0.5, 0.07);
});
listen("nova", 3, () => {
  explosion({ r: 85, style: "flash" }, 0.8);
  notes([84, 91, 87], { spacing: 0.03, duration: 0.2, gain: 0.07 });
});
// ebulletHit is intentionally silent: playerHurt supplies the impact.
on("bossDeath", () => {
  if (!ready()) return;
  if (limited("bossDeath", 1)) explosion({ r: 190 }, 1.3);
  const now = context.currentTime;
  musicDuck.gain.cancelScheduledValues(now);
  musicDuck.gain.setValueAtTime(now < duckUntil ? 0.25 : 1, now);
  musicDuck.gain.linearRampToValueAtTime(0.25, now + 0.04);
  musicDuck.gain.setValueAtTime(0.25, now + 0.65);
  musicDuck.gain.linearRampToValueAtTime(1, now + 1.3);
  duckUntil = now + 1.3;
});
listen("gem", 15, data => {
  gemCombo = context.currentTime - gemTime < 0.24 ? Math.min(gemCombo + 1, 12) : 0;
  gemTime = context.currentTime;
  const frequency = hz(76 + gemCombo + (data.big ? 5 : 0));
  voice({ frequency, duration: data.big ? 0.2 : 0.1, gain: data.big ? 0.12 : 0.075 });
});
listen("heal", 4, () => notes([72, 79, 84], { gain: 0.1, duration: 0.28 }));
listen("chestOpen", 2, () => notes([60, 64, 67, 72, 79], { spacing: 0.065, gain: 0.16 }));
listen("levelUp", 2, () => notes([60, 64, 67, 72, 76, 79], { spacing: 0.07, gain: 0.16 }));
listen("jobSelectOpen", 2, () => notes([57, 64, 71, 76], { spacing: 0.015, gain: 0.11, duration: 0.8 }));
listen("jobSelected", 2, data => {
  const tier = clamp(number(data.tier, 1), 1, 4);
  voice({ frequency: 100, endFrequency: 500 + tier * 100, duration: 0.55, gain: 0.13, type: "triangle" });
  notes([48, 55, 60, 67, 72], { gain: 0.12 + tier * 0.025, duration: 0.35 + tier * 0.08 });
});
listen("waveClear", 2, () => notes([67, 72, 76], { gain: 0.12 }));
listen("stageClear", 1, () => notes([60, 64, 67, 72, 67, 79], { spacing: 0.11, gain: 0.18, duration: 0.3 }));
