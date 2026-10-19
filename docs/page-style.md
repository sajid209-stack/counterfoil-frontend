# Page style — storefronts and product pages an operator can make their own

Owner brief (2026-10-19): "from OS we can select fonts, re-evaluate the pages so they don't look
made with AI or like templates … focus on the individual product page, more colour selectors,
primary, secondary … a lot more of what can be added." Both the storefront and product pages get
the full set. Where it lives does not move: the storefront's style is edited on its own page in
Settings → Storefront; a product's on its Page tab in the Catalog. **Pages must not have too much
whitespace** — the owner said so twice; see §6.

## 1. The model (contract — `src/lib/api/types.ts`)

- `PageStyle` — every field optional. Colours (primary, secondary, background, surface, text),
  type (headingFont, bodyFont, headingWeight, typeScale, headingCase), shape (corners, buttonStyle,
  cardStyle), layout (hero, heroHeight, overlay, width, spacing, dividers, bookingPanel, gallery),
  details (texture, imageTone, iconStroke), words (ctaLabel, priceLabel, badge), and the
  `palette` / `preset` ids the editor shows.
- `Storefront.style` — the venue storefront's **brand**.
- `ProductPage.styleSource` — `"brand"` (default) or `"custom"`; `ProductPage.style` — the page's
  own, layered over the brand when custom.
