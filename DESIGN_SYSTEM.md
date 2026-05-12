# PRISM-AI Design System — **M · Construction Paper Collage**

> Authoritative spec for the PRISM-AI frontend (`PRISM-ai--web/`). Written 2026-05-07.
> Direction picked from a 14-specimen gallery on 2026-05-07 ([see `playwright_screenshots/spec-M-craft.png`](playwright_screenshots/spec-M-craft.png)).
> Methodology: Anthropic's [frontend-design skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) (generator-evaluator loop) with Playwright MCP for visual evaluation.

---

## 1. Vision

PRISM-AI is a face-recognition attendance system for **Malaysian primary schools**. The audience is teachers, school admins, and parents — none of whom care for typical SaaS dashboards.

The design thesis: **"a school's morning, made of paper."** Every screen is a hand-cut, hand-stuck collage — the kind you'd find on a Year-2 classroom wall. The aesthetic resists "AI slop" by committing fully to a maximalist, *handmade* visual language. Where most edtech tools default to rounded blue cards on white, we use:

- **Cut-paper word blocks** (each word in a different colour, slightly rotated, with irregular `clip-path` scissor edges) for headlines.
- **Masking tape** strips at the corners of cards.
- **Hand-drawn dashed and dotted borders** instead of hairline rules.
- **Doodled red-pen arrows** as decorative accents.
- **Patrick Hand** body copy and **Caveat** handwritten section dividers — typographically the page reads like a hand-set note, but the *words* are the product's, not the designer's.
- **JetBrains Mono** for timestamps, IDs, percentages — the "official record" type.
- **Fraunces 900** as the cut-paper display face — heavy serif that holds up at huge sizes.

### Differentiator (the "one thing they'll remember")

The **cut-paper word headline**. Every page has one. Each word is a polygon-clipped coloured rectangle, individually rotated −2° to +2°, set in heavy Fraunces. No other school admin tool looks like this; nothing else in the AI-edtech space looks like this.

---

## 2. Palette

CSS custom properties in `src/index.css`. Use `var(--token)` everywhere.

### Paper tones (backgrounds, text)

| Token            | Hex       | Use |
|------------------|-----------|-----|
| `--paper`        | `#F1E4C8` | Page background. The "craft paper" base. |
| `--paper-light`  | `#FAF1DA` | Card background, input background. |
| `--paper-deep`   | `#E8D9B5` | Hover state, subtle alternation. |
| `--ink`          | `#1F1A12` | Primary text colour, dark element bg (sidebar, footer, primary buttons). |
| `--ink-soft`     | `#4A3F2C` | Secondary text. |
| `--ink-faint`    | `#756A4F` | Tertiary text, placeholders. |

### Construction-paper colours (the "five crayons")

| Token       | Hex       | Use |
|-------------|-----------|-----|
| `--red`     | `#E04A3F` | Absent, error, destructive action, "Form Teacher", red-pen accent. |
| `--yellow`  | `#F2C744` | Highlight, demo card, active sidebar link, school-bus accent. |
| `--blue`    | `#2F75C9` | Information, primary link, "Teacher" role badge, line charts. |
| `--green`   | `#4FA764` | Present, success, "Parent" role badge, attendance bars. |
| `--orange`  | `#EA8534` | Late, warning, secondary action, bar charts. |
| `--pink`    | `#F49AB6` | Soft tint variant for subtle differentiation in card grids. |

Each colour has a `-deep` variant (`--red-deep`, `--blue-deep`, etc.) for hover/active states. **Never invent new colours.** If a piece needs a tint, lighten the paper background or use one of the existing five.

### Decorative

| Token         | Value                              | Use |
|---------------|------------------------------------|-----|
| `--tape`      | `rgba(255,230,140,0.72)`           | Masking-tape decorative strip. |
| `--tape-deep` | `rgba(255,210,100,0.85)`           | Variant for darker contexts. |
| `--shadow-paper` | `0 6px 0 rgba(31,26,18,0.12)`   | Solid offset shadow under cards (no blur). |
| `--shadow-card`  | `0 12px 28px -10px rgba(31,26,18,0.18)` | Soft drop shadow for elevated elements (modals, sticky CTAs). |

### Status mapping (use consistently across the product)

