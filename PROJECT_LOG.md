# Counterfoil Frontend — Project Log

> **Living document.** Update this at the end of every meaningful unit of work (every commit
> that changes structure, adds a phase, makes a decision, or resolves an open question).
> If you are a new Claude Code session, or an engineer joining the project, **read this top
> to bottom before doing anything else.** It is the single source of truth for _what exists,
> what was decided, and what is still open._

---

## 1. What this is

Frontend for **Counterfoil** — an operator-owned SaaS platform for venues, tours, and
attractions (timed entry, tickets, bookings). Built by **Ternary Solutions**; ~20 operators
run the current version across Bangladesh, Malaysia, the US and Canada.

This repo is a **single Next.js app with two surfaces**:

| Surface | Who | Device | Character |
|---|---|---|---|
| **OS** | Operator admin | Desktop | Configuration, management, reporting. Dense. |
| **Go** | Front-of-house staff | Tablet (browser) | Point of sale, scanning, shifts. Touch. |

**The backend does not exist yet.** Every screen runs off a typed **mock data layer** with a
single swap point (`src/lib/api/client.ts`, built in Phase 3) so the backend team can replace
mock calls with real API calls by editing one file.

**The bar:** basic but structurally sound — an internal demo, not a launch. Cut visual polish,
transitions, empty-state art, microcopy. **Do not** cut component structure, data-fetching
patterns, form-state handling, or routing structure. ~15 CRUD screens are coming; the whole
point is to build the table/form/primitives **once** and reuse them.

---

## 2. Live links

| | URL |
|---|---|
| **Production (Vercel)** | https://counterfoil-frontend.vercel.app |
| **Design tokens** | https://counterfoil-frontend.vercel.app/tokens |
| **OS dashboard** | https://counterfoil-frontend.vercel.app/dashboard |
| **Go / POS** | https://counterfoil-frontend.vercel.app/pos |
| **Auth / sign-in** | https://counterfoil-frontend.vercel.app/sign-in |
| **Kitchen sink** (primitives) | https://counterfoil-frontend.vercel.app/kitchen-sink |
| **Products** (reference CRUD) | https://counterfoil-frontend.vercel.app/products |
| **Locations** | https://counterfoil-frontend.vercel.app/locations |
| **Counters** | https://counterfoil-frontend.vercel.app/counters |
| **Staff** | https://counterfoil-frontend.vercel.app/staff |
| **Roles** | https://counterfoil-frontend.vercel.app/settings/roles |
| **Orders** | https://counterfoil-frontend.vercel.app/orders |
| **Sales Reports** | https://counterfoil-frontend.vercel.app/reports/sales |
| **Calendar** | https://counterfoil-frontend.vercel.app/calendar |
| **Go — PIN login** | https://counterfoil-frontend.vercel.app/login |
| **Go — POS till** | https://counterfoil-frontend.vercel.app/pos |
| **Go — Scan** | https://counterfoil-frontend.vercel.app/scan |
| **GitHub repo** | https://github.com/sajid209-stack/counterfoil-frontend (public) |
| **Vercel project** | `sajid209-stacks-projects/counterfoil-frontend` |

Deploy at **every** checkpoint — the owner wants to click things.

---

## 3. Stack (as actually built)

- **Next.js 16.2.12**, App Router — ⚠️ brief specified 15; see **Decision D1**
- **React 19.2.4**
- **TypeScript**, `src/` dir, `@/*` import alias
- **Tailwind v4** (`@theme` syntax — no v3 config file) ✅ confirmed in `package.json`
- **npm**
- **lucide-react** — sanctioned icon library ✅ installed; use at 1.5px stroke / 24 grid
  (brand icon spec). Primitive layer lives in `src/components/ui/*` (import from `@/components/ui`).
- **Fonts:** Manrope + DM Mono via `next/font/google` (Phase 2)
- Deployed on **Vercel**

> ⚠️ This is **Next 16**, which has breaking changes vs the Next you may know. See the
> generated `AGENTS.md` — read `node_modules/next/dist/docs/` before writing app code.

---

## 4. Phase tracker

Work proceeds in checkpoints. **Stop at every checkpoint. Do not chain phases.**

| Phase | What | Status |
|---|---|---|
| **0** | Environment check | ✅ Done |
| **1** | Scaffold · repo · first deploy | ✅ Done |
| **2** | Design tokens (`/tokens` route) | ✅ Done |
| **3** | Routing structure + typed data layer (`src/lib/api`, `src/lib/mock`) | ✅ Done |
| **4** | Primitive component layer (`/kitchen-sink` route) | ✅ Done |
| **5** | Products — the reference CRUD screen | ✅ Done |
| **6** | Scaffold sweep — every remaining Stream 1 screen | ✅ Done |
| **7** | Golden path — 16-screen journey; NO booking-type dropdown; operator vocabulary | ✅ Done |
| **8** | Configuration drives the product — schedule builder, seed catalogue, POS reads config, reports | ✅ Done |
| **9** | Full booking engine — all 14 types, resources as first-class shared objects, pricing rules, IA restructure, design pass | ✅ Done |
| **10** | Operational layer — tax, policies, add-ons, tier composition, session-first POS, demo businesses | ✅ Done |
| **11 (P1)** | Master plan P1 — duration engine (liquid time), DurationInput/TimeInput primitives, per-type editor completeness | ✅ Done |

### Master plan (counterfoil_master_plan.md, local) — P1–P10 sequence

The 2026-07-31 master plan supersedes the previous plan docs and runs P1→P10, deploy between
each. P2 (policies/add-ons/tiers/tax/capacity owners), most of P6 (Schedule/Check-In) and P7
(demo businesses) were largely delivered in Phase 10 — remaining prompts fill gaps.

**P1 ✅ (2026-07-31)** — the configuration model:
- **`DurationInput` + `TimeInput`** (`src/components/ui`): free-typed with forgiving parsing
  (`90`, `1:30`, `1h30`, `1.5` → 1 hr 30 min; `1830`, `6:30p` → 18:30 — `lib/duration.ts`),
  stepper/scroll adjustment, quick chips that FILL not limit, inline parse errors. Replaced
  every preset-only duration/time control in OS (ScheduleBuilder, Policies, wizard flows).
- **The duration engine (BT-05)** — `DurationConfig` on Product: min/max/increment (validated:
  increment must divide the range), three pricing models (price list w/ fill-from-hourly ·
  hourly rate · base+extension), must-end-by-close, walk-in rounding, lead time.
  `lib/duration.ts` prices any span with **time-band blending** (a 17:00 90-min bowling
  booking = 1h @৳800 + 0.5h evening @৳1,200 = ৳1,400 — browser-verified). Editor =
  `DurationEngineField` with the mandatory concrete-numbers preview; wizard flexible flow
  collects the core; POS sheet chips are engine-generated with per-duration prices.
- **Per-type completeness**: validity-after-purchase (BT-01) · rolling/fixed window (BT-02) ·
  session names (BT-03, seeded "Morning show") · min-party-to-run + meeting point (BT-09) ·
  per-provider price/durations (BT-10) · credits-per-booking (BT-12) · join-partway (BT-13) ·
  pass identifier label (BT-14). All with defaults, in the right editor tab.
- Fixed a standing-rule violation: product page header showed "Booking type BT-05" — now the
  derived behaviour subtitle.

**P2 ✅ (2026-07-31)** — mostly delivered in Phase 10 (policies · add-ons · tax from config ·
capacity owners · deposits); the missing piece was **tier composition at the gate**:
- Family tier seeded on General Admission (৳1,400 · admits 4 · "2 adults + 2 children";
  age notes on tiers, shown on POS tier rows).
- **Group scan**: `Ticket.admitted` + `admitTicket()`/`ticketAdmits()` — scanning a group
  ticket shows "ADMIT 4 · Family · group of 4 · 0 in" with +1 / Admit-all; partial groups
  honoured (3 in, 1 remains, re-scan continues); fully admitted → redeemed → refused.
