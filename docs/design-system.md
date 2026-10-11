# Counterfoil design system

The rules that govern **Counterfoil OS** (the admin app, `src/app/(os)`) and
**Counterfoil GO** (the till, `src/app/(go)`), in light and dark. The tokens
live in `src/app/globals.css`; the components in `src/components/ui`; the live
reference is **`/design-system`** in OS. `npm run lint:tokens`
(`scripts/check-design-tokens.mjs`) fails on anything that bypasses them.

This is a standardisation of a product that already works, not a redesign. The
objective is to remove variation, not to add design.

## 1. Principles

1. **One way to do each thing.** A role (a page title, a primary button, a
   selected chip) has one recipe. Two recipes for one job is a bug.
2. **Tokens, never values.** Colour, size, spacing, radius, shadow and motion
   come from tokens. A raw value needs a documented exception (§12).
3. **Shared foundation, distinct products.** OS and GO share colour, type,
   spacing, motion and every behaviour rule. They differ in shape, elevation and
   density, through product tokens — never through a second component.
4. **Calm.** Fewer lines and strokes; a surface change separates before a
   border does. One primary action per screen.
5. **Accessible by construction.** Contrast, focus, target size and reduced
   motion are properties of the components, so a page cannot get them wrong.

## 2. Token architecture

Three layers. A layer only ever points at the one beneath it.

| Layer | What it is | Examples | Where |
|---|---|---|---|
| **A · Primitive** | The raw palette and scales. Named by value, never used in components. | `--color-neutral-150`, `--color-brand-600`, `--radius-sm`, `--spacing-tight`, `--elevation-2` | `@theme`, first block |
| **B · Semantic** | A role. Named by purpose; points at a primitive. Changes with the mode. | `--color-surface`, `--color-fg`, `--color-line`, `--color-ember-solid`, `--text-sm`, `--shadow-md` | `@theme` + `.light` / `.dark` |
| **C · Component** | What a role is in one product or one component. Points at a semantic or primitive token. Changes with the product. | `--radius-card`, `--radius-control`, `--radius-sheet`, `--shadow-card`, `--shadow-float` | `@theme` + `[data-product="go"]` |

### Colour roles (semantic)

| Role | Token | Light | Dark |
|---|---|---|---|
| background (page ground) | `surface` | neutral-50 `#f5f2eb` | neutral-950 `#141413` |
| surface (cards) | `card` | white | neutral-900 `#22211f` |
| surface-raised (menus, sheets, chrome) | `sheet`, `chrome` | = card | = card |
| surface-sunken (a fill inside a card) | `subtle` | neutral-100 `#efece5` | neutral-850 `#2b2a27` |
| hover / pressed fill | `muted-wash` | neutral-150 `#eae8e3` | neutral-850 |
| unavailable time | `offtime` | = surface | = surface |
| foreground | `fg` | neutral-900 | neutral-100 |
| muted-foreground | `muted` | neutral-650 `#6b675f` | neutral-500 |
| disabled / placeholder | `faint` | neutral-400 | neutral-600 |
| border, input edge | `line` | neutral-200 | neutral-800 |
| border-strong | `strong` | neutral-300 | neutral-700 |
| divider between rows | `hairline` | neutral-100 | neutral-875 |
| inverse | `inverse` / `inverse-fg` | ink / paper | paper / ink |
| accent (marks, dots, stripes, focus) | `ember` | brand-500 `#f94a00` | brand-400 |
| primary fill (white text on it) | `ember-solid` | brand-600 `#d63d00` | brand-600 |
| brand text, links | `brand-foreground` | brand-700 | brand-300 |
| focus ring | `ring` | = ember | = ember |
| text on a solid fill | `on-solid` | white | white |
| status text | `success` `warning` `danger` `info` | 800/700 steps | 400 steps |
| status fills under white | `success-solid` `danger-solid` | green-700, red-700 | same |
| status tints | `*-wash` | pale | dark tint |
| marketplace axis | `market`, `market-wash`, `market-solid` | violet | violet |