| Status    | Colour       | Badge class       |
|-----------|--------------|-------------------|
| Present   | `--green`    | `.badge-present`  |
| Absent    | `--red`      | `.badge-absent`   |
| Late      | `--orange`   | `.badge-late`     |
| Info      | `--blue`     | `.badge-info`     |
| Highlight | `--yellow`   | `.badge-yellow`   |

---

## 3. Typography

Four typefaces. All loaded via Google Fonts in `src/index.css`. Never add a fifth.

| Token        | Font             | Weight   | Use |
|--------------|------------------|----------|-----|
| `--display`  | **Fraunces**     | 900      | Page headlines (cut-paper words), big stat numbers, card titles, modal titles. Always 900. |
| `--body`     | **Patrick Hand** | 400      | All body copy. Card descriptions. List items. Form input text. |
| `--accent`   | **Caveat**       | 500/700  | Handwritten labels, eyebrows, doodle phrases, demo-card titles, error messages. |
| `--mono`     | **JetBrains Mono** | 400-600 | Timestamps, IDs, percentages, table column headers, breadcrumbs, dates, the "official record" type. |

### Type scale (defined in `index.css` global `h1-h4`)

| Level | Size                               | Weight | Family   |
|-------|------------------------------------|--------|----------|
| `h1`  | `clamp(48px, 6.5vw, 96px)`         | 900    | Fraunces |
| `h2`  | `clamp(36px, 4vw, 64px)`           | 900    | Fraunces |
| `h3`  | `clamp(22px, 2vw, 32px)`           | 900    | Fraunces |
| `h4`  | `19px`                             | 900    | Fraunces |
| `p`   | `17px`                             | 400    | Patrick Hand |

### Body text

- **Default size:** 17px (set on `body`).
- **Line height:** 1.55.
- **Patrick Hand** at 17–19px reads well; below 14px it gets fatigueing — fall back to `--mono` for small data text.

### Decorative type rules

- **Caveat** is *always* slightly rotated (−2° or −1°) — it's handwriting; it shouldn't sit flat.
- **Fraunces 900** word blocks are individually rotated (see §5 cut-paper words).
- **JetBrains Mono** is *never* rotated — it's the "official record" face. Set it in uppercase with letter-spacing 0.16em for table headers / breadcrumbs.

---

## 4. Cut-paper system

The signature element. Five `clip-path` polygons defined in `:root`:

```css
--cut-1: polygon(0 6%, 8% 0, 92% 3%, 100% 12%, 98% 92%, 90% 100%, 4% 96%, 0 86%);
--cut-2: polygon(0 4%, 6% 0, 94% 6%, 100% 14%, 99% 88%, 94% 100%, 6% 96%, 1% 90%);
--cut-3: polygon(0 8%, 12% 0, 88% 4%, 100% 18%, 98% 90%, 92% 100%, 8% 95%, 0 85%);
--cut-4: polygon(2% 4%, 10% 0, 90% 6%, 100% 16%, 96% 90%, 88% 100%, 8% 96%, 0 88%);
--cut-pill: polygon(0 14%, 8% 0, 94% 4%, 100% 20%, 98% 80%, 92% 100%, 6% 96%, 0 82%);
```

| Polygon      | When to use |
|--------------|-------------|
| `--cut-1`    | Default for cards and large word-headline blocks. |
| `--cut-2`    | Default for stat cells, form cards, modals. |
| `--cut-3`    | Method/feature cards, alternating with `--cut-2`. |
| `--cut-4`    | Variation for nth-child diversity. |
| `--cut-pill` | Buttons (esp. small ones), badges, avatars, status dots. |

**Rotation is mandatory.** Every cut-paper element gets a rotation between **−3° and +3°**. Use `:nth-child` rules to vary them — never let two adjacent cards rotate the same direction. Rule of thumb:

```css
.card:nth-child(2n) { transform: rotate(1deg); }
.card:nth-child(3n) { transform: rotate(-1.5deg); }
.card:nth-child(4n) { transform: rotate(0.8deg); }
```

### Border radius

**Don't use border-radius.** All paper edges are `clip-path`-based. The only exception: `border-radius: 50%` for tiny circular dots inside chart legends or notification indicators (and even those should prefer `--cut-pill` where size allows).

---

## 5. Cut-paper word headlines (`.word`)

The hero device. Every major page heading uses these.

