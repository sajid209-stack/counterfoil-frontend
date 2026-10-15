# Product pages — one system for every booking (v3)

Owner brief (2026-10-15): the six designed looks read as six unrelated generated pages. Plan and
build one standard, world-class product page system, with references from Behance, Dribbble and the
best event and product pages. This supersedes the page renderer half of `docs/catalog.md` §10.5
(the data model, the seven look ids and the designer stay).

## 1. What was wrong (the audit, confirmed against the code)

1. **Two renderers.** `StandardPage` (Classic) and the 4,148-line `EventTemplate` (six looks) share
   nothing but data. Every look changes colour, type, section structure, borders, backgrounds and card
   treatment at once, so there is no shared foundation.
2. **Synthetic visuals.** Striped gradient plates with initials stand in for speakers, artworks and
   DJs; highlights are initials in circles; gallery tiles are generated. No seeded event has a photo.
3. **Ticket UI varies by look.** Stub cards, rail rows, comparison columns; price, availability,
   perks and quantity are in a different order each time, and the booking panel is a different thing
   on Classic (date/time picker) than on the six event looks (ticket stubs + order summary).
4. **Space and type.** Heroes up to a full viewport, 96–128px section padding, numbered uppercase
   eyebrows ("01 ———— ABOUT"), tiny tracked metadata, display faces on every heading.
5. **Whole pages tinted** (pale green, purple glow, neon) instead of neutral surfaces with an accent.

## 2. References

- **Airbnb Experiences, GetYourGuide, Tiqets** — product page: media first, title, a facts row, then
  a two-column body with a sticky booking card on the right (date → options → total → one CTA); on
  a phone a fixed bottom bar with the price and one button that opens the booking sheet.
- **Luma, Eventbrite** — event page: compact hero (cover beside title on desktop), date/location
  block with add-to-calendar, organiser line, ticket list with clear availability.
- **DICE, Resident Advisor, Fever** — energetic events: poster/photo-led dark hero, line-up by
  billing, ticket releases with honest sold-out / last-few states.
- **Behance / Dribbble event and ticketing concepts** (e.g. the music-festival ticket booking and
  conference landing shots in the audit) — full-bleed photo heroes with a gradient scrim, ticket tier
  cards with quantity + live total, speaker grids with portraits.
- **Baymard, Event Ticketing research** — the leading cause of abandonment is unclear pricing and
  availability: state price, unit and what is left before the buyer commits.
- **Material 3 / Apple HIG** — 44–48px touch targets, one primary action per context.

## 3. The system: three layers

| Layer | What | Where |
|---|---|---|
| 1. Foundation (shared, every look) | container, grid, spacing, type scale, section header, booking panel, ticket option, facts, buttons, states, responsive rules | `src/components/productPage/page/*` |
| 2. Look (one of seven) | personality, light/dark, hero treatment, display face, default accent | `page/theme.ts` `LOOKS` |
| 3. Content | the booking, its page fields, photos, tickets | `Product`, `pageView(product)` |

### 3.1 Looks → three personalities

| Look id (stored) | Name | Personality | Mode | Hero | Display face |
|---|---|---|---|---|---|
| standard | Classic | Informational | light | split | Inter |
| business | Clean | Informational | light | split | Inter |
| travel | Journey | Informational | light | cover | Fraunces |
| arts | Gallery | Editorial | light | editorial | Playfair Display |
| entertainment | Poster | Energetic | dark | cover | Bebas Neue (title only) |
| sports | Floodlit | Energetic | dark | cover | Space Grotesk |
| nightlife | Neon | Energetic | dark | cover | Syne |

Dark looks use **neutral** near-black surfaces (ground `#0d0d10`, card `#17171b`, line `#2a2a30`),
never a tinted or gradient page. The accent appears on the primary button, links, the selected state
and small marks only. No glow, no grain, no numbered eyebrows, no diagonal-line plates.

### 3.2 Foundation values

- Container: max 1200px; gutters 16 (phone) / 24 (≥768) / 32 (≥1280).
- Body grid ≥1024: main column `minmax(0,1fr)` + booking panel `380px`, gap 48. The panel is sticky
  (`top: 88px`, below the section nav). Below 1024: one column, no panel; a fixed bottom bar.
- Section rhythm: 56px between sections ≥768, 40 on a phone. A section is: heading (24/32, 600) +
  optional one-line intro (16, muted) + content, 20px under the heading. Sections are separated by
  space, not by bands or rules. No eyebrows, no numbering, sentence case everywhere except a look that
  sets its TITLE in caps (Poster).
- Type: Inter for everything except the page title (and section headings in Editorial looks, which
  use the display face at the same size). Title 34/40 phone, 48/56 desktop (Poster 56/60 caps,
  max 2 lines, `text-wrap: balance`). Body 16/26. Meta 14/20. Smallest text 13px. Never tracked
  uppercase metadata.
- Radius: cards 16, controls 12, chips full. Borders 1px `line`; shadows only on the booking panel
  and the sticky bars.
