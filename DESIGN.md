# Animalize DESIGN.md

The desktop app, the Chrome popup, and the landing page (`docs/`) all share this document.

## 0. Research Log
- Embedded references: picked soft-skill (Layer A, "Soft Structuralism" archetype) + the app's existing tokens (`src/index.css`). There is a reference UI already in use, so this extracts the existing patterns instead of introducing a new brand reference.
- Lazyweb / StyleGallery / Imagen: skipped. The landing page's focal object is the real app screenshot and the actual SVG character faces, so it needs no new imagery or layout grammar (decided 2026-10-24).

## 1. Direction
A warm cream page where the real app screen floats like paper. The moment people remember: **pressing a character card actually plays that character's sound**. The audience is non-developers, so the copy is short polite Korean and every action has one big button.

## 2. Color tokens
| Token | Value | Use |
|---|---|---|
| `--bg` | `#fdf8ef` | Page background (cream) |
| `--bg-deep` | `#f7eedf` | Section separation band |
| `--ink` | `#4a3b32` | Body text, SVG outlines |
| `--ink-soft` | `#8a7565` | Secondary text |
| `--card` | `#ffffff` | Cards |
| `--line` | `#eadfce` | Hairline border |
| `--coral-300` | `#f8b4ac` | Hover background |
| `--coral-500` | `#f28b82` | Primary button, ON state |
| `--coral-700` | `#c9605a` | Pressed primary button, link text |
| `--butter` | `#ffe8a3` | Highlight badge |
| `--peach` | `#fdebd3` | Secondary button, tag |

Do not use raw hex outside this table. Character colors (Hachiware blue `#7d9cc4`, Usagi yellow `#fbe27a`, Kurimanju brown `#c98a55`) live only inside the SVGs.

## 3. Type
- Body and headings: `Pretendard` (bundled woff2 400/600/700). The app header logo alone uses `Arial Rounded MT Bold`.
- Scale (landing): 14 / 16 / 18 / 22 / 28 / 40 / 56 px. Line height 1.6 for body, 1.2 for headings.
- Korean `word-break: keep-all`.

## 4. Spacing, radius, depth
- 4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Radius: button `999px`, card `24px`, screenshot frame `28px`.
- Depth: `0 1px 0 rgba(74,59,50,.04), 0 12px 32px -12px rgba(74,59,50,.18)` (soft diffused shadow). Never a dark, hard shadow.
- Never a colored stripe along one side of a card, and never an accent outline on a rounded card. Selected state = coral fill check badge + background tint.

## 5. Primitives
| Primitive | States |
|---|---|
| Button (primary coral / secondary peach) | default, hover (lighter), active (scale .98), focus-visible (2px ink outline, offset 3px) |
| Character card (face SVG + name + one line + "들어보기") | default, hover (rises 2px), playing (peach background + "재생 중"), focus-visible |
| OS download card | default, hover, "내 컴퓨터" recommended badge (shown via OS detection) |
| Step (number circle + title + description + optional tip box) | static |
| FAQ (`details/summary`) | closed, open |

## 6. Motion
- `cubic-bezier(.32,.72,0,1)`, 200–320ms. Only transform/opacity.
- With `prefers-reduced-motion: reduce`, disable all movement.

## 7. Accessibility
- Body text contrast ≥ 4.5:1 (ink `#4a3b32` on cream `#fdf8ef` = 9.6:1; ink-soft `#8a7565` = 4.6:1).
- Touch targets ≥ 44px. All buttons reachable by keyboard; character playback is a `button`.
- Screenshots get descriptive `alt` text.

## 8. Accepted debt
- Windows SmartScreen warning: no code-signing certificate, so we explain how to get past it on the page instead.
