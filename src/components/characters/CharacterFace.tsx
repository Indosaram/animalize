import { cn } from "@/lib/utils";

export type FaceKind = "chiikawa" | "hachiware" | "usagi" | "kurimanju" | "male" | "female" | "custom" | "clip";

const INK = "#4a3b32";

function Eyes({ y = 52, gap = 14, r = 3.4 }: { y?: number; gap?: number; r?: number }) {
  return (
    <g fill={INK}>
      <circle cx={50 - gap} cy={y} r={r} />
      <circle cx={50 + gap} cy={y} r={r} />
    </g>
  );
}

function Cheeks({ y = 60, gap = 22, color = "#f8b4c0" }: { y?: number; gap?: number; color?: string }) {
  return (
    <g fill={color} opacity={0.85}>
      <ellipse cx={50 - gap} cy={y} rx={6} ry={3.6} />
      <ellipse cx={50 + gap} cy={y} rx={6} ry={3.6} />
    </g>
  );
}

function Chiikawa() {
  return (
    <>
      <circle cx={27} cy={26} r={10} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <circle cx={73} cy={26} r={10} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={50} cy={56} rx={36} ry={33} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <Eyes y={54} gap={13} r={3.6} />
      <Cheeks y={62} gap={22} />
      <path d="M46 62 q4 4 8 0" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Hachiware() {
  return (
    <>
      <path d="M20 40 L24 12 L42 28 Z" fill="#fff" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M80 40 L76 12 L58 28 Z" fill="#fff" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <ellipse cx={50} cy={57} rx={36} ry={32} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <path d="M16 52 Q18 26 50 25 Q82 26 84 52 Q70 38 50 50 Q30 38 16 52 Z" fill="#7d9cc4" />
      <Eyes y={58} gap={13} />
      <Cheeks y={66} gap={22} />
      <path d="M44 65 q6 6 12 0" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Usagi() {
  return (
    <>
      <ellipse cx={36} cy={22} rx={8} ry={20} fill="#fbe27a" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={64} cy={22} rx={8} ry={20} fill="#fbe27a" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={50} cy={60} rx={34} ry={30} fill="#fbe27a" stroke={INK} strokeWidth={2.5} />
      <Eyes y={54} gap={12} r={3} />
      <ellipse cx={50} cy={70} rx={9} ry={8} fill="#e8736a" stroke={INK} strokeWidth={2} />
      <Cheeks y={62} gap={22} color="#f6a6a0" />
    </>
  );
}

function Kurimanju() {
  return (
    <>
      <path d="M50 18 C78 18 88 48 86 64 C84 82 68 90 50 90 C32 90 16 82 14 64 C12 48 22 18 50 18 Z" fill="#c98a55" stroke={INK} strokeWidth={2.5} />
      <path d="M22 50 C34 44 66 44 78 50" fill="none" stroke="#a8693a" strokeWidth={3} strokeLinecap="round" />
      <path d="M34 60 q4 -3 8 0 M58 60 q4 -3 8 0" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M44 72 q6 4 12 0" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <Cheeks y={68} gap={22} color="#e6a07c" />
    </>
  );
}

function Villager({ tone }: { tone: "male" | "female" }) {
  const fill = tone === "male" ? "#bcdcf2" : "#fbd0dc";
  const ear = tone === "male" ? "#8fbfe3" : "#f4a9be";
  return (
    <>
      <circle cx={26} cy={30} r={11} fill={ear} stroke={INK} strokeWidth={2.5} />
      <circle cx={74} cy={30} r={11} fill={ear} stroke={INK} strokeWidth={2.5} />
      <circle cx={50} cy={56} r={34} fill={fill} stroke={INK} strokeWidth={2.5} />
      <Eyes y={54} gap={13} />
      <ellipse cx={50} cy={64} rx={5} ry={3.5} fill={INK} />
      {tone === "female" ? (
        <path d="M66 24 l8 -6 l2 10 Z M66 24 l10 4 l-8 6 Z" fill="#f28b82" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      ) : null}
    </>
  );
}

function CustomIcon() {
  return (
    <>
      <rect x={12} y={12} width={76} height={76} rx={22} fill="#fff3d6" stroke={INK} strokeWidth={2.5} />
      {[30, 50, 70].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={26} x2={x} y2={74} stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <circle cx={x} cy={[40, 60, 34][i]} r={7} fill="#f28b82" stroke={INK} strokeWidth={2.5} />
        </g>
      ))}
    </>
  );
}

function ClipIcon() {
  return (
    <>
      <rect x={12} y={12} width={76} height={76} rx={22} fill="#e4f3e8" stroke={INK} strokeWidth={2.5} />
      <rect x={40} y={24} width={20} height={34} rx={10} fill="#8fd1a4" stroke={INK} strokeWidth={2.5} />
      <path d="M32 48 q0 18 18 18 q18 0 18 -18" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={50} y1={66} x2={50} y2={76} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
    </>
  );
}

export function CharacterFace({ face, size = 64, className }: { face: FaceKind; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={cn("shrink-0", className)} aria-hidden="true">
      {face === "chiikawa" && <Chiikawa />}
      {face === "hachiware" && <Hachiware />}
      {face === "usagi" && <Usagi />}
      {face === "kurimanju" && <Kurimanju />}
      {(face === "male" || face === "female") && <Villager tone={face} />}
      {face === "custom" && <CustomIcon />}
      {face === "clip" && <ClipIcon />}
    </svg>
  );
}