**Contrast is measured, not assumed.** Body text ≥ 4.5:1, large text (≥ 18.66px
bold or 24px) ≥ 3:1, UI marks and focus ≥ 3:1, in both modes. Every `-solid`
fill is ≥ 4.5:1 under white. `ember` (`#f94a00`) is **3.50:1** under white, so it
is never a fill behind text: that is `ember-solid`. `faint` is only for disabled
controls and placeholders, never content.

## 3. Four theme configurations

Two orthogonal axes:

- **Mode**: `.dark` on `<html>` (next-themes) switches every semantic colour and
  the elevation values. `.light` re-asserts the light set on a subtree, so a
  light island can sit in a dark page (the Design System previews, `.paper`
  print documents and the `.sf` storefront use it).
- **Product**: `data-product="go"` on `<html>` (set by the boot script on Go
  routes and by `GoShell`) switches the component tokens. OS is the default.

| | OS | GO |
|---|---|---|
| Card radius `--radius-card` | 12 | 18 |
| Control radius `--radius-control` | 6 | pill |
| Inner frame `--radius-inner` | 3 | 14 |
| Sheet edge `--radius-sheet` | 12 | 28 |
| Resting card `--shadow-card` | 1px ring + 2px lift | wide soft lift |
| Floating `--shadow-float` | level 2 | Go float |
| Min target | 44 phone, 36 desktop | 44 everywhere |
| Text floor | 12 | 13 |
| Accent | ember | ember (the same brand) |

The **classic** till (`/classic`) is the till as it was before 6 September,
kept deliberately with its own kit; it is outside both product themes.

## 4. Typography

Inter (variable) for everything, Hind Siliguri behind it for Bangla, DM Mono
**only for identifiers** (references, ticket codes, SKUs, pairing codes) —
never for money, counts, times or dates. Figures are tabular everywhere (set on
`<body>`). Body tracking is −0.01em.

| Token | Size / line | Use |
|---|---|---|
| `text-2xs` | 11 / 16 | Go tab-bar labels only |
| `text-xs` | 12 / 18 | captions, metadata, badges, axis labels, field help |
| `text-sm` | 13 / 20 | supporting text, table headers, dense cells, Go floor |
| `text-base` | 14 / 20 | **default**: body, table cells, buttons, inputs |
| `text-md` | 16 / 24 | emphasised body, card titles, Go tile names, phone inputs |
| `text-lg` | 18 / 26 | section headings |
| `text-xl` | 20 / 28 | major sections, dialog titles |
| `text-2xl` | 24 / 32 | phone page titles, band figures |
| `text-3xl` | 28 / 34 | page titles, headline metrics |
| `text-4xl` | 32 / 40 | hero metrics |
| `text-display` | 40 / 44 | Go amount due, change |
| `text-5xl` / `6xl` | 48 / 60 | the scan verdict and the landing only |

**Roles** (use these, do not compose new ones):

| Role | Classes |
|---|---|
| Page title | `text-2xl sm:text-3xl font-semibold tracking-title` |
| Section title | `text-lg font-semibold tracking-title` |
| Card title | `text-md font-semibold` |
| Body | `text-base` |
| Supporting | `text-sm text-muted` |
| Label (field, figure) | `text-xs font-medium text-muted` |
| Table header | `text-sm font-medium text-muted` |
| Table cell | `text-base` (dense: `text-sm`) |
| Headline metric | `text-3xl font-semibold tracking-figure` |
| Band figure | `text-2xl font-semibold tracking-figure` |
| Button | `text-base font-medium` (sm: `text-sm`) |
| Badge | `text-xs font-medium` |
| Identifier | `font-mono text-sm` |
| Go tile name / price | `text-md font-semibold` / `text-xl font-semibold` |
| Go amount due | `text-display font-bold tracking-figure` |

Weights: 400 body, 500 labels and buttons, 600 titles and figures, 700 Go
display figures only. No uppercase tracked labels in either product. Text
truncates only where a full value is reachable (a title, a tooltip, a record);
names that distinguish one row from another wrap instead.

