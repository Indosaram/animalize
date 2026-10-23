export type CharacterId = string;

export type CharacterFace =
  | "chiikawa"
  | "hachiware"
  | "usagi"
  | "kurimanju"
  | "male"
  | "female"
  | "custom"
  | "clip";

export type SampleGender = "male" | "female";
export type SampleVoice = "voice_1" | "voice_2" | "voice_3" | "voice_4";

export type CharacterSource =
  | { type: "sample"; gender: SampleGender; voice: SampleVoice }
  | { type: "clip" };

export interface Character {
  id: CharacterId;
  /** Korean display name */
  name: string;
  /** one short Korean line */
  tagline: string;
  /** hex accent */
  color: string;
  face: CharacterFace;
  source: CharacterSource;
  /** semitones, -12..12 */
  pitch: number;
  /** playbackRate 0.5..2 */
  speed: number;
  /** 0..1 random pitch jitter */
  variation: number;
  /** 0..1 mix of a short synthesized chirp layered on each syllable */
  squeak?: number;
}

export type SoundMode = "all" | "voice" | "sfx";

export interface CustomVoice {
  pitch: number;
  speed: number;
  variation: number;
  squeak: number;
  baseCharacterId: CharacterId;
}

export interface VoiceClip {
  name: string;
  dataUrl: string;
}

export interface Settings {
  enabled: boolean;
  /** 0..1 */
  volume: number;
  characterId: CharacterId;
  mode: SoundMode;
  custom: CustomVoice;
  clip: VoiceClip | null;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  volume: 0.6,
  characterId: "chiikawa",
  mode: "all",
  custom: { pitch: 0, speed: 1, variation: 0.2, squeak: 0, baseCharacterId: "female-1" },
  clip: null,
};
