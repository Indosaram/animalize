import { DEFAULT_SETTINGS, type Character, type CharacterId, type Settings } from "./types";

/**
 * Imitation presets built from the bundled animalese samples.
 * No official character audio is used; names say "느낌" on purpose.
 */
export const CHARACTERS: Character[] = [
  {
    id: "chiikawa",
    name: "치이카와 느낌",
    tagline: "작고 소심하게 쫑알쫑알",
    color: "#f9a8c9",
    face: "chiikawa",
    source: { type: "sample", gender: "female", voice: "voice_1" },
    pitch: 7,
    speed: 1.25,
    variation: 0.25,
    squeak: 0.35,
  },
  {
    id: "hachiware",
    name: "하치와레 느낌",
    tagline: "밝고 씩씩한 목소리",
    color: "#7cb7ea",
    face: "hachiware",
    source: { type: "sample", gender: "female", voice: "voice_3" },
    pitch: 4,
    speed: 1.1,
    variation: 0.2,
    squeak: 0.15,
  },
  {
    id: "usagi",
    name: "우사기 느낌",
    tagline: "우라! 예측불가 하이텐션",
    color: "#f5d24b",
    face: "usagi",
    source: { type: "sample", gender: "male", voice: "voice_2" },
    pitch: 9,
    speed: 1.4,
    variation: 0.6,
    squeak: 0.5,
  },
  {
    id: "kurimanju",
    name: "쿠리만쥬 느낌",
    tagline: "느긋하고 낮은 목소리",
    color: "#b07a4a",
    face: "kurimanju",
    source: { type: "sample", gender: "male", voice: "voice_1" },
    pitch: -5,
    speed: 0.85,
    variation: 0.1,
    squeak: 0,
  },
  ...([1, 2, 3, 4] as const).map(
    (n): Character => ({
      id: `female-${n}`,
      name: `여자 목소리 ${n}`,
      tagline: "기본 동물 말소리 스타일",
      color: "#f472b6",
      face: "female",
      source: { type: "sample", gender: "female", voice: `voice_${n}` },
      pitch: 0,
      speed: 1,
      variation: 0.2,
      squeak: 0,
    }),
  ),
  ...([1, 2, 3, 4] as const).map(
    (n): Character => ({
      id: `male-${n}`,
      name: `남자 목소리 ${n}`,
      tagline: "기본 동물 말소리 스타일",
      color: "#60a5fa",
      face: "male",
      source: { type: "sample", gender: "male", voice: `voice_${n}` },
      pitch: 0,
      speed: 1,
      variation: 0.2,
      squeak: 0,
    }),
  ),
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function findPreset(id: CharacterId): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

/**
 * Resolves a character id. "custom" is built from settings.custom over its base preset,
 * "clip" plays the user's uploaded clip. Unknown ids fall back to the first preset.
 */
export function getCharacter(id: CharacterId, settings?: Settings): Character {
  const s = settings ?? DEFAULT_SETTINGS;
  if (id === "custom") {
    const c = { ...DEFAULT_SETTINGS.custom, ...s.custom };
    const base = findPreset(c.baseCharacterId) ?? findPreset(DEFAULT_SETTINGS.custom.baseCharacterId)!;
    return {
      ...base,
      id: "custom",
      name: "나만의 목소리",
      tagline: `${base.name} 기반으로 직접 조절한 목소리`,
      face: "custom",
      pitch: clamp(c.pitch, -12, 12),
      speed: clamp(c.speed, 0.5, 2),
      variation: clamp(c.variation, 0, 1),
      squeak: clamp(c.squeak, 0, 1),
    };
  }
  if (id === "clip") {
    return {
      id: "clip",
      name: s.clip ? `내 소리: ${s.clip.name}` : "내 소리 파일",
      tagline: "올린 소리 파일로 말해요",
      color: "#a78bfa",
      face: "clip",
      source: { type: "clip" },
      pitch: 0,
      speed: 1,
      variation: 0.15,
      squeak: 0,
    };
  }
  return findPreset(id) ?? CHARACTERS[0];
}
