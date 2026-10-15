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
| **A · Primitive** | The raw palette and scales. Named by value, never used in components. | `--color-neutral-100`, `--color-brand-600`, `--radius-sm`, `--spacing-tight`, `--elevation-2` | `@theme`, first block |
| **B · Semantic** | A role. Named by purpose; points at a primitive. Changes with the mode. | `--color-surface`, `--color-fg`, `--color-line`, `--color-ember-solid`, `--text-sm`, `--shadow-md` | `@theme` + `.light` / `.dark` |
| **C · Component** | What a role is in one product or one component. Points at a semantic or primitive token. Changes with the product. | `--radius-card`, `--radius-control`, `--radius-sheet`, `--shadow-card`, `--shadow-float` | `@theme` + `[data-product="go"]` |

### Primitive scales

Six tonal scales, each exactly eleven steps (50 to 950). Nothing else is a primitive.

| Scale | Role | Character |
|---|---|---|
| `brand` | Brand / Primary | Hue 18° · High chroma · Derived from `#F94A00` |
| `neutral` | Neutral / Warm Gray | Hue 40° · 3% saturation · Brand-compatible structural palette |
| `green` | Success | Hue 142° · Positive actions, confirmations |
| `amber` | Warning | Hue 38° · Caution, attention needed |
| `red` | Destructive | Hue 0° · Errors, destructive actions, critical alerts |
| `blue` | Info | Hue 217° · Informational, neutral guidance |

### Colour roles (semantic)

The Counterfoil Color System, in its four groups. Our token is the name in the
stylesheet; the spec name is what the Color System calls the role. Each value is
a step of a scale.

**01 Content**

| Spec name | Token | Light | Dark |
|---|---|---|---|
| foreground | `fg` | neutral-900 | neutral-100 |
| secondary-foreground | `fg-secondary` | neutral-700 | neutral-400 |
| muted-foreground | `muted` | neutral-600 | neutral-500 |
| disabled-foreground | `faint` | neutral-400 | neutral-700 |
| brand / accent-foreground (text, links) | `brand-foreground` | brand-700 | brand-300 |
| success / warning / destructive / info foreground | `success` `warning` `danger` `info` | green-800 · amber-800 · red-700 · blue-700 | the 400 steps |

**02 Surfaces**

| Spec name | Token | Light | Dark |
|---|---|---|---|
| background (page ground) | `surface` | neutral-50 | neutral-950 |
| card | `card` | white | neutral-900 |
| popover (menus, sheets, chrome) | `sheet`, `chrome` | = card | = card |
| secondary-surface (a fill inside a card) | `subtle` | neutral-100 | neutral-900 (= the card; needs `border-line` to be seen) |
| muted-surface (hover fill) | `muted-wash` | neutral-100 | neutral-800 |
| accent-surface | `ember-wash` | brand-50 | brand-950 |
| success / warning / destructive / info surface | `success-wash` `warning-wash` `danger-wash` `info-wash` | the 50 steps | the 950 steps |
| container borders | `success-line` `warning-line` `danger-line` `info-line` `ember-line` | the 200 steps | the 900 steps |
| marketplace surface | `market-wash` | blue-50 | blue-950 |
| unavailable time | `offtime` | = surface | = surface |
| inverse | `inverse` / `inverse-fg` | ink / paper | paper / ink |

**03 Interaction** (component state tokens). A state is the next step of the
family's own scale: deeper in light, brighter in dark. No state is an opacity of
the fill.

| Spec name | Token | Light | Dark |
|---|---|---|---|
| primary | `ember-solid` | brand-500 `#f94a00` | brand-500 `#f94a00` |
| primary-foreground | `on-solid` | white | white |
| primary-hover · active | `ember-hover` · `ember-active` | brand-600 · brand-700 | brand-600 · brand-700 |
| primary-disabled | `ember-disabled` | brand-100 at 60% | brand-900 at 40% |
| secondary (button) | `btn-secondary`, with `fg` text, `btn-secondary-line` edge, `shadow-sm` | white | neutral-800 |
| secondary line | `btn-secondary-line` | neutral-300 | neutral-700 |
| secondary-hover · active | `btn-secondary-hover` · `btn-secondary-active` | neutral-100 · neutral-200 | neutral-700 · neutral-600 |
| secondary-hover · active (neutral fills: nav selected, segmented hover) | `secondary-hover` · `secondary-active` | neutral-200 · neutral-300 | neutral-800 · neutral-700 |
| destructive (button) | `danger-soft`, with `danger` text and `danger-line` edge | red-50 | red-950 |
| destructive-hover · active | `danger-soft-hover` · `danger-soft-active` | red-100 · red-200 | red-900 · red-800 |
| solid red (marks only: verdicts, badges, closed sessions) | `danger-solid` | red-600 | red-600 |
| solid red hover · active | `danger-hover` · `danger-active` | red-700 · red-800 | red-700 · red-800 |
| solid red disabled | `danger-disabled` | red-100 at 60% | red-900 at 40% |
| accent | `ember-wash`, with `brand-foreground` text | brand-50 | brand-950 |
| ring, focus-ring | `ring` (= `ember`) | brand-500 | brand-400 |
| confirmed fill | `success-solid` | green-700 | green-700 |
| marketplace fill | `market-solid` | blue-700 | blue-700 |

