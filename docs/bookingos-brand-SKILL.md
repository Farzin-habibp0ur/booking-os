---
name: bookingos-brand
description: "Applies BookingOS brand styling (Sage/Lavender palette, Inter/Playfair Display typography, rounded-2xl components) to any visual output. Use whenever creating styled documents, presentations, PDFs, UI mockups, charts, or any artifact that should match BookingOS's design system. Also trigger when the user mentions brand colors, styling, design guidelines, visual formatting, or wants something to 'look like BookingOS'. This skill should be used alongside docx, pptx, pdf, and canvas-design skills to ensure correct branding."
---

# BookingOS Brand Guidelines

## Typography
- **Display / Headers:** Playfair Display (Google Fonts) — use for page titles, large metrics, high-impact headers
- **Body / UI / Data:** Inter (Google Fonts) — use for body text, labels, buttons, table data
- **Fallbacks:** Playfair Display → Georgia; Inter → Arial/Helvetica

## Color Palette

### Sage (primary actions, success, confirmations)
| Token | Hex | Usage |
|---|---|---|
| sage-50 | #F4F7F5 | Badge backgrounds |
| sage-100 | #E4EBE6 | Hover states |
| sage-500 | #8AA694 | Icons, accents |
| sage-600 | #71907C | Primary buttons, links |
| sage-900 | #3A4D41 | Badge text |

### Lavender (AI features, highlights, pending states)
| Token | Hex | Usage |
|---|---|---|
| lavender-50 | #F5F3FA | AI feature backgrounds |
| lavender-100 | #EBE7F5 | AI borders |
| lavender-500 | #9F8ECB | AI accents |
| lavender-600 | #8A75BD | AI interactive elements |
| lavender-900 | #4A3B69 | AI badge text |

### Neutrals
- Background: #FCFCFD (warm off-white — never use gray-50)
- Body text: slate-800
- Secondary text: slate-500

## Component Style Rules
1. Border radii: rounded-2xl default (rounded-3xl for auth/hero cards)
2. Borders: Avoid. Prefer soft, diffused drop shadows
3. Shadows: shadow-soft = 0 12px 40px -12px rgba(0,0,0,0.05)
4. Primary button: bg-sage-600 hover:bg-sage-700 text-white rounded-xl
5. Dark button: bg-slate-900 hover:bg-slate-800 text-white rounded-xl
6. Inputs: bg-slate-50 border-transparent focus:bg-white focus:ring-sage-500 rounded-xl
7. AI elements: Always use lavender palette (bg-lavender-50 border-lavender-100 text-lavender-900)

## Status Colors (from design-tokens.ts)
- Confirmed/Completed: sage (bg-sage-50, text-sage-900)
- Pending: lavender (bg-lavender-50, text-lavender-900)
- Cancelled/No-show: red (bg-red-50, text-red-700)
- In Progress: amber (bg-amber-50, text-amber-700)

## Design Philosophy
"Minimalist Premium" — Apple Health meets Stripe. Lots of whitespace, subtle shadows,
highly legible typography, deliberate use of color. No external component libraries.