## 5. Spacing

A 4px grid. Named tokens for the rhythm; Tailwind's numeric steps (`1`=4px …)
for anything else **on the grid**. Arbitrary `[Npx]` spacing is not allowed.

| Token | px | Spec name | Use |
|---|---|---|---|
| `inline` | 4 | space-1 | icon-to-label in a tight control |
| `tight` | 8 | space-2 | icon-to-label, between a label and its field |
| `comfortable` | 12 | space-3 | inside a nested frame, between list items |
| `section` | 16 | space-4 | between cards, between form groups |
| `card` | 20 (16 phone) | space-5 | inside every card |
| `gutter` | 20 (16 phone) | space-5 | page edge |
| `major` | 24 | space-6 | between a titled group and the next |
| `wide` | 32 | space-8 | between page regions |
| `hero` | 48 | space-12 | empty states, first-run |

Card padding is `p-card`; rows in an edge-to-edge card are `px-card`; cards sit
`gap-section` apart; the page edge is `px-gutter`.

## 6. Radius

| Token | px | Use |
|---|---|---|
| `rounded-xs` | 3 | small media, a frame inside a frame |
| `rounded-sm` | 6 | OS controls, a frame inside a card |
| `rounded-md` | 12 | OS containers: card, menu, popover, dialog |
| `rounded-lg` | 16 | the OS page frame |
| `rounded-full` | pill | chips, avatars, toggles, Go controls |
| `rounded-card` `rounded-control` `rounded-inner` `rounded-sheet` | by product | **shared components use these** |
| `rounded-go-sm` / `rounded-go` / `rounded-go-lg` | 14 / 18 / 28 | Go inner / card / sheet edge |

Inner corner = outer corner − gap, so a corner set inside another is always one
step smaller.

## 7. Borders and strokes

1px everywhere. `line` for a component's edge and an input, `hairline` between
rows, `strong` on hover or for an emphasised edge. 2px only for a **selected**
choice (`ring-2 ring-ember-solid`, inset where a card clips it) and the focus
ring. A surface change separates before a border does: no box inside a box.

## 8. Elevation

| Level | Token | Light | Dark | Use |
|---|---|---|---|---|
| 0 | none | — | — | layout, tables, settings rows |
| 1 | `shadow-sm` / `shadow-card` | 1px ring + 2px lift | 1px line | a resting card |
| 2 | `shadow-md` / `shadow-float` | soft 16px | deep black + edge | menus, popovers, toasts |
| 3 | `shadow-lg` | soft 48px | deeper | dialogs, sheets, palette |

Values live in `--elevation-*` (plain CSS); the theme points at them so that
dark mode and the product can change them. No `shadow-[...]` in components.

## 9. Motion

`duration-quick` 120ms (hover, press), `duration-standard` 200ms (panels,
fades), `duration-considered` 320ms (sheets entering), one easing
`ease-counterfoil`. Reduced motion (the OS setting or Settings → Display)
collapses every duration; nothing is withheld, only animated.

## 10. Components

All in `src/components/ui`, exported from `@/components/ui`. Each one draws its
own hover, focus-visible, pressed, disabled, loading, selected and invalid
states. A page never restyles one with `className` for a different look; it
picks a variant.

- **Button** — `primary` (one per screen, `ember-solid`), `secondary` (white,
  `line` edge), `tertiary` (no fill), `destructive` (`danger-solid`), `link`.
  Sizes `sm` 36 / `md` 44 / `lg` 48, and `icon` (square). Radius is
  `rounded-control`, so it is a pill in Go without a per-call prop. Loading
  keeps the width and shows a spinner; disabled says why nearby.
- **IconButton** = `Button size="icon"`, always with an accessible name.
- **Field / FormField / Select / DateField / TimeInput / SearchField** — 44px on
  a phone, 36px dense on a desktop; `line` edge, `ring` focus, `danger` edge and
  a sentence below when invalid; label above, help under, error replaces help.
