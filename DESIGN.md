# 통통뱀터 — Design System

**World:** Planet B-612 under the night sky (어린왕자).  
**Mode:** Operate (study app) with Persuade-strength brand on Home.  
**Dials:** VARIANCE 8 · MOTION 7 · DENSITY 4

## Thesis
Swallow whole sentences like stars — not another lavender SaaS card grid.

## Palette (Committed)
| Role | Token | Hex | Note |
|------|-------|-----|------|
| Night sky | `--sky` | `#0F1B2D` | Study immersion |
| Dusk | `--dusk` | `#1C2D48` | Panels / navbar |
| Sand | `--sand` | `#E6D2AE` | Soft islands (not cards) |
| Rose | `--rose` | `#C45C6A` | Primary CTA / the rose |
| Fox | `--fox` | `#D4894A` | Secondary warmth |
| Star | `--star` | `#F0E4A0` | Rewards / completed |
| Ink | `--ink` | `#F4EFE6` | Text on night |
| Muted | `--ink-muted` | `#9AA8BC` | Secondary on night |

Legacy `--clay-*` aliases map into this world for compatibility.

## Typography
- **Display / brand:** **Gaegu** (hand-sketch planet notebook)
- **UI:** **Sora** + **Noto Sans KR**
- **Script accent:** Caveat (English flourishes only)

Scale: 12 / 14 / 16 / 20 / 28 / 40 (rem-based), display max ~2.75rem on mobile.

## Motion grammar
- Screen enter: soft rise + fade (already-visible default)
- Number roll on hero stats
- Typing sparks on study word boxes
- Success: rose pulse + short haptic (`navigator.vibrate`)
- Respect `prefers-reduced-motion`

## Anti-patterns (banned)
- Purple→indigo mesh gradients
- Equal feature cards with icon+title+text
- Nested cards
- Panel eyebrows / kickers above headings
- Treating articles as “correct enough” in grading

## Spacing
4 / 8 / 12 / 16 / 24 / 40. Tight within groups; generous between sections.