- Touch targets ≥44px. Visible focus (the app's global ring). Contrast ≥4.5:1 for text.

### 3.3 Page anatomy (top to bottom)

1. **Chrome** — the storefront header or the item link's slim header (unchanged, `PageFrame`).
2. **Hero** (one component, three treatments):
   - *split* — desktop: text left (title, tagline, facts, CTAs), media right at 4:3, radius 16;
     phone: media first (16:10) then text.
   - *cover* — full-bleed photo, max-height 560 desktop / 440 phone, scrim from the bottom, text
     bottom-left in white. Without a photo: a solid dark ground with a soft accent light, no stripes.
   - *editorial* — title first, left-aligned in the display face, meta line, then a wide 21:9 photo.
   - Hero always carries: title, tagline (if any), a facts row (date or "when" in words · time ·
     venue · duration), the primary CTA ("Get tickets" / "Book now") and, when dated, Add to calendar.
     "From ৳X" sits next to the CTA. Countdown (if on) is a compact inline row inside the hero, not a
     band.
3. **Key facts strip** (stats) — one row of 2–4 figures directly under the hero, inside the
   container, figure 24/600 over label 13 muted, separated by 1px rules. Not a full-width band.
4. **Section nav** — appears (sticky, 56px) once the hero scrolls away: the page name, up to five
   anchors to sections that exist, and the primary button. Phone: name + button only.
5. **Body** — main column sections in `page.sections` order; booking panel on the right.
6. **Mobile bottom bar** — fixed: "From ৳X" + unit, one primary button. Opens the booking sheet.
   Content reserves its height.

### 3.4 Booking — one component everywhere

- **BookingPanel** (desktop right rail): the existing `BookingPicker` inside a card titled by what
  it asks ("Choose your tickets" / "Choose your time"), with its own total and buttons. The same
  picker drives the phone sheet (`QuickAddSheet`). One set of questions for every look.
- **Ticket options** section (main column) — `TicketOption` cards in a 2-column grid (1 on a
  phone), drawn only when a booking has ≥2 ticket types or is an on-a-date booking. Card anatomy,
  fixed order:
  1. name (16/600) + state chip (right): *Last few* (≤10% or ≤10 left), *Sold out*, *Sales ended*,
     *Most popular* (read off the ledger, existing rule);
  2. description (14 muted, 2 lines);
  3. what's included: up to 4 check-marked perks, "+N more";
  4. day scope chips for a multi-day event, and the all-days saving;
  5. footer: price (22/700, "Free" when 0) + unit ("per person", "for 4 people", "per team",
     "per hour") on the left; *Choose* button on the right (opens/focuses the booking with this
     ticket preselected). Sold-out: muted card, struck price, no button.
  Cards in a row share height (footer pinned to the bottom).
- Order summary and checkout stay in the picker / basket (unchanged money paths).

### 3.5 Content modules (each a component in `page/sections/`)

| Section id | Module | Rules |
|---|---|---|
| about | About | prose (max 68ch) · info facts as a 3-col definition grid · organiser line |
| highlights | Highlights | cards: icon (lucide, by position) + label + description; with no descriptions, a single row of chips |
| included | Included | check list, 2 columns ≥768 |
| know | Good to know | icon list (policies) |
| lineup | People | photos → portrait grid (3/4 cols, 4:5, name + role + time); no photos → a clean list (avatar initial disc 40px neutral, name, role, time). Poster look: billing by type size, headliner first. Sessions (`kind: session`) never appear here |
| schedule | Programme | day tabs when the event has days; rows = time (fixed 88px column) · title · role/room; sports fixtures render "A vs B" with the VS centred; itinerary (Journey) renders as a vertical route with stops |
| gallery | Photos | the booking's photos (`product.images`) as a mosaic (1 large + 4); hidden when there are none — never generated tiles |
| video | Video | the existing click-to-load YouTube block, 16:9, radius 16 |
| venue | Where | address card + Get directions + a static map-style panel (no fake labels) |
| sponsors | Sponsors | grouped by tier, names in neutral bordered tiles, smaller per tier |
| faq | Questions | `<details>` accordion, max 720px |
| countdown | (in hero) | — |
| stats | (strip under hero) | — |

Empty sections never render. A section the operator switched on with no content renders nothing on
the public page (the designer already says so).

### 3.6 Photos

- `EventLineupEntry.imageUrl?` (new, optional): a portrait for a person on the bill.
- Seeded events and bookings get real photos (Creative Commons via Openverse, CC0 / CC BY / CC BY-SA,
  credited in `public/demo/pages/CREDITS.md`). Photos are generic scenes (a crowd, a pitch under
  lights, a conference stage, textiles, a mangrove river) — never a claim that a named person or a
  named venue is pictured. Portraits are left empty: named speakers and artists are fictional, so a
  real stranger's face would misrepresent them; the list fallback is the honest design.

## 4. Build plan (file ownership — no two tasks touch one file)

| Task | Owner | Files |
|---|---|---|
| T0 contract | Opus | `page/theme.ts`, `page/context.tsx`, `page/sections/index.ts` stubs, this doc, `types` additions |
| T1 photos | Sonnet | `public/demo/pages/**`, `src/lib/mock/events.ts`, image fields in `src/lib/mock/data.ts` |
| T2 shell + booking | Sonnet | `page/BookingPage.tsx`, `page/Hero.tsx`, `page/FactsStrip.tsx`, `page/SectionNav.tsx`, `page/BookingPanel.tsx`, `page/MobileBookBar.tsx`, `page/TicketOptions.tsx`, `ProductPageView.tsx`, `BookingPicker.tsx` (preselect prop only), `QuickAddSheet.tsx` (pass-through), messages `productPage.*` |
| T3 sections | Sonnet | `page/sections/*.tsx` (except `index.ts`), messages `productPage.sections.*` |
| T4 designer | Sonnet | `catalog/_components/page/SectionEditors.tsx` (lineup photo field), look descriptions |
| T5 cleanup | Opus/Sonnet | delete `StandardPage.tsx`, `EventPage.tsx`, `events/EventTemplate.tsx` and dead helpers; port harnesses |

Verification: screenshots of all seven looks × 1440 / 390 × light/dark OS theme (pages are
mode-locked by look) × Bangla; contrast, 13px floor, 44px targets, no sideways scroll; the storefront
and link journeys (catalog2-e2e, sf live/preview/design/quick) on a production build.