The accent mark `ember` (`bg-ember`, `text-ember`) is brand-500 in light and
brand-400 in dark: marks, dots, stripes and the focus ring. A solid fill that
carries text is `ember-solid`; they are the same orange.

**04 Structure**

| Spec name | Token | Light | Dark |
|---|---|---|---|
| border, input | `line` | neutral-200 | neutral-800 |
| divider | `hairline` | neutral-200 | neutral-800 |
| border-strong (hover edge) | `strong` | neutral-300 | neutral-700 |

The marketplace axis (`market`, `market-wash`, `market-solid`) is the info blue
family, so every hue on a screen is a step of one of the six scales. Chart colours (`--chart-*`,
`--heat-*`) are steps of the scales too.

**Contrast is measured, not assumed.** Body text needs 4.5:1, large text (at
least 18.66px bold, or 24px) 3:1, and UI marks and focus 3:1, in both modes. The
WCAG level for a pair is AAA from 7:1, AA from 4.5:1, and AA Large / UI from
3:1. Text inside every filled button is white in both modes (owner decision,
2026-10-13). White on `ember-solid` (`#f94a00`) is **3.50:1** in light and in
dark: AA Large / UI, accepted for UI controls (buttons, chips, badges) and
never for body text; hover (brand-600) is 4.64:1 and pressed (brand-700)
6.71:1. A secondary button is `fg` on white, 16.09:1 (13.64:1 on hover). A
destructive button's text is `danger-soft-fg`: red-800 on red-50 / 100 / 200
(7.6 / 6.8 / 5.7:1) in light and red-200 on red-950 / 900 / 800 (11.2 / 6.9 /
5.7:1) in dark, so every state clears 4.5:1. Solid red as a mark takes white at 4.83:1. Brand-coloured text at
body size is `brand-foreground`, never `ember`. `faint` is only for disabled
controls and placeholders, never content. The live matrix is at
`/design-system/colour`.

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
| `text-2xs` | 11 / 16 | The classic till's tab-bar labels only |
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

- **Button** — `primary` (one per screen, `ember-solid`), `secondary` (a white control: `fg`
  text, `btn-secondary-line` edge, `shadow-sm`), `tertiary` (no fill),
  `destructive` (a soft red: `danger-soft` fill, `danger` text, `danger-line`
  edge), `link`.
  Sizes `sm` 36 / `md` 44 / `lg` 48, and `icon` (square). Radius is
  `rounded-control`, so it is a pill in Go without a per-call prop. Loading
  keeps the width and shows a spinner; disabled says why nearby.
- **IconButton** = `Button size="icon"`, always with an accessible name.
- **Field / FormField / Select / DateField / TimeInput / SearchField** — 44px on
  a phone, 36px dense on a desktop; `line` edge, `ring` focus, `danger` edge and
  a sentence below when invalid; label above, help under, error replaces help.
- **Checkbox / Radio / Switch** — one each. 44px target, 20px mark.
- **SegmentedControl** — mutually exclusive views or modes (Today / This week);
  the selected option is the primary fill (`ember-solid`, white text).