- `ProductPage.blocks: PageBlocks` and five new section ids: `quote` (testimonials), `host`
  (meet your host), `steps` (how it works / what you'll make), `text` (a free block), `cta`
  (a call-to-action band). An empty block renders nothing, like every section.

## 2. Resolution (`src/lib/pageStyle/resolve.ts`) — the ONE reader

`productPageStyle({ look, page, brand, venueAccent })` and `storefrontStyle(storefront)` return a
`ResolvedStyle`; `styleRootProps(resolved)` returns `{ style, data-ps-* }` for the root. Layers:
look → brand → page.accent (legacy) → page's own (custom). **A record with no style resolves to
exactly the old values** (unit-checked for all seven looks and the storefront).

Readability is enforced in the resolver: text and muted text are walked until 4.5:1 on the ground,
cards and panels; button labels are white or ink; the primary-as-text (`--ps-ink`) and the
secondary-as-text (`--ps-secondary-ink`) are made to read. `checkStyle(style)` reports what had to
change: `error` (text unreadable on background or cards — the editor refuses to save) or `notice`
(adjusted, stated).

### CSS variables (on the root)

| Var | Meaning |
|---|---|
| `--ps-bg --ps-panel --ps-card --ps-fg --ps-muted --ps-line` | ground |
| `--ps-fill --ps-on-fill --ps-ink --ps-soft --ps-accent` | primary |
| `--ps-secondary --ps-secondary-soft --ps-secondary-ink` | secondary |
| `--ps-font-heading --ps-font-body --ps-scale` | type (`--ps-scale` 0.92 / 1 / 1.1) |
| `--ps-heading-weight --ps-heading-transform` | set ONLY when chosen — fall back with `var(--x, own)` |
| `--ps-radius-card --ps-radius-control --ps-radius-media` | sharp 4/4/4 · soft 16/12/16 · round 24/16/24 |
| `--ps-gap --ps-gap-lg` | section gap phone / ≥768: tight 24/32 · standard 40/56 · airy 48/64 |
| `--ps-container` | narrow 1040 · standard 1264 · wide 1440 |
| `--ps-hero-h --ps-hero-h-lg` | cover hero max height phone / desktop |
| `--ps-overlay` | 0–0.8 scrim |
| `--ps-stroke` | lucide strokeWidth (also `resolved.stroke`) |

The old `--pg-*` and `--sf-*` names are also set, so existing CSS follows without edits.

Data attributes: `data-ps-button` (solid · outline · pill · underline), `-card` (flat · bordered ·
shadow · tinted), `-texture` (none · grain · dots · lines), `-tone` (none · warm · mono · duotone),
`-dividers` (none · line), `-gallery` (mosaic · grid · strip), `-hero` (split · cover · editorial ·
collage · text), `-panel` (sidebar · inline), `-mode` (light · dark), `-corners`.

## 3. Fonts (`src/lib/pageStyle/fontMeta.ts` data, `fonts.ts` loaders)

21 curated faces (sans, serif, display) with Bengali falling back to Hind Siliguri, `preload:false`
so only faces in use are fetched. Put `pageFontVars` (from `@/lib/pageStyle/fonts`) as a className
on any root containing a styled page or a font picker. `PAIRINGS` lists tried pairs. Display-only
faces are never used for body text (the resolver refuses).

## 4. Palettes and presets (`presets.ts`)

12 palettes (paper, matcha, clay, ocean, forest, sand, rose, slate, night-market, neon, floodlit,
ink) and 6 complete presets (studio, editorial, night, bright, journal, bold), each differing in
type, shape AND layout. Names are message keys (`pageStyle.palette.<id>`, `pageStyle.preset.<id>`).

## 5. How each control must show on the page

- **Colours**: page ground = `--ps-bg`; cards = `--ps-card`; text = `--ps-fg`; secondary text
  `--ps-muted`; borders `--ps-line`. Primary buttons `--ps-fill`/`--ps-on-fill`. Secondary colour
  on chips, highlight icons, tags, the hero badge, small marks (`--ps-secondary-soft` ground with
  `--ps-secondary-ink` text).
- **Fonts**: headings (page title, section headings, card titles) `--ps-font-heading`, weight
  `var(--ps-heading-weight, <own>)`, `text-transform: var(--ps-heading-transform, none)`;
  everything else `--ps-font-body`. Font sizes of headings × `--ps-scale`.
- **Buttons**: solid = fill; outline = transparent with 1.5px `--ps-ink` border and `--ps-ink`
  text; pill = solid with fully round corners; underline = text button in `--ps-ink`, underlined,
  44px target kept. Controls use `--ps-radius-control` (pill: 999px).
- **Cards**: flat = no border, `--ps-panel` ground; bordered = 1px line; shadow = no border, soft
  shadow; tinted = `--ps-secondary-soft` ground, no border. Radius `--ps-radius-card`.
- **Hero**: split · cover (photo, scrim `--ps-overlay`, max height `--ps-hero-h(-lg)`) ·
  editorial (title first, wide photo) · collage (title beside a 3-photo collage of the item's
  images; falls back to split with fewer than 3) · text (no media; title, tagline, facts, CTAs on
  a `--ps-panel` band — compact).
- **Texture**: a subtle overlay on the page ground only (never behind text blocks at full
  strength): grain (SVG noise ~4%), dots (radial 1px dots, 16px grid, ~6%), lines (1px, 24px,
  ~4%). Off under `prefers-reduced-transparency`? not needed; keep subtle.
- **Image tone**: CSS filter on photos — warm `sepia(.18) saturate(1.1)`, mono `grayscale(1)
  contrast(1.05)`, duotone `grayscale(1)` plus a `mix-blend-mode: color` overlay of `--ps-accent`.
- **Dividers**: line = a 1px `--ps-line` rule between body sections (inside the gap, not adding to
  it). No numbering, no eyebrows (docs/product-page.md still applies).
- **Width**: the container's max width. **Booking panel**: sidebar (as today) or inline — the
  booking picker card drawn in the main column right after the hero/facts, full width, and no
  right rail (the main column then centres at max 760px of text measure).
- **Gallery**: mosaic (today) · grid (uniform 3-col, 1:1) · strip (one row, horizontal scroll
  with snap, 4:5 tiles).
- **Icons**: `strokeWidth={resolved.stroke}` on lucide icons in the page.
- **Words**: `ctaLabel` replaces "Get tickets"/"Book now" on the hero, panel and phone bar;
  `priceLabel` replaces "From"; `badge` is a small chip on the hero (secondary colours).

## 6. Whitespace rules (the owner's standing concern)

- No section may be taller than its content plus its padding. No min-heights on sections.
- Hero heights are capped (§2). The text hero is compact: ~32px vertical padding phone, 48 desktop.
- Section gaps never exceed `--ps-gap-lg` (64 max). Card padding 16–20, never more.
- Narrow width narrows the CONTAINER, it does not add side margins inside cards.
- A missing photo collapses its slot; never an empty box.
- Review every preset at 1440 and 390 for runs of empty space > 120px that carry nothing.

## 7. Build split (no two tasks touch one file)

| Task | Files |
|---|---|
| A — product page renderer | `src/components/productPage/**` (except `pageText.ts` stays readable by all), new `src/app/page-style.css` (imported once from `globals.css`), `src/messages/*/eventPage.json` for any new renderer strings |
| B — storefront renderer | `src/app/s/**`, `src/lib/storefront/theme.ts` (only if needed), new `src/app/storefront-style.css` (imported once from `globals.css`), `src/messages/*/storefront.json` |
| C — OS editors | `src/app/(os)/catalog/_components/page/**`, `src/app/(os)/settings/storefront/**`, new shared `src/components/pageStyle/**` (the StylePanel used by both), `src/messages/*/catalog.json`, `settings.json`, new `pageStyle.json` |
| Opus | contract (`types.ts`, `src/lib/pageStyle/**`, `productPage.ts` section list, this doc), `globals.css` imports, demo seed, review |