- **Checkbox / Radio / Switch** — one each. 44px target, 20px mark.
- **SegmentedControl** — mutually exclusive views or modes (Today / This week).
- **Tabs** — navigation between related content in one page.
- **Chip** — a filter or a choice that toggles; selected = `ember-solid` fill
  with white text and a check.
- **StatusPill** — sentence case on a soft tint, no dot, no border; the word
  carries the meaning.
- **Card** — the one surface (`card-surface` = `rounded-card shadow-card`).
- **DataTable** — 13px headers, 14px cells, 48px rows, `hairline` rows, sticky
  header, `aria-sort`, a two-line list on a phone.
- **Modal / Sheet / ActionMenu / popovers** — `rounded-sheet` / `rounded-card`,
  level 3 / 2, a focus trap, Escape and a backdrop close, focus returns to the
  opener.
- **Notice** — an inline message (info, success, warning, danger) with an
  optional action. **Toast** — transient, `role=status`, errors `role=alert`.
- **EmptyState, Skeleton, Pagination** — one each.

## 11. Product rules

**OS** — admin and monitoring. Page header (title left, one primary action
right), filters as one line (`FilterBar`), tables in cards, figures in a band,
records with key facts first. Desktop density: 36px controls.

**GO** — fast, accurate transactions on touch.
- The orange button is always bottom-right and always moves the sale forward;
  its "not now" neighbour is always on its left (`ActionBar`).
- Tap to add; exact cash in two presses; one payment sheet; a 5-second undo.
- 44px minimum, 13px text minimum, one stepper, one method selector, one
  money-figure scale (`text-display` for the amount due).
- A scan verdict is carried by shape, colour and words together.

## 12. Documented exceptions

These may use raw values; nothing else may.

- `src/app/deck/**` — a fixed 1600 × 900 slide canvas in real pixels.
- Event page templates (`src/lib/events/**`, `src/components/events/**`) —
  each template's own type and palette, scoped to `--e-*`.
- The storefront's venue accent (`--sf-*`, computed per venue for contrast).
- Chart palettes (`--chart-*`, `--heat-*`) and operator-chosen category colours.
- Fluid money figures that must fit their row (`clamp()` on the till).
- The seat plan's 9px seat labels (each seat carries its full name).
- The Go tab bar's 11px labels (five tabs across a 390px phone).
- Print pages' physical measurements.
- Literal colours that must stay literal: the PWA manifest and `theme-color`
  meta, and the QR code (pure black on white to scan).

A one-off exception elsewhere is marked on its own line with
`// ds-exception: <reason>`; a marker without a reason is itself an error.

White on the primary fill is **not** an exception: `ember-solid` is brand-600
(#d63d00), 4.64:1 under white. `ember` (#f94a00, 3.50:1) is the accent for
marks, rings and charts, never a fill behind text.

## 13. Enforcement

`npm run lint:tokens` fails on, outside the exceptions above:
arbitrary `text-[…]`, `rounded-[…]`, `shadow-[…]`, `duration-[…]`, `z-[…]`
and arbitrary spacing; hex/rgb colour literals in components; `text-faint` on
content; `font-mono` on money; and a `.dark` token missing from `.light`.

Mode and product are applied by class and attribute on any element, so a
subtree can be themed on its own: `class="light|dark"` re-asserts every mode
token (including every token that is a `var()` of another, because custom
properties resolve where they are declared), and `data-product="os|go"` sets
the component radius and elevation tokens. Put both on the same element (the
Design System previews do), and never key a component rule to the page-level
`.dark` class — take the difference from a token instead.

## 14. Where it is documented

`/design-system` renders this spec with live components: 20 sections, a
product (OS | GO) and mode (Light | Dark) switch for every preview, the four
configurations side by side, and token tables whose values are read from the
running stylesheet. It is linked from the OS rail (under Point of Sale and
Counterfoil Deck) and from Go's More sheet; `/tokens` and `/kitchen-sink`
redirect to it.
