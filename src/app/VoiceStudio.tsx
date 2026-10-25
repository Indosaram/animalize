import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Volume2, VolumeX } from "lucide-react";

import {
  CHARACTERS,
  DEFAULT_SETTINGS,
  getCharacter,
  type Character,
  type Settings,
  type SettingsStore,
  type SoundMode,
  type VoiceEngine,
} from "@/engine";
import { CharacterFace } from "@/components/characters/CharacterFace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const PREVIEW_LINE = "안녕 반가워";

const MODES: { value: SoundMode; label: string }[] = [
  { value: "all", label: "목소리+효과음" },
  { value: "voice", label: "목소리만" },
  { value: "sfx", label: "효과음만" },
];

const FEATURED = CHARACTERS.filter((c) => !c.id.startsWith("female-") && !c.id.startsWith("male-"));
const BASIC = CHARACTERS.filter((c) => c.id.startsWith("female-") || c.id.startsWith("male-"));

export interface VoiceStudioProps {
  engine: VoiceEngine;
  store: SettingsStore;
  platform: "desktop" | "extension";
  extra?: ReactNode;
}

function CharacterCard({
  character,
  selected,
  compact,
  onSelect,
}: {
  character: Character;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-character={character.id}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-ring/40",
        compact ? "min-h-16" : "min-h-20 flex-col justify-center text-center sm:p-4",
        selected ? "border-transparent shadow-md" : "border-border",
      )}
      style={selected ? { boxShadow: `0 0 0 3px ${character.color}` } : undefined}
    >
      <CharacterFace face={character.face} size={compact ? 44 : 64} />
      <span className={cn("flex min-w-0 flex-col gap-0.5", compact ? "" : "items-center")}>
        <span className="text-[15px] font-bold leading-tight">{character.name}</span>
        <span className="text-xs leading-snug text-muted-foreground">{character.tagline}</span>
      </span>
      {selected ? (
        <span
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-white"
          style={{ background: character.color }}
          aria-label="선택됨"
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">{display}</span>
      </div>
      <Slider aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

export default function VoiceStudio({ engine, store, platform, extra }: VoiceStudioProps) {
  const [settings, setSettingsState] = useState<Settings>(() => engine.getSettings());
  const [loaded, setLoaded] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compact = platform === "extension";

  useEffect(() => {
    let alive = true;
    store.load().then(async (s) => {
      if (!alive) return;
      engine.setSettings(s);
      setSettingsState(s);
      setLoaded(true);
    });
    const unsubscribe = store.subscribe?.((s) => {
      engine.setSettings(s);
      setSettingsState(s);
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [engine, store]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsState((prev) => {
        const next: Settings = {
          ...prev,
          ...patch,
          custom: { ...prev.custom, ...(patch.custom ?? {}) },
          packs: patch.packs ?? prev.packs,
        };
        engine.setSettings(next);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void store.save(next), 150);
        return next;
      });
    },
    [engine, store],
  );

  const selectCharacter = (id: string) => {
    update({ characterId: id });
    void engine.speak(PREVIEW_LINE);
  };

  const current = getCharacter(settings.characterId, settings);
  const custom = { ...DEFAULT_SETTINGS.custom, ...settings.custom };

  return (
    <div className={cn("mx-auto flex w-full flex-col gap-4", compact ? "max-w-[400px] p-3" : "max-w-5xl p-6 sm:p-8")} data-loaded={loaded}>
      <header
        className={cn(
          "flex items-center justify-between gap-4 rounded-2xl border-2 bg-card shadow-sm",
          compact ? "p-3" : "p-5",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <CharacterFace face={current.face} size={compact ? 44 : 60} />
          <div className="min-w-0">
            <h1 className={cn("font-bold leading-tight", compact ? "text-lg" : "text-2xl")}>Animalize</h1>
            <p className="text-sm break-keep text-muted-foreground">
              지금 목소리: <span className="font-semibold text-foreground">{current.name}</span>
            </p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-3">
          <span className="flex flex-col items-end">
            <span className="text-sm font-bold">타자 소리 켜기</span>
            <span className={cn("text-xs font-semibold", settings.enabled ? "text-primary" : "text-muted-foreground")}>
              {settings.enabled ? "켜짐" : "꺼짐"}
            </span>
          </span>
          <Switch
            aria-label="타자 소리 켜기"
            checked={settings.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
            className={compact ? "" : "h-10 w-[4.5rem] [&>span]:size-9 [&>span]:data-[state=checked]:translate-x-8"}
          />
        </label>
      </header>

      {extra}

      <section className="flex flex-col gap-3" aria-labelledby="pick-title">
        <h2 id="pick-title" className="text-lg font-bold">
          누구 목소리로 할까요?
        </h2>
        <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3")}>
          {FEATURED.map((c) => (
            <CharacterCard key={c.id} character={c} compact={compact} selected={settings.characterId === c.id} onSelect={() => selectCharacter(c.id)} />
          ))}
        </div>
        <h3 className="pt-2 text-base font-bold">동물의숲 목소리</h3>
        <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
          {BASIC.map((c) => (
            <CharacterCard key={c.id} character={c} compact selected={settings.characterId === c.id} onSelect={() => selectCharacter(c.id)} />
          ))}
        </div>
      </section>

      <div className={cn("grid gap-4", compact ? "" : "md:grid-cols-2")}>
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="volume" className="text-base">
                  {settings.volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                  소리 크기
                </Label>
                <span className="text-sm font-semibold tabular-nums">{Math.round(settings.volume * 100)}%</span>
              </div>
              <Slider id="volume" aria-label="소리 크기" value={[settings.volume]} min={0} max={1} step={0.05} onValueChange={([volume]) => update({ volume })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-base">어떤 소리를 낼까요?</Label>
              <ToggleGroup type="single" value={settings.mode} onValueChange={(v) => v && update({ mode: v as SoundMode })} aria-label="어떤 소리를 낼까요?">
                {MODES.map((m) => (
                  <ToggleGroupItem key={m.value} value={m.value}>
                    {m.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>여기에 타자를 쳐 보세요</CardTitle>
            <CardDescription>한글, 영어 모두 소리가 나요.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              data-testid="try-box"
              aria-label="여기에 타자를 쳐 보세요"
              placeholder="안녕하세요! hello"
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.key === "Process") return;
                if (e.key.length > 1 && !["Enter", "Backspace", "Tab", "Delete"].includes(e.key) && !e.key.startsWith("Arrow")) return;
                engine.handleKey(e.key === " " ? "Space" : e.key);
              }}
              onInput={(e) => {
                const ev = e.nativeEvent as InputEvent;
                if (ev.isComposing && ev.data) engine.handleKey(ev.data.slice(-1));
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <button
          type="button"
          className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left"
          onClick={() => setShowCustom((v) => !v)}
          aria-expanded={showCustom}
        >
          <span className="flex items-center gap-3">
            <CharacterFace face="custom" size={36} />
            <span>
              <span className="block font-bold">내 목소리 만들기</span>
              <span className="block text-sm text-muted-foreground">높낮이와 빠르기를 직접 바꿔요</span>
            </span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 transition-transform", showCustom && "rotate-180")} />
        </button>
        {showCustom ? (
          <div className="grid gap-6 border-t-2 px-5 py-5">
            <div className="flex flex-col gap-4">
              <SliderRow label="높낮이" value={custom.pitch} min={-12} max={12} step={1} display={custom.pitch > 0 ? `+${custom.pitch}` : `${custom.pitch}`} onChange={(pitch) => update({ custom: { ...custom, pitch } })} />
              <SliderRow label="빠르기" value={custom.speed} min={0.5} max={2} step={0.05} display={`${custom.speed.toFixed(2)}배`} onChange={(speed) => update({ custom: { ...custom, speed } })} />
              <SliderRow label="흔들림" value={custom.variation} min={0} max={1} step={0.05} display={`${Math.round(custom.variation * 100)}%`} onChange={(variation) => update({ custom: { ...custom, variation } })} />
              <SliderRow label="삑삑 소리" value={custom.squeak} min={0} max={1} step={0.05} display={`${Math.round(custom.squeak * 100)}%`} onChange={(squeak) => update({ custom: { ...custom, squeak } })} />
              <div className="flex flex-col gap-1">
                <Label htmlFor="base-voice">바탕 목소리</Label>
                <select
                  id="base-voice"
                  className="min-h-11 rounded-xl border-2 bg-white px-3 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                  value={custom.baseCharacterId}
                  onChange={(e) => update({ custom: { ...custom, baseCharacterId: e.target.value } })}
                >
                  {CHARACTERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="lg"
                variant={settings.characterId === "custom" ? "secondary" : "default"}
                onClick={() => selectCharacter("custom")}
              >
                {settings.characterId === "custom" ? "지금 이 목소리를 쓰고 있어요" : "이 목소리 쓰기"}
              </Button>
            </div>

          </div>
        ) : null}
      </Card>

      <p className="text-center text-xs text-muted-foreground">캐릭터 목소리는 분위기를 흉내 낸 합성 효과이며 공식 음성이 아닙니다.</p>
    </div>
  );
}