- POS party size now counts **people** (tier admits × qty; sections count; add-ons don't).

**P3 ✅ (2026-07-31)** — IA: Resources moved to `/settings/resources` (sub-nav slot between
Counters and Team, labelled with the operator's noun when uniform); removed from the main
sidebar. **Out-of-service (with reason) actionable from the Go Schedule tab** row overflow —
mark/return with a reason, rows show OUT. Wizard inline-creation unchanged.

**P4 ✅ (2026-07-31)** — the flexible POS sheet, driven by the P1 engine:
- **"Start now · 12:00 · 1 hr · Lane 1 · ৳800"** quick action (clock rounded per walk-in
  config, first free lane, one tap to cart).
- Duration chips with per-duration resolved prices; **lane row with "Any"** (best-fit
  assigns the first free lane at submit, shown as "Lane 1 (best fit)").
- **Only valid starts selectable**: past/lead-time ("Already past"), must-end-by-close
  ("Ends after closing" — 3 hr kills 21:00/22:00), lane busy ("Booked") — invalid starts
  greyed + struck through, tapping one states the reason. Changing duration re-filters and
  clears an invalidated selection with a notice. End time always shown ("17:00 – 18:30").
- **Extend**: cart lines get "+30m" (re-checks the lane behind incl. buffer, re-prices via
  the engine — verified ৳1,400 → ৳2,000 blended); post-sale Extend in Check-In via
  `extendBooking` when the lane behind is free.
- `isResourceFreeFor` / `firstFreeResource` added to the availability engine.

**P5 ✅ (2026-07-31)** — the POS element pass (subtitles/chips/inline payment/discounts were
Phase 10; this adds the rest):
- **Search** above the grid — persistent, live, matches name + category ("foot" → Football).
- **Park / Resume** — named parked carts in sessionStorage, "N parked" badge, full state
  restored (lines, discount, customer, credits pass); resume blocked while a cart is active.
- **Customer chip** — quick capture, flows to the order (`CheckoutInput.customerName`).
- **Cash keypad quick chips** — Exact · ৳500 · ৳1,000 · ৳2,000; **receipt step** on complete
  (Print · SMS · No receipt, mock actions).
- **Custom amount** gains a tax class (entry carries its own rate).
- **Cart line tap** reopens its sheet with state loaded (pencil retained).

**P6 ✅ (2026-07-31)** — Schedule tab, Check-In, nav and waitlist rows were Phase 10 (and
gained out-of-service overflow in P3, Extend in P4). The build item here: **Quick pass reads
its product's configuration** — a seeded BT-14 "Parking Pass" (excluded from the POS grid)
supplies the durations, per-hour price (followed by the duration picker, still editable) and
the identifier label ("Plate number") that the issue screen now asks for.

**P7 ✅ (2026-07-31)** — demo businesses to the new spec. The deltas (most already landed in
P1–P6): museum gains a **second guided tour sharing the same two guides** (Sculpture Garden
Tour — Sat 10:00 offers only Rahim because Ayesha leads the Heritage tour, browser-verified)
and an **All-Day Re-entry Pass** (re-entry while valid, same-day validity). Bowling engine
config, spa per-provider durations/premium/deposit, cinema credits-per-class, session names
and the Family tier were already seeded.

**P8 ✅ (2026-07-31)** — OS modernization: **zero literal "Loading…"** (all 18 replaced with
pulse skeletons; DataTable already had row skeletons) · DataTable: **sticky header, 48px
rows, hover, right-aligned tabular numerics**, subtle elevation · **EmptyState is a
perforated ticket stub** · sidebar gains 20px lucide icons · toasts move bottom-left ·
global **2px ember `:focus-visible` ring** · product form centred at max-w-3xl and
column-responsive.

**P9 ✅ (2026-07-31)** — POS/Go overhaul: **48px touch floor across POS** (category/discount/
method/pass/cart controls all ≥48px; keypad was already 64px) · charge bar 56px · sheets get
a drag handle, 12px top radius and a blurred ink backdrop · **scan-refused adds a hatched
treatment** (shape + pattern + text, not colour alone) · non-group scan results auto-ready
for the next scan in 2s.

**P10 ✅ (2026-07-31)** — responsive: **OS mobile** — sidebar becomes a hamburger slide-over
(`OsShell`), **tables become tappable card lists** under 640px (primary line + labelled
meta, generic in DataTable), forms already single-column with a sticky save bar ·
**Go phones** — header nav scrolls, **cart becomes a bottom drawer** with a persistent
ink summary bar ("N items · ৳X · View cart"), product grid 2-up. Breakpoint wiring verified
from both sides of each media query via computed styles.

### Design uplift (counterfoil_design_uplift_plan.md, local — supersedes P8/P9, deeper) —
all four parts ✅ (2026-08-01):

- **Part 1 — layout shell.** Aside is `h-screen sticky top-0 shrink-0 overflow-y-auto`;
  main `flex-1 min-w-0 overflow-x-hidden` — wide children scroll in their own cards, never
  the page (all routes audited: zero page x-scroll). Sidebar **collapses to a 64px icon
  rail** (tooltips, 200ms, persisted in localStorage).
- **Part 2 — dashboard redesign.** Header row (date · location switcher · Open POS); hero
  band (revenue w/ 320ms count-up + delta pill vs same day last week + 7-day sparkline ·
  tickets · checked-in of expected · arriving-next-2h → Check-In); **Up next** session list
  (fill bars, hatched FULL/BOOKED, row Sell into POS) + **Live activity** feed; right rail:
  payment-mix bars, top products, **Needs attention** (out-of-service, low-fill within 3h,
  pending waitlist; "All clear"). Checklist still replaces the hero until setup completes.
- **Part 3 — POS overhaul.** Go chrome: counter chip · shift timer · staff initial · 3px
  ember active underline. POS header zone (counter chip · wide search · parked badge);
  tile anatomy (16px name / 13px subtitle / mono price bottom-right); sheets rise over the
  grid only — the cart stays visible; animated tabular cart total; **sliding-thumb payment
  segmented control**; change due at display size; 56px receipt buttons; **scan accepted =
  paper on ink with product + tier large, refused = hatched danger** — shape + surface +
  text, never colour.
- **Part 4 — OS-wide polish.** DM Mono **breadcrumbs in the universal page header**
  (derived from the path, every page incl. Settings); **toasts with Undo** (product archive
  restores); interactive-card hover lift; motion tokens were already exact (120/200/320 ·
  cubic-bezier(0.32,0.72,0,1)). Grep checks: zero "Loading…", zero rendered BT codes.

### Lovable findings (counterfoil_lovable_findings.md, local) — all amendments ✅ (2026-08-01)

- **Lane timeline** in the flexible sheet: occupied blocks with party labels (order customer
  or "Walk-in (n)"), DM Mono hour ticks, the current selection drawn live in ember/70.
- **Per-resource rates**: `Resource.rateOverride` (premium per booking OR replacement hourly
  rate) — editor section in the resource form, applied after model + bands everywhere
  (chips, Start now, Add, matrix). Seeded: Lane 4 at ৳1,000/hr (browser-verified 1h ৳1,000 →
  3h ৳3,000).
- **Live lane state** on resource cards: "Free" / "In use until 19:30 · Khan (2)" /
  bookings-today count; rate shown on the card.
- **BlockedNotice primitive** (paper surface, ember accent bar, 3s auto-dismiss) — invalid
  start taps now name the reason AND the way forward.
- **Waiver gate**: `policies.waiver` toggle → POS requires "Guest has signed the waiver"
  before Add (all paths incl. Start now). Seeded on the spa.
- **Pricing basis** made explicit: `Product.pricingBasis` (per person / per booking), asked
  plainly in the wizard's resource flow; flat-basis sheets show a **group-size stepper**
  (bounded by party min/max) and the cart line reads "Group of 6"; group size feeds booking
  partySize.
- **Date chips first** — the next 5 bookable days as chips, calendar behind "More dates".
- **Low-availability flag** is percentage-based: amber "N left" at ≤20% of capacity (min 1).

### Delta prompts (counterfoil_delta_prompts.md, local) — all four ✅ (2026-08-01)

- **Delta A — OS parity.** Per-resource rate examples in the duration-engine preview
  ("Sat 19:00 · Lane 4 → …"); the **pricing basis drives the Pricing tab** (per-booking =
  one price + group limits, never tiers); POS "Ask a manager" **reads the signed-in staff's
  role limit** (hardcoded cap removed — edit the role, POS gates at the new value); the
  shared **ResourceTimeline in the OS Calendar day view** (rows per resource, OOS hatched);
  Resources list shows live state ("Free · next 14:00" / "In use until…"); a minimal
  **Customers page** (read path, deep-links to their orders); custom-amount sales group
  under **"Custom"** in reports.
- **Delta B — behaviour gaps** (most existed from the findings run): occupied timeline
  blocks tap-explain via BlockedNotice; cart extend refusals + over-limit discounts routed
  through the guidance pattern; low-availability = ember pill at ≤20%.
- **Delta C — the selectable-card language.** `ChoiceCard` + `Avatar` primitives: provider
  cards (avatar · role · +premium · next-free in mono), guide cards, lane cards, wizard
  options, demo cards and date-strip mini-cards all share one pattern — selection reads in
  grayscale (ember border + check glyph). Occupancy micro-bars (ember ≥80%), sheets centred
  at 680px, Go press states = ember tint, zero arbitrary radii.
- **Delta D — dark & light mode.** Semantic token layer (`surface/card/sheet/fg/muted/
  faint/line/strong/subtle/inverse`) with every component migrated off raw palette classes
  (83 files swept); `next-themes` class strategy, Light · Dark · System, persisted, no
  flash. Dark elevation = surface steps + 1px lines; sidebar gains a dark border; ember
  unchanged; ink-on-ember stays literal. **Mode-locked:** scan results and the perforated
  ticket stub. Toggles: OS Settings → Business → Appearance; Go → Shift menu (per device).
  Dark dashboard + POS browser-verified.

### Delta E (counterfoil_delta_prompts (1).md + COUNTERFOIL_RUN_ORDER.md) ✅ (2026-08-01)

The run-order doc's F1/F2/F4/F5/F6 were already delivered (Deltas A–D + uplift Parts 1–2);
the new work was **F3 = Delta E — sheet refinements + the overflow audit**:
- **Selection summary line** above every sheet CTA, live, mono numbers ("Lane 2 ·
  17:00–18:30 · 1 hr 30 min · Group of 2 · ৳1,400"); CTA stays disabled until complete.
- **The price math shown, not just the result**: `priceSegments` in `lib/duration.ts` —
  single-band reads "৳800 × 2 hr = ৳1,600", a band crossing reads
  "1 hr @ ৳800 + 30 min @ ৳1,200 = ৳1,400" (browser-verified); lane premiums noted inline,
  replacement rates collapse to one segment.
- **Start-time stepper** beside the chips (steps by the walk-in rounding, clamped to
  close − duration).
- **Capacity under date chips** (daily-cap remaining or seats across the day's
  departures), ember at ≤20%.
- **Add-on rows as the catering pattern**: full-width row, + becomes a stepper once
  added; per-person add-ons start at group/party size and show "× N = total" live.
- **Overflow audit**: min-w-0 on text flex children, names line-clamp/truncate, money
  `shrink-0 whitespace-nowrap`, min-heights instead of fixed heights on choice cards.
  **Stress seed**: "Grand Heritage Architectural Walking Tour of Old Dhaka with Rooftop
  Iftar Experience" (+ "Senior Citizen (65+, ID required)" tier, "Championship Court 1 —
  Centre" resource) — walked through grid/sheet/cart with zero page overflow.

### Dashboard v2 (counterfoil_design_uplift_plan (1).md — revised Part 2) ✅ (2026-08-01)

**Nothing is sold from OS.** The dashboard is the manager's cockpit — capacity, not
revenue, is the distinctive angle (the system owns both the sale and the scan):
- Header: date · location switcher · **Today / This-week scope** — no primary action;
  Open POS and every Sell affordance removed.
- Hero: Revenue (count-up, delta, sparkline) · **Capacity sold** ("6 / 772 · 1%" + fill
  bar + delta) · **Arrived** ("0 of 6 · 100% no-show") · **Booked ahead** (committed
  revenue next 7 days vs the week after).
- **Today's sessions** — management actions only: expand → the session's booking list
  inline · **Adjust capacity** (stepper modal, whole-pattern) · **Cancel session**
  (warning names affected bookings; `cancelSessionBookings` releases them).
- Right rail in priority order: **Needs attention** (cash variance · OOS · **products
  with no availability beyond a date** · waitlist · arrivals owing balances · devices
  unseen 7+ days) · **Idle capacity** (next 48h under 30% fill with the value of unsold
  places) · **Open shifts now** (mock Shift record) · Payment mix · Top products below.

**Master acceptance walk (Section C)** — steps 1–10 and 13 verified across the P1–P10
sessions (blended bowling pricing, engine-only durations, Start now + Extend, turf pricing +
sharing, Family group scan, two-tour guide conflict, spa deposit, park/resume + role-gated
discount, search/customer/custom/quick-pass, no "Loading…"/BT codes/hover-only affordances).
Step 11 (reports by hour + CSV) is Phase-8 functionality, unchanged. Step 12 (phone walk on
a real 390px viewport) could not be exercised in the automation browser (window resize is
ignored there) — breakpoint classes verified structurally instead; worth one manual pass on
a phone.

### F12 — mobile overflow by mechanism (counterfoil_F12_mobile_overflow.md, local) ✅ (2026-08-01)

Fixed by mechanism, not by screen; then **measured**, not assumed:
- **One nowrap per row** — audited all 24 `whitespace-nowrap` sites; money/time is the only
  nowrap child, labels get `min-w-0` + truncate/clamp. Two real offenders found by the sweep
  and fixed: the Scan code row (input now shrinks, button `shrink-0`) and the Schedule
  date row (wraps).
- **Unbreakable strings** — `break-words` on PageShell titles (references), DataTable card
  primaries, OrderLinesDetail names (`line-clamp-2`, incl. add-on child rows); ticket code
  on the complete screen `break-all` + responsive size.
- **Tables → cards under 768px** — DataTable card-list breakpoint moved sm→md; the reports
  transaction/summary tables keep their own `overflow-x-auto` card (wide breakdowns scroll
  inside the card, never the page).
- **Grids collapse** — remaining unresponsive form pairs (onboarding, wizard credits,
  waitlist mini-form) now single-column under 640px; chip/segmented grids audited as fitting.
- **No fixed width exceeds ~340px** (all remaining are ≤256px inputs or max-widths).
- **Buttons/tabs** — Charge label truncates (the amount never wraps), tab-bar labels
  truncate at 320px; **Modal + PageShell padding** drop to 16px under 640px.
- **Stress seeds (permanent)**: resource "Championship Court 1 — Centre (Covered)", tier
  "Senior Citizen (65+, valid ID required)", the long tour name, and order
  **CF-2026-999001** — 6 lines incl. 2 add-on children, both discount levels, customer
  "Mohammad Abdur Rahman Chowdhury · 01712-345678".
- **Verification**: the automation browser ignores window resize, so the sweep ran in
  **width-constrained iframes** (media queries follow the iframe viewport): 31 routes ×
  320/390/768 all pass `scrollWidth ≤ innerWidth`; the stress order at 320 shows zero
  clipped money elements; /orders at 390 renders as cards with the table hidden; the
  stress product's sheet opens at 320 without overflow.

### F11 — order lines, discounts, per-product revenue (counterfoil_F11_order_lines.md, local) ✅ (2026-08-01)

The order model rebuilt around **lines** (the doc said "run before F7" — it arrived after, so
F7's reports were retrofitted to aggregate from lines). The backend contract in `types.ts`
changed accordingly — **hand the new `Order`/`OrderLine`/`Payment` shapes to the backend lane.**

- **The model.** `OrderLine` = full snapshot at time of sale (productName, tierId/tierName,
  `admits`, unitPrice, `taxClass` + `taxRate` fraction, optional `booking` snapshot with
  resource/provider names, `parentLineId` for add-on children, `refundedQuantity/Amount`).
  Order carries `lineDiscountTotal · orderDiscount · discountTotal · taxTotal` (SUM of line
  taxes, never rate×total). `Payment` gains tendered/change/reference/status/createdAt.
  Renaming a product **cannot** rewrite history — browser-verified (renamed General
  Admission → Gate Entry; past orders still read General Admission at the old price).
- **One math engine** (`lib/orderMath.ts`) shared by POS totals, `checkout()`, counter
  add-ons AND the seed generator: subtotal → lineDiscount → pro-rata `orderDiscount`
  allocation (**largest-remainder**, asserts `sum === orderDiscount` exactly, self-test runs
  at module load in dev) → per-line tax → line total.
- **Discounts at both levels**: cart-line "%" action cycles a line discount; cart chips set
  the order discount; the role limit gates the **combined effective rate**
  (`discountTotal / subtotal`), not each level separately.
- **Add-ons are child lines** with their own product identity (`addon_*`) — indented under
  their parent everywhere, attributed separately in reports (Bib set / Premium oils / Shoe
  hire appear as their own Summary rows).
- **Tickets per line**: `quantity × admits`, each ticket carries `lineId` + the admits
  snapshot (2 Family tickets → each scans "group of 4 · Admit all 4"); child lines mint
  nothing.
- **Payments stay order-level**: cross-tabs bucket split tender under a visible **"Mixed"**
  row (22 seed orders) — never a fictional pro-rata split.
- **§8 transaction detail** (`components/OrderLinesDetail`): parent lines w/ booking meta,
  ↳ indented add-ons, per-line discounts on their own line, footer math, "Paid Cash ৳X ·
  bKash ৳Y" — rendered on the order page AND inside expandable transaction rows; the POS
  print receipt shows the same lines/discounts/VAT.
- **Everything that reads orders updated**: reports aggregate from line NET values,
  dashboard Top products reads line totals, per-line refunds mark `refundedQuantity/Amount`
  → `partly_refunded`, seed regenerated as multi-line orders (mixed carts, add-on children,
  line + order discounts, split tender).
- Verified in-browser: 5,000−165−483.50+652.73 cart math to the paisa; standard+reduced in
  one order → VAT 150 = 75+75; all 8 acceptance checks.

### F10 — mobile navigation + app readiness (counterfoil_F10_mobile_nav.md, local) ✅ (2026-08-01)

Nav position is now **responsive by form factor**; the top tab strip is gone from Go.
- **Go**: phone + tablet portrait get a **bottom tab bar** (56px + `env(safe-area-inset-bottom)`,
  24px icon over 11px label, ember active w/ 2px leading bar, tap-active-scrolls-to-top);
  a tablet held in **landscape** gets an **88px left rail** instead (custom Tailwind variant
  `rail` = `(min-width:64rem) and (orientation:landscape)` in globals.css). Tabs:
  Sell · Schedule · Scan · Check In · **More** — Schedule hides itself when the catalogue has
  no slotted products; Shift left the tab set (it's a state, it lives in the context bar).
  **More** = bottom-sheet grid: Shift · My sales (shift takings modal) · Quick pass ·
  My profile · Switch user · Settings · Help.
- **POS stacking on phone**: collapsed cart summary sits directly **above** the tab bar;
  the opened cart drawer and every sheet are z-50 **over** the tab bar (z-40) — nothing
  tappable behind a modal.
- **OS mobile**: hamburger drawer replaced by a bottom tab bar (Dashboard · Calendar ·
  Orders · Products · More); **More** opens a destination grid (3-col cards, same order every
  time, active card = ember border + tint + check). Desktop ink sidebar unchanged. Sticky
  form save-bars offset above the mobile tab bar.
- **App readiness (PWA)**: `app/manifest.ts` (standalone, any orientation, ink theme,
  192/512 + maskable SVG icons); viewport `viewport-fit=cover` + `maximum-scale=1` (no
  input-focus zoom) + light/dark `theme-color`; safe-area insets on every fixed element
  (tab bars, cart bar, sheets); `overscroll-behavior:none` (no rubber-band);
  `-webkit-tap-highlight-color:transparent`; chrome is `user-select:none` (content stays
  selectable); **app-shell service worker** (`public/sw.js`, prod-only registration via
  `PwaSetup`) — cache-first for hashed build assets, network-first navigations; offline
  data stays out of scope.
- Deferred (optional item): device-role default tab (gate device lands on Scan) — needs a
  device-identity mechanism the mock doesn't have.
- Verified: rail ↔ bottom-bar media split (computed styles both branches), More sheets in
  both surfaces, manifest/sw/icons all 200, viewport + overscroll + user-select live.
  True 390px viewport still can't be exercised in the automation browser (resize ignored) —
  structural verification only; worth one manual phone pass.

### F7–F9 (counterfoil_F7_F9_prompts.md, local) ✅ (2026-08-01)

- **F7 — Sales Reports rebuilt as the operator's questions.** `reports.ts` gains the
  transaction/analytics contract (`TransactionQuery/Row`, `AnalyticsQuery/Series`,
  `getTransactions`, `getAnalytics`). `/reports/sales`: 3 tabs — **Transactions** (default;
  expandable rows, running filters), **Summary** (group-by table; row-click filters into
  Transactions), **Analytics** (SVG chart primitives in `ui/charts.tsx`: revenue w/ compare,
  hour-of-day, day-of-week, payment mix, capacity utilisation, no-show rate, lead-time
  histogram, top products). Shared filter bar; **URL-synced state** (shareable links),
  **saved views** (localStorage), per-tab CSV export.
- **F8 — Go PIN screen.** Two-step: staff cards (photo initials, first name) → large PIN pad
  (72px keys); wrong-PIN shake + attempt countdown keeps the selection; 3 misses → 30s
  lockout w/ manager override; open-shift takeover ("Take over from Nadia?"); full-bleed ink.
- **F9 — Stream-1 coverage gaps.** Every named gap built and browser-verified:
  - **Account recovery**: `/forgot-password` (response never reveals account existence) →
    `/reset/[token]` (expired/used tokens get clear states); sign-in links it.
  - **Settings → Security**: password change, two-step toggle, **backup codes generated and
    shown once** (copy-all), email change w/ pending-confirmation state, recovery contact,
    recent sign-ins, sign-out-everywhere. Settings sub-nav gains Security.
  - **`/profile`** (Go avatar links to it): own details, language, read-only assignments,
    per-device sign-out. Team list gains an admin **Reset password** row action.
  - **Booking completion at the counter** (Check-In): each booking shows **paid vs
    outstanding from its order**; **Take balance** in any method (`addOrderPayment`);
    check-in **gated until settled** ("Settle first"); **Add extra** (product add-ons →
    `addOrderLines`); **Upgrade tier** (price difference only); receipt strip lists every
    payment (bkash ৳1,950 + cash ৳1,500). Plus **search** (name/reference), **Add a walk-in**
    (instant sale → today's roster), **no-show w/ reason** (`markNoShow`).
  - **Order actions** (`/orders/[id]`): **per-line refund with a reason**
    (`refundOrderLines` — negative payment, voids the product's unredeemed tickets,
    capacity release stays a backend TODO), **resend ticket** (email/SMS → history),
    **change date/time** (slot picker re-checks remaining vs party size →
    `rescheduleBooking`), **change history** + **internal notes** sections
    (`Order.history/notes`).
  - **Non-cash POS flows**: bKash → transaction-ID entry; Bangla QR → QR display; both run
    pending → confirmed | failed (failed = nothing charged, retry/cancel) before the sale
    lands; txn ID logged on the order.
  - **Ticket delivery**: Print → thermal-stub preview modal; SMS → exact message preview
    rendered from **`Operator.smsTemplate`** (`lib/sms.ts` placeholders `{business}/{code}/
    {date}`); Business settings gains the template editor w/ live preview.
  - **`/admin`** — hidden platform-operator console scaffold (operator list + create).

### Phase 10 — the missing operational layer (4 parts, all deployed)

- **Part 1 — POS structure + tax.** Behaviour subtitles on tiles (derived, no codes); category
  chips; inline payment selector (cash → change-due, non-cash settles inline); **per-line tax
  from a product tax class** (business rates: 15% standard / 7.5% reduced / exempt) — killed the
  hardcoded rate, VAT shows on the total; POS discount gated by a role limit ("ask a manager"
  over 10%); custom-amount tile.
- **Part 2 — operational config.** Product **Policies tab** (sales window, cancellation,
  reschedule, re-entry, deposit, party min/max, tax class) with defaults + plain summaries;
  **tier composition** (`admits` + age note — a Family tier admits 4); **add-ons** (editor +
  POS in both resource & tiered paths + seed bibs/shoes/oils).
- **Part 3 — Schedule + Check-In.** Session-first **Schedule tab** (day grid of every session,
  Sell deep-links to the POS sheet, FULL→Waitlist); **Check-In tab** (session-grouped rosters,
  partial-group check-in — 3 of 4). Go nav: Sell · Schedule · Scan · Check-in · Pass · Shift.
- **Part 4 — demo businesses.** Landing picker "Explore a demo business" (Museum · Turf · Bowling
  · Spa · Cinema) + **Start fresh**; `loadBusiness` swaps the whole mock (operator + products +
  regenerated 30-day orders); operator state unified in `client.ts`.

### Phase 10 follow-up — the deferred items, closed (2026-07-31)

All frontend-feasible Phase-10 deferrals are now built, browser-verified and deployed:

- **Guide/provider conflict at POS.** ONE capacity-owner mechanism (`ownerBusy`/`isOwnerFree`/
  `freeGuides` in `slots.ts`): a booking's `resourceId` names whichever owner it occupies —
  a Resource id OR a Staff id. Tour sheet: slot → "Led by" guide chips (busy guides disabled,
  first free auto-picked); a slot with seats but no free guide shows "No guide free". Provider
  sheet (spa): appointment time grid, per-provider availability, "First available" assigns the
  cheapest free provider.
- **Per-provider premium.** `Product.providerPremiums` (Karim +৳500) — shown on the chip,
  added as a "Karim premium" line.
- **Deposit charged as partial at POS.** Percent-deposit policy → cart shows Due now / Balance
  at arrival; cash screen collects the deposit; `checkout(payNow)` books the order as
  `partial`; complete screen prints "Balance due at arrival".
- **Per-day schedule overrides.** `ProductSchedule.dayOverrides` (Fri 14:00–23:00 while other
  days run base hours) — ScheduleBuilder row editor + preview "Except Fr 14:00–23:00";
  `slotTimesOn(schedule, date)` feeds POS grids/matrix/Schedule tab. Seeded on the turf.
- **Credits redemption.** A sold pack's ticket IS the pass (`Ticket.creditsUsed`).
  POS "Redeem a pass" → `findCreditPass(code)` validates (pack, expiry, balance) → eligible
  items covered oldest-first, sold as ৳0 lines (untaxed) → `checkout(credits)` decrements.
  Demo pass seeded: `CF-2026-PASS01` (3 of 10 used).
- **Fix:** daily-capped products (BT-06) could never be added at POS (Add demanded a slot
  time that capped products don't have); negative lines (discounts) no longer mint tickets.

**Still backend-owned:** refunds releasing capacity. **Still deferred by design:** seat maps,
online checkout, offline mode, receipt hardware, the Jira backlog sweep (after owner review).

### Phase 9 — full booking engine (6 parts, deploy after each)

The structural rule this phase adds: **resources are first-class and shared across products** —
availability computes *per resource*, so two products on the same field block each other (the
turf: Football + Cricket sharing Fields 1–2). BT codes stay derived/read-only. Resources/providers
are called by the operator's own word (Fields/Courts/Lanes…), including in the nav.

- **Part 1 ✅** — IA restructure: setup pages moved under `/settings` (Business · Locations ·
  Counters · Team · Devices · Payments · Roles) with a sub-nav layout; main nav is now
  Dashboard · Calendar · Orders · Products · Reports + a prominent Point of Sale link + Settings.
  Design pass: ink sidebar with DM-Mono section labels + 3px ember active bar; **primary CTA is
  now solid ember** (ink text, AA); perforated ticket stub on `pos/complete`. Booking Rules /
  Pricing dropped from nav (fold into product config in Part 3).
- **Part 2 ✅** — Resources first-class: `Resource` entity + CRUD (`/resources`), nav item appears
  once resources exist (labelled with the operator's plural noun). Wizard Q1 gains "They book a
  space or equipment" → resource sub-flow (pick/inline-add resources · fixed vs flexible · exclusive
  vs shared · buffer) → derives **BT-04** (fixed+exclusive) or **BT-05**. `Product` gains
  `resourceIds`/`resourceExclusive`/`bufferMinutes`/`flexibleDurations`; `Booking` gains
  `resourceId`. **`getResourceMatrix(product, date)` in `slots.ts`** computes availability PER
  RESOURCE across ALL products (the turf sharing rule), respecting buffer + out-of-service.
  BookingTypeCode extended to all 14. **Backend contract:** `Resource` + product resource pool +
  availability-keyed-by-resource is ready in `types.ts` to hand to the backend lane.
- **Part 3 ✅** — Pricing rules on products (`PricingRule[]`, day/time bands, top-down first-match,
  drag-reorder, mandatory live preview). `resolveProductPrice` in `lib/pricing.ts`; POS slot faces
  show the resolved price.
- **Part 4 ✅** — Question flow extended to all types: provider (BT-10), course (BT-13), bundle
  (BT-08), credits (BT-12); waitlist (BT-11) toggle; field-pass quick-issue screen (BT-14) in Go nav.
  `ProductSection` + provider/course/bundle/credits fields on `Product`.
- **Part 5 ✅** — POS `ProductSheet` reads every type: fields×times **matrix** (BOOKED = diagonal
  hatch, no colour-dependence), resource-flexible (resource + start + duration), provider cards,
  section steppers, course enrol, and **Join waitlist** on full slots. Checkout holds resource
  bookings (`resourceId` on `Booking`/`CheckoutBooking`); selling decrements per resource live.
- **Part 6 ✅** — Full seed catalogue: **Football + Cricket sharing Fields 1–2** (base ৳1,500 /
  evening ৳2,000 / Fri-Sat evening ৳2,500, 15-min buffer), Bowling (Lanes 1–4, flexible, evening
  uplift), Massage (2 therapists), Film (Stalls/Balcony sections), Day Pass Bundle, 10-Class Yoga
  credits pack, Beginner Swim course, waitlist Yoga. Explicit turf bookings so Field 1 shows BOOKED
  on Sat 2026-08-01 while Field 2 stays free — the sharing proof. **All 14 booking types now
  configurable and sellable.**

### Phase 8 — configuration is a promise the rest of the product keeps

- **Schedule builder** (`ScheduleBuilder`) in the wizard + edit for timed types: weekly pattern
  (interval, hours, open days, capacity), **live preview line**, tour guides (team multi-select),
  closed-date exceptions. `ProductSchedule` on the product model. Inline location creation in the
  wizard; smart default when one location. No schedule shown to open/date-range products.
- **Seed catalogue**: 5 products, one per type — General Admission (BT-01), Winter Exhibition
  Pass (BT-02), Planetarium Show (BT-03, 45-min slots 11:00–16:30, 40 seats, closed Mon),
  Sculpture Garden (BT-06, 200/day), Heritage Walking Tour (BT-09, 10:00 & 14:00, 15 seats,
  guides Ayesha & Rahim, Fri–Sun). Generator books real slots with capacity; some pre-sold
  today/tomorrow so POS shows honest remaining.
- **POS reads configuration** (`lib/api/slots.ts` + `ProductSheet`): tap → open/date-range go
  straight to cart; capped shows a date with "N left"; slot-based shows a slot grid (seats left,
  FULL greyed); tour slots carry guides. Bottom sheet over the cart (no navigation). Cart lines
  carry their slot. Checkout holds slot/daily capacity via bookings → remaining decrements live.
- **Sales reports** (`lib/api/reports.ts` — the `SalesReportQuery/Row/Response` contract):
  presets, summary cards with deltas vs previous period, Group-by switcher (product · category ·
  payment · counter · location · team · hour), sortable, row drill-down to transactions, CSV export.

**Deferred (by decision, per the brief):** calendar-grid exceptions, seat reservation (Stream 2),
per-booking guest details, online booking, and **refunds releasing slot capacity back — TODO in
the mock layer; the backend must handle it.**

### Phase 7 — golden path (the governing rule)

**Internal identifiers never appear in the UI.** No `BT-0n` dropdown anywhere — booking type
is *derived* from three plain questions and shown only in a read-only **Advanced** section on
the product edit screen. Operator vocabulary everywhere: Ticket (not entitlement), Check-in
(not redemption), Business (not tenant), Team member (not staff/role), Daily limit (not
capacity), Valid dates (not validity window), "Where it's sold" (not channel). Writing rules:
labels name the thing, helper says what happens, buttons are verbs, errors say what to do.
The mock persists within a session so the whole journey works without touching seed data.

Delivered in 3 parts: (1) sign-up → onboarding → checklist · (2) location/counter/team/product
wizard/device · (3) the Go flow back to dashboard.

**Done.** `/products/new` is now a 5-step wizard using the `BookingSetup` question flow (Q1→Q2/Q3);
product edit is a tabbed editor (Details · Availability · Pricing · Where it's sold · Advanced)
with the BT code read-only in Advanced. New `Device` entity + `/devices` + register-with-pairing-code.
`/onboarding` + setup-checklist dashboard. **POS checkout (`checkout()`) creates a real paid order
+ tickets**, so the code on the complete screen scans at `/scan` (admit), then is refused on a
second scan (already redeemed), and the sale shows on the dashboard — the whole 16-screen path
works in-session without touching seed data.

### Phase 6 (scaffold sweep) — complete

**OS** (list + `/new` + `/[id]`, Products pattern; search/filter/sort, skeletons, empty
states, validation): ✅ Dashboard · Products · Locations · Counters · Staff · Roles
(`/settings/roles`) · Booking Rules · Pricing · Orders (+ refund) · Sales Reports
(`/reports/sales`) · Calendar · Business Setup (`/settings/business`).

**Go** (touch, 48px targets, `(go)` layout): ✅ PIN login · shift open · POS till · cash
payment · ticket complete · scan · scan result (admit/reject: colour+shape+text) · arrivals ·
shift close.

**Auth:** ✅ sign-in · sign-up · invite/[token].

**Mock layer extended:** Operator (+tax), Category, BookingRule, PriceRule, Order, OrderLine,
Payment, Ticket, Booking — all via `@/lib/api`, 200–400ms latency, `ApiResult`. Transactional
data (~160 orders + tickets + bookings) generated deterministically in `lib/mock/generate.ts`.

**Known simplifications (scaffold fidelity — for engineers to finish):** product seed is 8
(not ~40); Booking Rules / Pricing are list-only (no editor yet); Location hours + logo upload
are read-only placeholders; Dashboard shows entity counts (not yet revenue/arrivals/fill).

**Deploy note:** Vercel CLI deploys (Hobby plan) queue one-at-a-time and are slow to start
(several min). All code lands on GitHub `main` immediately regardless. **Recommend connecting
the GitHub repo to Vercel for auto-deploy** — more reliable than CLI at this cadence.
| **later** | OS: Locations · Counters · Staff · Business Setup · Booking Rules · Pricing · Orders · Dashboard · Sales Reports · Calendar | ⬜ |
| **later** | Go: PIN login/shift open · POS · Cash payment · Ticket issued · Scan · Scan result · Shift close | ⬜ |

Full phase-by-phase brief lives in `counterfoil_claude_code_prompts.md` (kept **local only**,
not committed — see D3). Two Go screens need extra care: the **POS till** (tap efficiency) and
the **scan result** (readable in <1s at 3m; colour alone is not enough — shape + text must carry).

---

## 5. Decisions log

- **D1 — Next.js 16 over 15** (2026-07-29): `create-next-app@latest` resolved to **16.2.12**;
  owner chose to keep it rather than pin to 15. Trade-off accepted: breaking changes vs 15 and
  possibly-stale model knowledge of Next conventions.
- **D2 — default branch `main`** (2026-07-29): renamed from create-next-app's `master`.
- **D3 — roadmap doc kept out of git** (2026-07-29): `counterfoil_claude_code_prompts.md`
  (internal build prompts) is **not committed** — this is a public repo.
- **D4 — public repo** (2026-07-29): per owner. Created + pushed via `gh repo create` using a
  classic PAT with `repo` scope (the fine-grained PAT first supplied could not create repos).
- **D5 — type contract locked** (2026-07-29): reviewed the draft entity types and locked the
  final shapes (`src/lib/api/types.ts`). Decisions: one `status: Lifecycle` across entities;
  `ApiResult<T>` (no silent throws); offset pagination; `Counter.isOpen` moved off to a future
  Shift entity; `Permission` stays `string[]` until the Roles screen; single `Operator.currency`
  (BDT). Added `Operator` and `Category` (were referenced but undefined); multi-interval
  `OpeningHours`; `ProductImage[]` objects; `Staff` gains `invited/suspended` + email-or-phone.
- **D6 — no BT badge in the UI** (2026-07-29): per owner. `Product.bookingType` stays as a data
  field (backend needs it) but is never rendered. This makes the BT-02/04/07 numbering conflict
  a pure backend concern — off the UI's plate. `BookingTypeMeta` dropped.
- **D7 — guardrail** (2026-07-29): a `PreToolUse` hook in `~/.claude/settings.local.json` hard-
  denies any command touching the other Ternary repos (ternary-website-v3 / -local-dump /
  -prod-dump / -design-mockups) or running a destructive `gh repo` op. The owner now maintains
  this guardrail themselves; do not modify it.
- **D8 — semantic colours added** (2026-07-29): the brand palette has no functional status
  colours, so `--color-success/-warning/-danger/-info` were added to `@theme`. These are NOT
  brand accents (used only for status pills, destructive actions, inline feedback), so the
  "one accent per screen" rule still refers to ember alone.
- **D9 — autonomous build** (2026-07-29): owner asked to stop pausing at checkpoints and build
  the full scope to best judgment, deploying at each checkpoint. Only pause when genuinely
  blocked on a decision only they can make.

---

## 6. Open questions / to settle

- **~~BT numbering conflict~~** — RESOLVED for the UI (D6): the BT badge is not rendered, so the
  brand-vs-Jira disagreement (BT-04/07 swapped, BT-02 contested) no longer affects the frontend.
  Still a backend concern whenever booking-type behaviour is implemented, but not blocking here.
- **Derived colour scales are unconfirmed** (Phase 2): only the 3 brand primaries (`ink`,
  `paper`, `ember`, plus `bt-violet`) are exact. The neutral and amber scales are a derivation
  and must be corrected from the Figma library later — marked in CSS as unconfirmed. The brand
  guidelines PDF is in the project folder if exact values are needed.
- **~~Type contract review~~** — RESOLVED (D5): the entity types are locked in
  `src/lib/api/types.ts` and ready to hand to the backend team.

---

## 7. Local development

```bash
git clone https://github.com/sajid209-stack/counterfoil-frontend.git
cd counterfoil-frontend
npm install
npm run dev            # http://localhost:3000
```

Deploy to production (Vercel CLI, authed as `sajid209-stack`):

```bash
vercel --prod
```

---

## 8. Tooling & accounts (this machine)

- **Node** v22.19.0 · **npm** 10.9.3 (brief floor: Node 20+) ✅
- **git identity:** Sajid Shakib `<sshakib@ternary.solutions>`
- **gh** 2.96.0 — authed via a fine-grained PAT (account `sajid209-stack`). ⚠️ Cannot create
  repos; can push to existing ones with Contents:write.
- **vercel** 58.1.0 — authed as `sajid209-stack`
- **OS:** Windows 11, PowerShell (Bash tool also available)

---

## 9. How to keep this doc useful

When you finish a unit of work, before you stop, update the sections that changed:
**phase tracker** (status), **decisions log** (new choices, dated), **open questions**
(resolved → strike/remove; new → add), and **live links** if a URL appears. A stale log is
worse than none — it should always describe the repo _as it is right now_.

---

## Backend gap-closing — Milestone 1 (2026-08-23) ✅

After reading the real backend (`counterfoil-app/application` — FastAPI microservices + OpenAPI
contracts), we began closing frontend↔backend feature gaps. **All local (mock data layer); nothing
pushed. New types modeled on the real OpenAPI shapes so the eventual `client.ts`→SDK swap is
mechanical.** Money stays integer minor units.

- **Money setup** — `/settings/payments` upgraded to payment-account onboarding
  (`PaymentAccount`: provider bkash/sslcommerz/stripe · posture · status · charges/payouts ·
  requirementsDue) + tax config (`TaxConfig`: mode + bps). POS non-cash methods now gate on a live
  PSP account (`canTakeNonCash`). `lib/api/paymentAccounts.ts`, `taxConfig.ts`; seed = 1 live bKash
  MoR account + 15% VAT.
- **Seat maps** — `SeatLayout/SeatCategory/LayoutSeat/ConfigLayoutLink/AvailableSeat`;
  `lib/api/layouts.ts`. OS editor at `/products/layouts` (+`/[id]`): grid seat editor, colour+price
  categories, GA, buffer. POS `ProductSheet` renders a visual **seat picker** for products with a
  `layoutId` (feeds `CartEntry.seatLabels`). Seeded a cinema "Main Hall" (8×12, Stalls/Balcony,
  some pre-sold) linked to `prd_film`.
- **Richer promotions** — `Promotion/Coupon/ManualDiscountPolicy/AppliedPromotion` + a pure quote
  engine (`lib/api/promotions.ts`, mirrors promotions/engine.py: %/fixed/fixed-price/BXGY). OS
  `/promotions` list + editor + cashier-discount-policy card. POS: coupon entry (resolve→apply, line
  allocation), and the manual discount now gated by `ManualDiscountPolicy` (cap + **required
  reason**) instead of the flat role cap. Seed: WELCOME10 (10%), an automatic BXGY, policy (10% +
  reason required).
- **i18n**: new namespaces `moneysetup`, `seatmaps`, `promotions` (+ `nav.promotions`) authored in
  **both en and bn**. Enum labels via `lib/labels.ts`.
- Verified: `tsc --noEmit` clean · `npm run build` clean · all routes 200 in EN + বাংলা.

**Next milestones (not started):** transfers/resale + credential reissue; donation pricing;
write-offs; rebooking; billing; storefront + API keys; then the actual `client.ts`→SDK wiring +
full `types.ts`↔OpenAPI alignment. i18n Batch 2 (remaining OS screens: products editor, orders,
reports, settings forms, auth, profile) also still pending.

---

## Design run (2026-08-24 → 28) — the Aura visual match

Between Milestone 1 and Milestone 2 the app was pulled toward the Lovable "Aura UI" reference
(counterfoilos.lovable.app — warm-orange flat + glass; see the design-reference notes): the full
Aura shell (light sidebar, glass navbar, logo mark, settings hub), soft-shadow cards and glass
overlays, real foil logo lockups (mode-aware), a stronger dark-mode card border, ember focus
rings on inputs, a rebranded landing "pick your business" wall, a branded sign-in front door,
better demo product photos + app icons, `prefers-reduced-motion` respected on interactive cards,
and a service-worker cache bump to force the shell refresh. Shipped alongside: partial payments
(min-deposit policy, POS pay-in-full, order take-payment), an outstanding-balances tab, the
visual time-band pricing editor, settling a part-paid booking at the till, and a fix for
invisible POS keypad numbers in light mode.

---

## Backend gap-closing — Milestone 2 (2026-08-30)

Grounded in the Jira epics (`counterfoil_epics_and_stories_v2.md`, local on the owner's Desktop)
rather than the backend source, which is not on this machine this session. §-numbers below refer
to that document.

### Part 1 ✅ — customers become records (§63)

Until now a "customer" was free text on an order: two spellings of one person were two customers,
and nothing could hang off them. `Customer` (customers.v1) is now a first-class entity.

- **Matching.** `phoneKey`/`emailKey` are normalised on write — `01712-345678`,
  `+8801712345678` and `880 1712 345678` all resolve to the same person. Phone is the strong
  key, email next; a bare **name** match is only ever a *suggestion*, never applied on its own
  (§63.13).
- **Order gains `customerId`** beside the existing `customerName`, which stays a snapshot —
  renaming a customer must not rewrite history, exactly as with product names on lines.
- **Stats are derived, never stored** (`customerStats`): orders, spend, visits, no-shows, owing,
  upcoming, first/last seen. The backend computes these from the ledger; a cached copy here
  would drift. The list endpoint returns them (`listCustomerRows` → `CustomerWithStats`) so
  screens ask for rows rather than computing totals themselves.
- **Merge (§63.7).** The survivor keeps its own contact details, fills its blanks from the loser,
  unions consents and notes in time order, and takes over the loser's orders. The loser is *not*
  deleted — it becomes a tombstone (`mergedIntoId`) so any surviving reference still resolves
  (`resolveCustomer` follows the chain). A duplicate finder ranks phone/email matches **high** and
  name-only **medium**.
- **Consent is an append-only log** (§63.8): every decision carries channel, granted, capturedAt
  and source (counter/online/import/manager); the latest entry per channel is the answer. The
  seed proves it — Tanvir Ahmed granted email in January and withdrew it in June.
- **Erasure (§63.11).** Identity gone irreversibly; the row and every order survive for the
  accounts, reading "Erased customer".
- **Screens.** `/customers` rebuilt (search across name/phone/email, Everyone/Flagged/Email
  consent/SMS consent segments, CSV export of the filtered group §63.9–10, the duplicate merge
  tool) and a new `/customers/[id]` with a flag banner, six stat tiles, and Activity · Details ·
  Consent · Notes tabs, plus flag/merge/erase actions. Order detail links to the record.
- **POS.** The customer chip is now a **picker** — it searches existing records first, matches a
  walk-up on their phone in any format, creates only when nothing matches, and surfaces a
  **flagged customer's reason at the till** (that is the point of a staff-attention flag).
  Parked carts carry the attached record.
- **Seed.** A 20-person roster attached to 105 of 151 orders, with deliberate duplicates —
  Farhana Haque/Hoque share a phone (high), two unrelated Imran Hossains share only a name
  (medium) — a real consent trail, a corporate tag + note on Zahid Chowdhury, and a flagged
  Sabbir Alam. Past bookings now resolve to **checked-in / partly checked-in / no-show**, so the
  Visits and No-shows tiles carry real numbers instead of reading zero for everyone.
- i18n: `customers` namespace rewritten and `pos.customerModal` extended, both **en and bn**.

**Verified:** `tsc --noEmit` and `npm run build` clean, no new lint findings, all routes 200 in
both locales with no missing-message warnings, and a **23-check harness over the data layer**
(phone normalisation, duplicate ranking, walk-up matching, match-or-create fill-without-overwrite,
merge order repointing + tombstone resolution, consent latest-wins, erase keeping order rows)
passing. Browser-verified on production: list, duplicate finder, and the flagged customer detail.

**Known, pre-existing, NOT introduced here:** the mock seed is anchored to **2026-07-29**
(`NOW` in `lib/mock/generate.ts`) and does not follow the real date, so every seeded booking is
now in the past and the customer "Upcoming" tile reads 0. This affects the dashboard, Schedule
and Check-In equally. Re-anchoring the seed to the current date would touch the hand-authored
proofs whose literal dates the acceptance walks cite (turf sharing on 2026-08-01, the Saturday
guide conflict, the credits pass) — an owner decision, not a silent change.

### Part 2 ✅ — memberships and loyalty (§16, §17)

**Memberships (membership.v1).** `MembershipTier` carries price, billing period, auto-renew +
notice days, a discount scoped to everything / chosen categories / chosen products, included
visits, guest passes, and how many people it covers (family memberships).

- **Lapsing is a date crossing, not a stored flag.** `status` records what a *person* decided
  (paused, cancelled); `effectiveStatus` (in `viewOf`) resolves that against today. Nothing
  depends on a nightly job having run, and the mock cannot drift from the backend on this.
  The tier name is snapshotted onto the membership for the same reason product names are
  snapshotted onto order lines.
- Issue · **renew** (from the later of today and the current expiry, so renewing early never
  shortens and renewing late never back-dates; a new period restores visits and guest passes) ·
  pause · **resume** (extends the expiry by the days it sat paused — the member paid for that
  time) · cancel with a required reason.
- **The gate (§16.10):** a `CF-M-` code scans at the same input as a ticket. Limited tiers spend
  an included visit; unlimited ones do not count down; lapsed, paused, cancelled and used-up
  memberships are refused **with the reason**, never a bare no.
- **Screens:** `/memberships` (Active · Expiring · Lapsed · Paused · Cancelled, each with a live
  count, plus row actions) and `/settings/memberships` (tier editor with the mandatory concrete
  preview). Both read counts through the api layer rather than peeking at the store.

**Loyalty (loyalty.v1).** The balance is **never stored** — it is an append-only ledger replayed
on read, as the backend does it. A stored balance and a ledger disagree exactly once, and then
nobody can tell which is right. Expiry is applied at read time rather than written as rows, so
the mock does not invent entries the real ledger will not have.

- Points round **down** so an unpaid point is never awarded. Redemption is capped by the balance,
  the programme minimum **and the sale**, so points can never create change owed.
- `/settings/loyalty` states the programme in the operator's own numbers ("Spend ৳1,000 and earn
  1,000 points, worth ৳250 off a future visit") and shows outstanding points as the money they
  already are.

**At the till and on the record.**
- POS gains **member pricing** (applied only to what the tier covers, never to a membership sale,
  and — like a coupon — *not* counted against the cashier discount cap, because it is an
  entitlement rather than a discount), a **points sheet**, and **selling a membership**. All
  three hang off the attached customer, so removing the customer removes the benefit.
- Membership issue, points spend and points earn all run **after** checkout succeeds. A
  membership issued against a sale that then failed is a membership nobody paid for.
- Customer detail gains a **Membership & points** tab (§63.4) with issue/renew/pause/resume/
  cancel and a manual points adjustment that demands a reason.

**Seed:** three tiers exercising every mechanism (unlimited individual annual · four-person
family · monthly with limited visits and a category-scoped discount), six memberships covering
every state, and a points ledger built from real orders — including one entry deliberately
inside the 60-day expiry warning.

**Verified:** tsc + build clean, no new lint findings, all routes 200 in both locales with no
missing-message warnings, and a **38-check harness** (derived lapsing, expiring windows, benefit
gating by state, gate refusals, renew/pause/resume arithmetic, ledger replay, redemption caps)
passing alongside part 1's 23. Browser-verified on production: the memberships list with correct
derived states, the customer Membership & points tab, and the **full till path** — attaching
Ayesha by phone, ৳800 − ৳80 member price, VAT ৳108 on the discounted base, total ৳828, and the
points sheet capping at **2,880 usable** (৳720 payable ÷ ৳0.25 a point) rather than her 9,999
balance. Two defects were found by that walk and fixed: the points slider opened at zero because
its state was captured before a customer was attached, and the customer search did not focus on
open.

Also fixed a pre-existing missing key — `pos.settle.settled` rendered raw in the toast after
settling a booking at the till.

### Part 3 ✅ — booking holds and locks (§61)

**Holds.** A `Hold` takes capacity off public sale without pretending to be a booking. Four
kinds — `capacity` (n places), `session` (everything left on a slot), `resource` (a lane, field
or court over a span), `seats` (named seats out of the picker).

- **Expiry is a clock crossing, not a stored flag** — the same rule as membership lapsing.
  `status` records what a person decided (released, converted); `holdView` resolves it against
  now, so a checkout hold releases itself with nobody running a job.
- **A hold always names who it is for.** `heldFor` is required and validated: an unexplained
  block on the calendar is indistinguishable from a bug six weeks later. Even the till's own
  holds are labelled ("Checkout in progress") and filtered out of the manager's list by default.
- **"Stop selling this session" is a hold of everything left**, not a second flag — one
  mechanism, so nothing has to remember to check two things.
- `/holds` (Holding · Expired · Released · Became bookings) with place, release and a preview
  that states in plain words exactly what is coming off sale.

**Availability actually respects them.** `getSlots`, `getDailyRemaining` and `isResourceFreeFor`
all subtract active holds; a resource hold that merely *clips* the edge of a requested span
still blocks it (overlap, not containment).

**`explainUnavailable()` — one answer for "why can I not sell this?" (§61.14).** A full slot in
POS is now **tappable rather than disabled**: tapping it says whether it is sold out, held for a
named group, a closed session, or a locked past date — and what to do about it. Sold-out even
reports how many places are actually left when the party is too big.

**Locks.**
- `bookingEditable()` is the **single** question every edit path asks, so a booking that is
  untouchable is untouchable everywhere rather than in whichever screens remembered to check.
  It covers all three reasons: locked by a manager (§61.7), past the operator's editing window
  (§61.10), or someone else mid-edit (§61.12).
- Lock/unlock from the order's booking row; **unlocking always takes a reason**, so the record
  says who overrode what.
- A short **edit lease** (`editingBy`/`editingUntil`) gives the backend its contract for
  preventing two staff editing one booking; with a single browser session it cannot be
  exercised end-to-end, only unit-verified.
- **Past-date lock** is an operator setting (`pastEditLockDays`, in Settings → Business):
  closing history stops a mis-keyed refund landing on a month already reconciled.

**Checkout holds (§61.11).** Adding a slotted item at the till places a 10-minute self-releasing
hold, so a second till cannot sell the same seats out from under it. Completing, clearing or
parking the cart releases them; an abandoned till gives them back on its own.

**Seed:** one hold of each mechanism — a named school group holding 25 places, a session locked
for a private event, a lane held for maintenance, one already past its expiry (proving holds
release themselves), and one released.

**Verified:** tsc + build clean, no new lint findings, all routes 200 in both locales with no
missing-message warnings, and a **44-check harness** — derived expiry, holds subtracting from
slot/daily/resource availability, edge-clipping overlap, every branch of `explainUnavailable`,
place/release/convert/extend, the till's hold being hidden then released, lock refusal messages,
the edit lease, and the past-date window.

**Harness gotcha worth remembering:** under `jiti`, `@/lib/api/client` and `./client` resolve to
**two separate module instances**, so a test that patches operator state through the `@/` path
will not be seen by a module that imported `./client`. Go through the entity module
(`updateOperator`) instead. Two checks failed on exactly this and were not product bugs.