```html
<h1>
  <span class="word k">Every</span>
  <span class="word y">child</span><br/>
  <span class="word r">accounted</span>
  <span class="word k">for,</span><br/>
  <span class="word b">before</span>
  <span class="word g">the</span>
  <span class="word k">bell.</span>
</h1>
```

### `.word` colour modifiers

| Class      | Background         | Text       | Rotation | Clip   |
|------------|--------------------|------------|----------|--------|
| `.word.r`  | `--red`            | paper-light| `+2°`    | cut-1  |
| `.word.y`  | `--yellow`         | ink        | `-2°`    | cut-2  |
| `.word.b`  | `--blue`           | paper-light| `+1°`    | cut-3  |
| `.word.g`  | `--green`          | paper-light| `-1°`    | cut-2  |
| `.word.o`  | `--orange`         | paper-light| `+2°`    | cut-4  |
| `.word.k`  | `--ink`            | paper-light| `-1°`    | cut-1  |
| `.word.p`  | `--paper-light`    | ink        | `+1°`    | cut-3  |

### Rules

- **Use 5–8 words max** per headline. More than that and it stops reading.
- **Black (`.k`) is the default.** Coloured words are emphasis — never colour every word.
- **Pair black with one or two colours.** "Every (k) child (y) accounted (r) for (k)." Not all five colours in one headline.
- **One headline per page.** The page-header h1. Section h2s can use them sparingly.
- **Keep heights aligned** — break to `<br/>` between word groups for cadence.

---

## 6. Tape strips (`.tape`)

A decorative absolute-positioned div. **Use as a `<span class="tape tl" />` inside a positioned parent.**

```html
<div class="card">
  <span class="tape tl" />
  <span class="tape tr" />
  ... card content ...
</div>
```

| Class      | Position                           |
|------------|------------------------------------|
| `.tape`    | 90×26px yellow-translucent strip with subtle drop shadow. |
| `.tl`      | Top-left, `rotate(-12deg)`.        |
| `.tr`      | Top-right, `rotate(12deg)`.        |
| `.bl`      | Bottom-left, `rotate(8deg)`.       |
| `.br`      | Bottom-right, `rotate(-8deg)`.     |

### Rules

- **One tape per card** is the default. Two on hero cards (tl + tr).
- **Vary positions across a grid.** Don't put `.tl` on every card. Cycle `tl → tr → bl → br` based on index.
- **No tape on the global page background.** It's a card-level device.
- **Page-level tape (decorative, at the corners of the whole page):** uses `.page-tape-tl` / `.page-tape-tr` defined in Landing.css and Login.css. Only on landing-style pages.

---

## 7. Component library

All components are defined globally in `src/index.css`. Page CSS files **must not redefine** them.

### Buttons (`.btn`)

```html
<button class="btn btn-primary">Take a peek →</button>
```

Variants:

| Class            | Bg                | Fg              | Use |
|------------------|-------------------|-----------------|-----|
| `.btn-primary`   | `--ink`           | `--paper-light` | Default CTAs. |
| `.btn-secondary` | `--blue`          | `--paper-light` | Information actions. |
| `.btn-danger`    | `--red`           | `--paper-light` | Destructive (delete). |
| `.btn-warm`      | `--orange`        | `--paper-light` | Warning actions. |
| `.btn-yellow`    | `--yellow`        | `--ink`         | "Add" / additive actions. |
| `.btn-green`     | `--green`         | `--paper-light` | Success / confirm. |
| `.btn-outline`   | `--paper-light`   | `--ink`         | Secondary alternative. 2px ink border. |

All buttons use `clip-path: var(--cut-1)`, Fraunces 900 13–15px. Hover lifts `translateY(-2px) rotate(-1deg)`.

### Badges (`.badge`)

Status pills as little coloured paper tags. Caveat 700, slightly rotated, with a tiny status dot prefix.

```html
<span class="badge badge-present">Yes!</span>
<span class="badge badge-absent">Out</span>
<span class="badge badge-late">Late</span>
```

Variants: `.badge-present` (green), `.badge-absent` (red), `.badge-late` (orange), `.badge-info` (blue), `.badge-yellow`.

### Cards

```html
<div class="card">
  <span class="tape tl" />
  ... content ...
</div>
```

- `.card` — paper-light bg, `clip-path: var(--cut-2)`, `box-shadow: var(--shadow-paper)`, 28×32px padding.
- `.card.tilt-l` — adds `rotate(-1deg)`.
- `.card.tilt-r` — adds `rotate(1deg)`.