- **Tabs** — navigation between related content in one page.
- **Navigation rows** (rail, Settings column, phone menu sheet, Go tab bar) — one
  definition in `components/ui/navStyles`. The current page is `NAV_SELECTED`:
  a neutral `secondary-hover` fill, semibold `fg` label and `NAV_SELECTED_ICON`
  (`text-fg`), with no ring and no brand colour (Shopify's quiet recipe). Other rows are `NAV_IDLE` (muted,
  `muted-wash` hover).
  *The till's tab bar* is docked, 64px tall and full width, with a hairline on top. Each tab is a 24px
  icon inside a 56 × 32 pill over a 13px label, 4px apart — Material 3 Expressive's proportions. The
  current tab's pill is solid ink with the icon knocked out (`NAV_TAB_ACTIVE`; light in dark mode) and its
  label is ink at 600 (`NAV_SELECTED_TEXT`); other tabs are grey outline icons over grey labels. More lights
  while its sheet is open. The landscape rail uses the same tab.
  *Nested groups:* a parent with children shows them indented, label only, and only
  while you are inside that group. The current page carries the selected surface;
  its parent goes bold with no fill (`NAV_PARENT_OF_SELECTED`), so exactly one row
  is filled. "Other apps" is a collapsible group. In the collapsed 64px rail a
  parent with children opens a flyout card listing the parent and its children.
- **Scrollbars** — thin and overlay-style everywhere: the thumb
  (`--color-scrollbar`, neutral-400 / neutral-600) is transparent at rest and
  shown only while that element is scrolling (`data-scrolling`, set by
  `components/ScrollActivity`). `.no-scrollbar` still draws none.
- **Chip** — a filter or a choice that toggles; selected = `ember-solid` fill
  with white text and a check.
- **StatusPill** — sentence case on a soft tint, no dot, no border; the word
  carries the meaning.
- **Card** — the one surface (`card-surface` = `rounded-card shadow-card`).
- **DetailCard / FactGrid / TimelineCard** — the record page's cards. `DetailCard` is a
  titled card (`text-md font-semibold`, optional actions, optional phone fold).
  `FactGrid` is a label (`text-sm text-muted`) over value grid: `primary` values
  `text-md font-semibold` for the few facts a page is opened for, `secondary`
  `text-base`; an empty value reads "Not recorded"; mono only for identifiers.
  `TimelineCard` / `ActivityList` is dated events (what happened, status, moment,
  who or why). The ticket the guest holds is `TicketCard`, shared with the print
  pages. See the Cards section of `/design-system`.
- **DataTable** — 13px headers, 14px cells, 48px rows, `hairline` rows, sticky
  header, `aria-sort`, a two-line list on a phone.
- **Modal / Sheet / ActionMenu / popovers** — `rounded-sheet` / `rounded-card`,
  level 3 / 2, a focus trap, Escape and a backdrop close, focus returns to the
  opener.
- **Notice** — an inline message (info, success, warning, danger) with an
  optional action. **Toast** — transient, `role=status`, errors `role=alert`.
- **EmptyState, Skeleton, Pagination** — one each.

## 10a. Screen states

Every OS and POS screen has six faces: live, loading, empty, error, not found and signed out. All six are built from `src/components/screens` and chosen by one registry (`registry.ts`, with the till's routes in `registry.go.ts`).

- **Loading**: `PageSkeleton`, drawn as the page's own shape (dashboard, list, cards, detail, form, calendar, analytics; pos-wall, pos-board, pos-list, pos-form, pos-scan). `role="status"`, `aria-busy`, one hidden "Loading…", blocks `aria-hidden`; the pulse stills under reduced motion.
- **Empty**: `EmptyScreen`. A drawing, one headline saying what is missing, one line of why, ONE primary action, an optional quiet link. Copy is per page (`screens.empty.<id>.*`).
- **Error, not found, signed out**: `StatusScreen` (framed or whole page). What happened, what to do, one primary action; an error carries a reference code. `app/global-error.tsx` is self-contained (own copy, no providers).
- **Preview**: the Page state menu beside the venue or counter picker (and in the phone menu sheet) draws any face in place of the page via `ScreenPreview`. State lives in `lib/screenState`.

Adding a route: one registry entry and four strings (en and bn). Live examples: /design-system/screen-states.

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
- The classic till's 11px tab labels (a deliberate restoration of the older design; the till's own tab bar uses 13px).
- Print pages' physical measurements.
- Literal colours that must stay literal: the PWA manifest and `theme-color`
  meta, and the QR code (pure black on white to scan).

A one-off exception elsewhere is marked on its own line with
`// ds-exception: <reason>`; a marker without a reason is itself an error.

White on the primary fill is the Color System’s own position, not a leak:
`ember-solid` is `#f94a00` (brand-500) and white on it is **3.50:1** in both modes:
AA Large / UI (WCAG 1.4.11). It is accepted for UI controls (buttons, chips,
badges, the selected state of a choice) and **never for body text**; text at
body size in the brand colour is `brand-foreground` (brand-700, brand-300 in
dark). Dark keeps the same fill and the same white text, so the exception is
the same in both modes. A label that has to be read at length is never
put on the primary fill.

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
