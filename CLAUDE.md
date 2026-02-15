# Booking OS — Project Guidelines

## Design System & UI Guidelines

### Aesthetic
We use a **"Minimalist Premium"** aesthetic — think Apple Health meets Stripe.
Lots of whitespace, subtle shadows, highly legible typography, and deliberate use of color.

### Typography
- **UI / Data font:** `Inter` (Google Fonts) — set as Tailwind's default `font-sans`.
- **Display / Header font:** `Playfair Display` (Google Fonts) — set as Tailwind's `font-serif`.
- Use `font-serif` for large metrics, page titles, and high-impact headers.
- Use `font-sans` (Inter) for body text, labels, buttons, and data.

### Color Palette
Replace standard Tailwind blues with our custom semantic palette:

**Sage (primary actions, confirmations, success):**
- 50: `#F4F7F5`, 100: `#E4EBE6`, 500: `#8AA694`, 600: `#71907C`, 900: `#3A4D41`

**Lavender (AI features, highlights, pending states):**
- 50: `#F5F3FA`, 100: `#EBE7F5`, 500: `#9F8ECB`, 600: `#8A75BD`, 900: `#4A3B69`

**Backgrounds:** Warm off-white `#FCFCFD` instead of `gray-50`.
**Default text:** `slate-800` for body, `slate-500` for secondary.

### Component Style Rules
1. **Border radii:** Use `rounded-2xl` (or `rounded-3xl` for auth cards). Avoid sharp corners.
2. **Borders:** Remove borders where possible. Prefer soft, diffused drop shadows over border lines.
3. **Shadows:** Use the custom `shadow-soft` (`0 12px 40px -12px rgba(0, 0, 0, 0.05)`) for cards and containers.
4. **Buttons:** Use `rounded-xl` with subtle hover transitions. Primary = `bg-sage-600 hover:bg-sage-700 text-white`. Dark = `bg-slate-900 hover:bg-slate-800 text-white`.
5. **Inputs:** Softer look — `bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl`.
6. **No external component libraries.** Strictly Tailwind CSS utility classes.

### Status Badge Colors
Use muted, pastel tones instead of generic traffic-light colors:
- Confirmed / Completed → `bg-sage-50 text-sage-900`
- Pending → `bg-lavender-50 text-lavender-900`
- Cancelled / No-show → `bg-red-50 text-red-700`
- In Progress → `bg-amber-50 text-amber-700`

### AI Feature Styling
All AI-related UI elements use the **lavender** palette:
- `bg-lavender-50 border border-lavender-100 text-lavender-900 rounded-xl`