### Stat cells (`.stat-card`)

Replaces the old icon-stat-card pattern. Big Fraunces 900 number, Patrick Hand label.

```html
<div class="stat-card s-blue">
  <span class="tape tl" />
  <div class="stat-info">
    <h3>15</h3>
    <p>Total pupils</p>
  </div>
</div>
```

Colour variants: `.s-red` `.s-yellow` `.s-blue` `.s-green` `.s-orange`. The numerals render at 80px. Hover lifts the card.

**Mapping convention** (apply consistently):
- Total / count → `.s-blue`
- Present / good → `.s-green`
- Absent / bad → `.s-red`
- Late / warning → `.s-orange`
- Misc / highlight → `.s-yellow`

### Avatars (`.avatar`)

Coloured paper square with serif initials (no circles). `clip-path: var(--cut-pill)`, Fraunces 900 16px, `rotate(-2deg)`.

```html
<div className="avatar r">AI</div>
```

Colours: `.r .y .g .o .k`. Cycle by index in lists: `['r','y','b','g','o'][i % 5]`.

### Forms

- `.search-input` — bordered, `clip-path: var(--cut-2)`, `:focus { background: var(--yellow) }`.
- `.form-group label` — Caveat 700 22px red, rotated −1°.
- `.form-group input/select/textarea` — 2px ink border, `clip-path: var(--cut-2)`, paper-light bg, focus turns yellow.
- `.field-error` — Caveat 18px red, rotated.

### Other

- `.eyebrow` — Caveat 700 22px red, rotated −2°. Use above page-header h1.
- `.pencil-link` — Caveat 700 22px blue with hand-drawn underline-on-hover.
- `.doodle-arrow` — Inline Caveat red arrow `↘` rotated −3°.
- `.tag-mono` — JetBrains Mono 11px uppercase tracking 0.16em.

---

## 8. Layout

### Page container

- Max width: 1280px.
- Side padding: 32px desktop, 24px mobile.
- Vertical rhythm: 96px between sections, 64px below page-header.

### Grids

`.grid-2 .grid-3 .grid-4` — defined globally with 24px gap, responsive (collapses 4→2→1, 3→2→1, 2→1).

### Page header

```html
<div className="page-header">
  <div>
    <span className="eyebrow">~ today's class ~</span>
    <h1>
      <span className="word k">The</span>
      <span className="word y">morning</span>
      <span className="word r">roll.</span>
    </h1>
    <p className="page-subtitle">Thursday, 7 May 2026 <span className="doodle-arrow">↘</span></p>
  </div>
  <div className="page-actions">
    <button className="btn btn-outline">Mark all in</button>
    <button className="btn btn-primary">Manual check-in</button>
  </div>
</div>
```

`.page-header` has a `border-bottom: 3px dashed var(--ink)`.

### Dashboard layout

- **Sidebar** (`DashboardLayout.jsx`): 260px wide, `--ink` background, `--paper-light` text. Section labels in Caveat italic yellow. Active nav item: yellow paper-cut rectangle, Fraunces 900, rotated −1°.
- **Topbar:** 76px tall, `--paper` bg, dashed bottom rule, breadcrumb (mono "/") + search + bell + user-avatar.
- **Content area:** 32–36px padding.

---

## 9. Motion

### Page-load reveal

```css
@keyframes paper-rise {
  from { opacity: 0; transform: translateY(18px) rotate(-3deg); }
  to   { opacity: 1; transform: translateY(0) rotate(0); }
}
```

`.reveal` triggers it. `.reveal-1` through `.reveal-5` add 0.05s, 0.15s, 0.25s, 0.35s, 0.45s delay for staggered cascade.

**Use sparingly.** One stagger per page (hero entry). Don't pepper micro-animations everywhere.

### Hover states

- Buttons: `translateY(-2px) rotate(-1deg)`.
- Cards: `translateY(-3px) rotate(-1deg)` on `:hover`.
- Search/inputs on `:focus`: `background: var(--yellow)`.

### What to avoid

- No spring/bounce easing — paper is heavy, not bouncy.
- No fade-on-scroll — too generic.
- No parallax.
- No skeleton shimmer — use existing skeleton with paper colours.

---

## 10. Recharts overrides

Charts inherit M aesthetics via global selectors in `index.css`:

```css
.recharts-text {
  font-family: var(--mono) !important;
  font-size: 11px !important;
  fill: var(--ink-soft) !important;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.recharts-cartesian-grid line {
  stroke: rgba(31,26,18,0.16) !important;
  stroke-dasharray: 3 4;
}
.recharts-default-tooltip {
  background: var(--paper-light) !important;
  border: 2px solid var(--ink) !important;
  clip-path: var(--cut-2);
}
```

**Pass M palette colours via component props:**

```jsx
<Bar fill="#4FA764" />          {/* present → green */}
<Bar fill="#EA8534" />          {/* late → orange */}
<Bar fill="#E04A3F" />          {/* absent → red */}
<Line stroke="#2F75C9" strokeWidth={3} />   {/* trend → blue */}

<Pie>
  <Cell fill="#4FA764" />
  <Cell fill="#E04A3F" />
  <Cell fill="#EA8534" />
</Pie>
```

Always use M palette hex values verbatim. Never call colour names like `"green"`.

---

## 11. Voice and copy

**Copy is owned by product, not by design.** This direction does **not** rewrite user-facing strings. Headlines, button labels, section titles, badge text, table headers — all match the source content verbatim. The visual treatment (cut-paper word blocks, paper colours, type pairing) wraps around the existing copy without replacing it.

### Rules

- **Do not invent new copy** when applying M to a page. If the source says "Sign In", the cut-paper button reads "Sign In", not "Open the door".
- **Do not add Caveat eyebrow phrases** that aren't in the source content (e.g. "~ today's class ~", "~ a quiet day ~"). Caveat is a typography choice, not a place to insert tone.
- **Status badges** keep the source wording: "Present", "Absent", "Late" — not "Yes!", "Out", etc.
- **Headlines split across `.word` blocks** must use the original text. Break the original heading into word blocks; do not paraphrase.
- **No CSS `content:` text-injection** for decorative phrases. Decoration uses shapes, lines, tape, colours — not added words.

If a page genuinely needs new copy (e.g. an empty-state message), keep it plain and write it the same way the rest of the product writes — the visual treatment will do the personality work.

---

## 12. Accessibility

- **Contrast:** All paper-light/ink text combinations pass WCAG AA. Coloured backgrounds with paper-light text (red, blue, green, orange) all meet AA at 17px+.
- **Yellow background:** Use `--ink` text on `--yellow` (not paper-light) — yellow + light text fails contrast.
- **Patrick Hand readability:** 17px is the floor. Anything smaller switches to JetBrains Mono.
- **Focus states:** All interactive elements have `:focus { background: var(--yellow) }` or visible ring.
- **Rotation:** Slight rotations (≤3°) don't impair readability. Skewed/severely-rotated text is forbidden.
- **Motion:** Page-rise stagger respects `prefers-reduced-motion: reduce` (TODO — add `@media (prefers-reduced-motion)` override that disables `.reveal` animations).

---

## 13. File structure

```
PRISM-ai--web/
├─ index.html               ← Google Fonts preconnect; title "PRISM-AI — School Almanac"
├─ public/
│  └─ specimens/            ← 14 design-direction specimens (kept as reference)
└─ src/
   ├─ index.css             ← THE design system. CSS vars, base styles, all utility classes (.word, .badge, .tape, .stat-card, etc.)
   ├─ App.jsx               ← Routes
   ├─ App.css               ← (intentionally minimal — comment only)
   ├─ layouts/
   │  ├─ DashboardLayout.jsx
   │  └─ DashboardLayout.css   ← Sidebar (ink bg, yellow tape, Caveat section labels) + topbar
   ├─ pages/
   │  ├─ Landing.{jsx,css}      ← masthead, cut-paper hero, features grid, method, FAQ, footer
   │  ├─ Login.{jsx,css}        ← split layout, paper-cut form, role tabs as coloured rectangles
   │  ├─ Dashboard.{jsx,css}    ← stat cells, live camera placeholder, by-class progress, charts, register table, "Recent doings", "Notes from the desk"
   │  ├─ Students.{jsx,css}     ← paper-polaroid student cards
   │  ├─ Reports.{jsx,css}      ← stat cells, period tabs, M-palette Recharts, Detailed Records table, Needs Attention / Perfect Attendance lists
   │  ├─ AdminPanel.{jsx,css}   ← stat cells, sub-tabs, users table, settings, audit timeline, AI model status
   │  └─ ParentPortal.{jsx,css} ← top nav (custom), child status banner, mini-stats, calendar, history, notifications, contact teacher, announcements
   ├─ components/
   │  ├─ Pagination.{jsx,css}   ← (existing — works with M tokens via global aliases)
   │  ├─ Skeleton.{jsx,css}     ← (existing)
   │  └─ Toast.{jsx,css}        ← (existing)
   └─ data/
      └─ mockData.js
```

---

## 14. Extending the system

### Building a new page

1. **Read this file first.** Decide which utility classes you need before writing CSS.
2. **JSX template:**
   ```jsx
   <div className="page-mypage">
     <header className="page-header">
       <div>
         <span className="eyebrow">~ subtitle ~</span>
         <h1>
           <span className="word k">Page</span>{' '}
           <span className="word y">title.</span>
         </h1>
       </div>
       <div className="page-actions">
         <button className="btn btn-primary">Primary →</button>
       </div>
     </header>
     {/* ... content with .card / .stat-card / .badge / etc. ... */}
   </div>
   ```
3. **Don't redefine globals** in your page CSS. If you write `.btn`, `.badge`, `.card`, `body`, `h1-h4`, table styles, or font @import — stop. Use the global classes.
4. **Keep page CSS small.** It should be page-specific layout glue and section-specific decorations only.
5. **Use `--cut-2` clip-paths** instead of `border-radius`. Always.
6. **Slight rotations** on every paper element. Use `:nth-child` to vary.
7. **Tape strips** on cards (1 each, alternate positions).
8. **Mono for data.** Body for prose. Caveat for handwriting. Fraunces 900 for big.

### Adding a new colour

**Don't.** If you find yourself wanting one, you're probably wrong. The five-crayon palette is intentional. The exceptions:

- A neutral mid-grey would be added if a non-status data viz needs it — discuss first.
- A second yellow shade (`--yellow-deep`) exists for hover only.

### Adding a new component

1. Define it in `src/index.css`, not in a page CSS.
2. Document it here in §7.
3. Use `clip-path: var(--cut-*)` for shape.
4. Pick from the 4-font system; never add a new font.
5. Test against Playwright at 1440×900 and 390×844 viewports.

---

## 15. Process notes (how this got built)

- **2026-05-07 (today):** Direction picked from a 14-specimen gallery (`playwright_screenshots/spec-A-*.png` to `spec-N-*.png`). User chose **M · Construction Paper Collage**.
- **Approach:** Single-author the global tokens (`index.css`) and reference pages (`Landing`, `Login`, `DashboardLayout`); then spawn 5 parallel agents to apply the system to remaining pages (Dashboard, Students, Reports, AdminPanel, ParentPortal). Each agent received this spec inline.
- **Validation:** Playwright MCP screenshots of each page at 1440×900, full-page, archived in `playwright_screenshots/M-QA-*.png` and `M-FINAL-*.png`.
- **frontend-design skill:** Installed globally at `~/.claude/skills/frontend-design/SKILL.md`. Triggered for this work; its evaluator-loop methodology informed the cycle.
- **Copy-revert pass (after first build):** All user-facing copy was reverted verbatim to the originals from commit `39bcdba` (in `ai-kams-web/src/pages/`). Originals are mirrored to `.orig-jsx/` for reference. M visuals (palette, fonts, cut-paper, tape, rotations) were preserved during the revert. Section §11 was rewritten to make explicit that the direction does not own copy.

---

## 16. Inspirations & precedents

- **Children's collage art** — Eric Carle's torn-paper illustrations, Y2 classroom displays.
- **Risograph print zines** — limited palettes, slight misregistration, hand-set type.
- **School scrapbooks and bulletin boards** — taped photos, hand-lettered captions, ribbon banners.
- **Anthropic's `frontend-design` skill** — methodology source.
- **The reference specimen** — `playwright_screenshots/spec-M-craft.png`. Keep this in sight when extending.

---

## 17. What this is **not**

- Not a SaaS dashboard.
- Not "modern, clean, minimal".
- Not Inter / Roboto / system-stack typography.
- Not blue-on-white.
- Not rounded corners.
- Not skeumorphic gloss.

If a change feels like it's pulling toward any of the above, push back.

---

*Last edited 2026-05-07. Source of truth for the PRISM-AI frontend.*
