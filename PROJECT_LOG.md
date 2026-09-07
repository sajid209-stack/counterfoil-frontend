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

---

## Milestone 2 — done, and what is next

All three parts are deployed and browser-verified on production. The end-to-end proof worth
repeating: a manager places a **session hold** on `/holds` for "Private event" → availability
drops that departure to zero → the till shows **14:00 FULL** → tapping it says *"This session is
closed for sales — Private event. Release it from Holds to sell again."* Capacity, the ledger and
the counter all agree, and the refusal names its own mechanism.

**Still not started, in rough order of value:** transfers/resale + credential reissue ·
rebooking · donation pricing · write-offs · billing · storefront + API keys · then the actual
`client.ts` → SDK wiring and full `types.ts` ↔ OpenAPI alignment. i18n Batch 2 (products editor,
orders, reports, settings forms, auth, profile) is still pending.

**Owner decisions waiting:** whether to re-anchor the whole seed to the real date (see the
Part 1 note — it would touch the hand-authored proofs the acceptance walks cite by literal
date), and the Section D Jira sweep.

---

## Design pass (2026-08-30) — calendar, time pickers, cards, brand

Owner review of the deployed app raised four things. Reference material: the
owner's **`khandakerjunainahsuha-star/counterfoil-pos`** repo — a Lovable
Vite/React exploration with seventeen vertical-specific POS designs (bowling,
karting, laser tag, cinemas, spas, coworking…). It is a *visual* reference, not
a target architecture.

### 1. The calendar was not a calendar ✅

Day, Week and Month all rendered the same vertical list — one card per day, one
booking per card — and the day view stacked a timeline per resource with the
**6→23 hour axis repeated under every single row**.

- New `calendar/_components`: `model.ts` (one `CalEvent` view model + lane
  packing), `DayGrid`, `WeekGrid`, `MonthGrid`. The grids know nothing about
  bookings or products; they position rectangles, which is what stops the three
  views drifting apart.
- **Day**: one shared sticky hour axis, resources as lanes. Guides get lanes too
  (they are capacity owners) and there is a "Not assigned" lane for timed entry.
  Switchable to group by product.
- **Week**: 7 columns over a shared hour gutter; all-day items in their own
  strip; at most 3 side-by-side events per column, the rest collapsing to "+N"
  that drops into Day view.
- **Month**: a proper 7-column date grid with chips and "+N more".
- **Overlap packing** — without it two bookings at one time draw on top of each
  other and one is invisible.
- **Holds appear on the calendar**, hatched: a manager needs to see capacity
  that is spoken for as well as sold. New `--color-warning-wash` /
  `--color-danger-wash` tokens keep the hatching readable behind text in both
  modes. There is a key along the bottom.
- Grids own their scroll on both axes so headers actually stick.

### 2. Fixed vs variable time ✅

Two different clumsy things wearing one coat.

- **Fixed sessions** (planetarium, tours) were a grid of small time tiles, which
  made every session look identical and hid the number a cashier decides on.
  New `SessionList`: rows with the time leading, an occupancy bar, the count and
  the price. Bar goes ember at 80% sold, count amber at 20% left — the app's
  existing low-availability language, not LaserTag's traffic lights.
- **Resource slots** (turf, courts) printed the price into *every cell*:
  "৳1,500.00" twenty-eight times inside a table that scrolled sideways to reach
  the afternoon. New `SlotMatrix`: cells carry the **time** and their state; the
  price is stated once underneath and appears in a cell only where it differs
  from the base rate. A taken slot explains itself rather than being dead.
- The flexible/duration path (bowling) already matched the reference's shape —
  selected-lane timeline, duration stepper, valid starts — and was left alone.

### 3. Product cards ✅

The 4:3 photo band *was* the card: ~250px of picture with name, subtitle and
price crushed into a strip beneath, and only three products visible on a wide
till. Now a row with a **72px thumbnail** (owner asked for a thumbnail, "make it
slightly bigger"), two or three columns. Ten products visible where three were.

### 4. Brand — Go streaks were everywhere ✅

The orange motion streaks **are** the Counterfoil Go identity. They were on the
OS sidebar, landing, sign-in, the favicon and every PWA icon, branding the whole
platform as the till. Worse, OS had no real wordmark at all — it set
"Counterfoil" in Manrope extrabold with a capital C, a lookalike rather than the
drawn lowercase logotype.

- Generated `logo-counterfoil.png` / `-dark`, `mark-plain.png` / `-dark` and new
  app icons from the brand asset in the reference repo (foil **without**
  streaks + the real wordmark). Verified: light artwork is pure black, dark is
  pure white.
- `Logo` renders real artwork for both marques and its doc comment now states
  which surface gets which. `LogoMark`, favicon and PWA icons use the plain
  mark; the manifest is named "Counterfoil" and starts at the landing page, so
  its icon is the platform's.
- The Go lockup stays only in `(go)/layout`. Service worker bumped to v3.

**Still open for the owner:** the seed photography. Several images are weak —
one is watermarked stock ("JAMIE SWEED"), the Day Pass Bundle is a flat red
rectangle, crops are inconsistent. At 72px they are far less prominent, but
replacing them is a content decision, not a code one. `ProductThumb` already
falls back to a per-booking-type glyph, so dropping an image is enough to get a
clean icon.

---

## Design pass (2026-09-01) — seed photography, the sessions panel, hero clipping

Branch `design/seed-photography-and-dashboard`. Owner reviewed the findings and
chose the scope on the photography before any of it was touched.

### 1. The seed photography showed the wrong place ✅

Bigger than the last session's note recorded. Of seventeen images, **twelve were
the wrong subject** and two carried a visible CC watermark — the museum ran on a
photograph of a Californian adobe fort, the "Old Dhaka" walking tour on a German
half-timbered street, the spa on a hotel swimming pool, yoga on a single wild
flower. The watermarked shirt ("JAMIE SWEED") and the red-bordered cabinet were
also **demo-business cards on the landing page**, so the front door showed the
wrong continent before anyone clicked anything.

A photograph of the wrong place is worse than none: it reads as carelessness
about the operator's actual venue. The seed already proved the alternative —
`prd_donation` has no image, and its fallback glyph was the calmest cell on the
till.

- Twelve images deleted; those products carry `images: []` and take the
  per-booking-type glyph. **Kept the five that are what they claim:** bowling,
  cricket, planetarium, tour, winter.
- **The landing needed code, not just deletion** — its demo cards used a bare
  `<img>` with no fallback, so deletion alone would have left five broken
  images. Each demo now carries its own glyph (Landmark · Trophy · Disc3 ·
  Flower2 · Clapperboard) on a warm ground. **All five get the same treatment**
  rather than one surviving photo plus four placeholders: a wall only reads as a
  wall if every card is built the same way.
- Fixed a dark-mode defect the change exposed: `--color-subtle` and
  `--color-card` are **the same value in dark**, so the fallback tile had no
  edge and the glyph floated on the row. It now carries a 1px line (dark
  elevation = surface step + line, per Delta D) and sits at `muted` — `faint`
  was unreadable against it.

**Still open:** whether to commission real photography of actual venues. Five
products keep a photo; the rest are glyphs. That reads as deliberate, so there
is no rush.

### 2. "Today's sessions" was listing capacity, not sessions ✅

The panel enumerated every schedulable slot × every resource and then took the
nine **earliest**. Because the turf runs hourly across two products on two
fields, the manager's cockpit opened on eight empty turf hours — `12:00 Cricket ·
Field 1`, `12:00 Cricket · Field 2`, `12:00 Football · Field 1` — each offering
to **Cancel** bookings that did not exist, with the one session carrying real
numbers pushed to row five.

The fix is a distinction, not a cleverer sort. **A scheduled session and an
unbooked resource hour are not the same kind of thing.** A planetarium show at
0/40 runs whether or not anyone bought a seat, so it is always the manager's
business. A free turf hour is not a session at all; it is capacity nobody has
taken, and there is one of it per field per hour.

- Scheduled (slot-based) sessions always appear; a resource hour appears once
  somebody has booked it.
- The free hours are **collapsed into one honest line**, not silently dropped —
  "16 more · 34 unbooked hours today · View in Calendar".
- Out-of-service resources are left out entirely: **Needs attention already
  names them once**, rather than once an hour.
- **Cancel** now appears only on scheduled sessions, where closing the session
  is a real action. A booked resource hour is released through its booking, so
  offering Cancel there offered something the button could not do.

### 3. The hero was cutting the numbers it exists to show ✅

Revenue and Booked-ahead are `nowrap` at `text-3xl` in a two-column grid. On a
phone the card is narrower than the number, so **"৳41,653.00" rendered as
"৳41,653"** and "৳53,411.75" spilled past the card edge — measured clipping at
320, 360, 390, 414 and 420px, and again in the **1024–1279 band** where
`lg:grid-cols-4` made four columns before there was room for them.

The page never scrolled sideways, so the overflow rule held and this went
unnoticed for three sessions. It is the worse failure: a truncated figure is not
a cramped layout, it is **a different number**, shown with no sign anything is
missing. An ellipsis at least admits it.

- Hero collapses to one column below 420px rather than shrinking the type;
  four columns from `xl`, not `lg`; `text-2xl` small / `text-3xl` from `sm`.
- Trade-off accepted: the tiles stack on a phone, so the sessions list starts
  lower. Legible numbers beat a compact band that lies about them.

### Verification (this session)

Everything below was **measured in a real browser**, not inferred — a headless
Chromium harness in the scratchpad, not the repo.

- **Zero page x-scroll**: 10 routes × light/dark × 320/390/1440 = 60 loads, no
  console errors.
- **Silent-clipping detector**: every `nowrap` element checked for
  `scrollWidth > clientWidth` *without* an ellipsis (a deliberate ellipsis is
  not a defect), across ten widths 320→1440. Clean — and the same check
  correctly reports the clipping on the parent commit, so it is not
  vacuously green.
- `tsc --noEmit` clean · `npm run build` clean · no new lint findings (the 5
  `react-hooks/exhaustive-deps` warnings on the dashboard are pre-existing;
  confirmed against a stash).
- **i18n parity**: 29 namespaces, **0 keys missing in bn, 0 extra**. Four new
  dashboard keys authored in both.

### What this session did NOT do

- **Did not re-anchor the demo clock.** `DEMO_TODAY` stays 2026-07-29; still the
  owner's call (it would touch the hand-authored proofs the acceptance walks
  cite by literal date).
- **Did not start i18n Batch 2.** Findings recorded below so the next session
  starts from measurement rather than a survey.

### i18n Batch 2 — measured, so the scope is known

Key parity is perfect, which hides the real gap: **the keys were never wired
up**. Four namespaces are empty `{}` files — `products`, `auth`, `errors`,
`resources`. Rendered Bangla by route:

| Route | Bangla |
|---|---|
| Landing (`app/page.tsx`) | **0%** |
| Sign-in | **0%** |
| Products list | 20% |
| POS | 23% |
| Calendar | 25% |
| Orders | 65% |

The products list is the clearest case: fully-Bangla sidebar, entirely English
body — title, filters, every column header. A bilingual mongrel reads worse than
either language alone.

Separately and deeper than missing keys: **all date formatting is hardcoded
`en-GB`** — 10 sites including shared `lib/format.ts` — so dates stay English
even on screens that are otherwise fully translated. Fixing `format.ts` to take
the active locale is the highest-value single change in the batch.

Untranslated files: all 7 auth pages · the 13-file products editor · the landing
· `settings/layout` + `settings/page` · Go `login` / `pos/payment` / `Keypad` ·
`OrderLinesDetail`. (The calendar grids take their strings as props from a
translated parent — they are fine.)

---

## Revenue chart (2026-09-01) — the Aura chart, on an honest axis

Owner asked for a proper chart on the dashboard, with the Lovable reference
(counterfoilos.lovable.app) and a screenshot of it as the visual target.

### The chart ✅

New **`AreaChart`** in `components/ui/charts.tsx`, not a fifth copy of
`LineChart`. What earns a separate component is the **axis**: a sparkline
answers "which way is it going", this answers "how much, and against what",
which needs gridlines and figures down the side. Shape follows the reference —
big figure with the delta beside it, range toggles top-right, filled ember area
over a neutral comparison line, dashed gridlines, legend underneath, hover
guide + tooltip.

- **Draws at measured 1:1 width** (`ResizeObserver`) instead of scaling a fixed
  `viewBox`. The other charts here scale their text along with the drawing, so a
  10px label renders at 5px on a phone.
- **The svg is absolutely positioned inside a fixed-height box** so it
  contributes nothing to min-content. Measuring a container the drawing can
  itself widen is a feedback loop — any ancestor with the default
  `min-width:auto` lets the chart set the column width, which sets the chart
  width. It latched at 841px inside a 320px viewport before this.
- `formatMoneyCompact` in `lib/format.ts` — "৳45k", not "৳45,000.00" five times
  up the side.
- `ChartPoint` gains `title` (tooltip) beside `label` (axis tick), so the axis
  can stay terse while the tooltip is unambiguous.

### Where the reference could not be copied, and why

**Ranges are 7D · 14D · 30D, not 1M/3M/6M/1Y.** Measured, not assumed: the seed
holds **151 orders across 31 days** (2026-06-29 → 07-29) because
`generate.ts` caps the order offset at 29. A 1Y range would draw a flat line
through ten months that never had a sale.

**The comparison series is drawn only when the ledger covers the window behind
it.** Comparing 30 days to the 30 before them needs *sixty* days of history;
with thirty, the previous window is empty but for its last day or two — which
does not read as growth, it read as **+15663%**. So 7D and 14D compare (−13%,
+2%); 30D says "Last 30 days" and omits both the phantom line and the
meaningless delta. Real order history switches it on by itself, with no code
change.

Both limits are the demo clock and the 30-day seed showing through. **If the
owner wants the reference's 12-month chart, the seed has to carry 12 months of
orders** — which would move today's revenue, reports, top products and customer
stats, so it is a seed decision, not a chart one.

### A latent layout bug the chart surfaced ✅

The dashboard's grid columns had the default `min-width:auto`, so they sized to
their content: at a **320px viewport the left column was 875px** and
`main.scrollWidth` was **891**, with everything past 320 silently swallowed by
`overflow-x-hidden` on `main`. The page never scrolled sideways, so rule 5 held
and nobody saw it — the F12 sweep checks `scrollWidth ≤ innerWidth` on the
document, which this passes while hiding 571px.

- `min-w-0` on both dashboard columns (the mechanism this codebase already
  uses) → `main.scrollWidth` is now **exactly 320**. No hidden overflow.
- That exposed rows built from too many fixed-width children: once the column
  really was 288px, the **session name and the activity product collapsed to
  zero width** — a session row without the session. Both rows now wrap, with a
  floor on the name; the payment-mix label truncates so its money stays whole.

**Worth stealing for other screens:** `main`'s `overflow-x-hidden` means the
document-level x-scroll check cannot see this class of bug. Comparing
`main.scrollWidth` against the viewport finds it. Other routes have not been
audited this way.

### Verification

- Each range checked for series count, delta and subtitle: 7D → 3 paths /
  ▼13% / "vs. previous 7 days"; 14D → 3 paths / ▲2%; 30D → 2 paths / no delta /
  "Last 30 days".
- Tooltip reads **17 Jul · ৳68,261.25**, matching that day in the ledger
  (6826125 minor units) — the chart's peak.
- **Silent-clipping detector** (nowrap elements cut without an ellipsis) clean
  at ten widths 320→1440.
- Overflow sweep: 10 routes × light/dark × 320/390/1440, no page x-scroll, no
  console errors. `tsc` and `npm run build` clean.
- No new lint findings — the `react-hooks/immutability` error in `DonutChart`
  and the dashboard `exhaustive-deps` warnings are pre-existing (confirmed
  against a stash).
- i18n parity **0 missing / 0 extra**, six new keys in en and bn, no
  missing-message warnings in either locale.

---

## Live activity (2026-09-02) — the feed becomes a feed

Branch `design/seed-photography-and-dashboard`. Owner supplied a reference
screenshot of an Activity card carrying four event kinds (paid · new customer ·
draft saved · refund issued) and a Filter control, and asked for the dashboard's
card to match it.

### The card ✅

The panel was a second, smaller Orders table: six rows, every one an order,
labelled only `Sale` or `Refund`. What a manager wants from it is *"what has
happened here lately"*, and a customer record appearing is one of those things.

- **Orders and customers merge into one time-ordered stream.** Each row carries
  its own `kind` (`paid · sale · refund · customer`); the badge, its colour and
  the filter all read off that field, so none of them infers a category from
  rendered text.
- **Four distinct glyphs, and colour is never the only carrier**: CircleCheck /
  success for paid, RotateCcw / danger for a refund, Receipt / muted for a sale
  that has not completed, UserRoundPlus / ember for a new customer. The title
  states the event in words regardless.
- **Titles follow the reference**: `CF-2026-001053 paid`, `Refund issued`,
  `New customer added`; subject and money share the subtitle.
- **A partial refund shows what went back**, summed from the lines — reading
  `o.total` there overstates it, often by an order of magnitude.
- **Filter** = All · Sales · Refunds · Customers, a **native select** rather
  than a bespoke popover: one control, it names the active filter instead of
  hiding it behind the word "Filter", and it arrives keyboard- and
  screen-reader-correct on touch with no focus-trap code. It carries `bg-card`
  because the dropdown list inherits the control's background — transparent
  renders dark-on-dark in dark mode.
- **"View all activity" follows the filter** (`/customers` when the rows are
  customer events, else `/orders`). The old comment promised the button went
  where the rows came from; with a filter that promise needed keeping.
- Merge tombstones and erased records are skipped: one is a pointer at the
  survivor, the other has no identity left to name. Both stay in the ledger;
  neither is an event.

**"Draft saved" was not built.** `OrderStatus` is
`paid | pending | partial | refunded | partly_refunded | cancelled` — there is
no draft in the model, and the nearest real things are a pending order or a
hold. Owner chose to skip it rather than invent a state the rest of the app
cannot back up.

### Two defects found on the way, both pre-existing hazards

**1. The seed made "customer added" unreachable.** Every customer was stamped
`NOW - 200 * DAY` — one identical timestamp for the whole roster — so a
customer event could never place in a feed of the six most recent things, and
the new row type would have been invisible. The roster is now staggered: the
newest four are 12 min / 1.6 hr / 6.3 hr / 1.25 d old, the rest keep a
long backdate a day apart so "newest first" is a real ordering rather than a
21-way tie.

Two constraints shaped the fix. The offsets are computed **from `idx`, never
from `rand()`** — the seeded PRNG is consumed in strict sequence by everything
below, and drawing from it there would shift every order, price and booking in
the fixture. And the order/customer attachment now filters to customers who
**already existed** at the order's `createdAt`, or the newest records would
appear on sales predating them by weeks; `pick()` draws exactly one `rand()`
whatever the array length, so narrowing it moves *which* customer lands on an
order and nothing else.

Verified rather than asserted: an order/booking fingerprint (id · status ·
total · tax · createdAt · line composition, and every booking's slot/party/
resource) computed against the parent commit is **identical** — 151 orders,
৳698,370.75, 305 tickets, 33 bookings, the same status distribution and the
same 95 named orders. Only the customer-assignment hash and the customer
`createdAt` values move, which is exactly the intended change.

**2. Timestamps are not spelled the same way across the seed, so the feed sorted
wrong.** Generated records are `.toISOString()` (`…T05:05:00.000Z`);
hand-authored ones carry a local offset (`cus_stress` is
`…T11:05:00+06:00`). The old `b.createdAt.localeCompare(a.createdAt)` only ever
ordered orders among themselves, all in one format, so it held. Merging two
sources put a 12-minute-old event **below** a 55-minute-old one — caught in the
browser, not by reading the code. The feed now sorts on
`Date.parse(b.at) - Date.parse(a.at)`.

**Worth remembering:** any other screen sorting mixed-source ISO strings
lexicographically has the same latent bug. Not audited this session.

### Verification

Driven in headless Chromium (harness in the scratchpad, not the repo) —
**41 checks, all passing**:

- Feed ordering is monotonic newest-first under **all four filters**, and each
  filter admits only its own kinds (refunds → only `rotate-ccw` badges,
  customers → only `user-round-plus`, sales → neither).
- "View all activity" lands on `/customers` from the customers filter.
- **Bangla**: heading, all four filter options and row titles render translated
  ("নতুন গ্রাহক যোগ হয়েছে", "CF-2026-001075 বাতিল"); no missing-message warnings.
- **Dark**: theme applied, badge colours resolve to the dark tokens, the filter
  select has an opaque background.
- **320 · 360 · 390 · 420 · 768 · 1024 · 1280px**: no page x-scroll, no hidden
  overflow inside `main` (the check that catches what `overflow-x-hidden`
  swallows), and the silent-clipping detector clean. No console errors at any
  width, locale or theme.
- `tsc --noEmit` clean · `npm run build` clean · lint back to the **5
  pre-existing** `exhaustive-deps` warnings (the new `customers` list is
  memoised, so it adds none).
- i18n parity: 14 keys added in **both** en and bn; the now-orphaned `refund`
  and `sale` keys removed from both. **0 missing, 0 extra.**

### Not done

- **Rows are not clickable.** The model knows each event's record, but the
  reference draws static rows and the card's rows were never interactive;
  linking them is a separate decision about hit targets.
- The demo clock is still `2026-07-29`, so "185 d ago" appears at the bottom of
  the Customers filter once the five recent additions run out. Honest, and the
  seed re-anchoring remains the owner's call.

---

## Dashboard layout (2026-09-02) — organised to the Aura reference's skeleton

Owner asked for the dashboard's sections and cards to be organised like
counterfoilos.lovable.app, researched properly rather than eyeballed. The
reference was rendered in a headless browser and **measured**, and those numbers
became the acceptance criteria.

### What the reference actually does (measured at 1440)

Content column 1120 inside 32px page padding. **Two grids:** four 262px stat
tiles at **24px** gap, and a body grid of **three 352px columns at 32px** gap
with the main content spanning two and the rail spanning one. Cards are radius
12, `rgba(255,255,255,.72)`, a 1px hairline, **no shadow** — which the Aura run
had already matched exactly. Section titles are **16px/600 at -0.4px**, each
with exactly **one** right-hand affordance: a scope chip (`Today`,
`This month`), a count badge (`4`), or an action (`Filter`, `View all`).

Order down the page: stat tiles → chart (2) + Notices (1) → ops strip (2) +
Activity (1, tall) → a ranked list (2) → **one full-width table**. Its two
columns finish level.

### The gap was organisation, not styling

| | Reference | Was | Now |
|---|---|---|---|
| Stat-tile gap | 24px | **8px** | 24px |
| Body / stack gap | 32px | **8px** | 32px |
| Right rail | 2 cards | **5 cards** | 2 cards |
| Full-width closer | 1 | **0** | 1 |
| Section titles | 16/600/-0.4 | 15/600/-0.16 | 16/600/-0.4 |
| Column height delta | 0 | — | 22px |

- **The 8px gutters were the whole problem.** Everything was crammed into one
  undifferentiated stack, so nothing read as a region. Added
  `--spacing-wide: 32px` — 24 is the inside of a group, 32 is between groups,
  and it is the step between them that makes regions legible.
- **The rail had become a dumping ground**: Needs attention, Idle capacity,
  Open shifts, Payment mix and Top products stacked in 379px, all the same
  size, so nothing in it read as important. It is now the reference's two
  panels — what needs a decision, and what just happened.
- **Top products** moved to the wide column (the reference's "Top verticals"
  slot). **Live activity** moved from the bottom of the left column to the tall
  rail slot, and its feed went 6 → 8 rows, which is what closes the columns to
  within 22px.
- **Today's sessions** became the full-width closer. It is the widest thing on
  the page and was being squeezed into two thirds of it.
- **Operations at a glance** is new only as a container: Open shifts, Payment
  mix and Idle capacity keep every number they had, laid side by side in the
  wide column instead of stacked down the narrow one. **Nothing was dropped to
  free the rail.**

### Three defects the metrics could not see

The conformance harness passed 22/22 while the page still had visible faults —
they were found by rendering it and looking.

1. **Equal thirds truncated the idle rows to `17:00 Gra…`.** Products here are
   called things like "Grand Heritage Architectural Walking Tour of Old Dhaka".
   The strip is now weighted `0.85fr / 1fr / 1.35fr` — prose gets the room prose
   needs.
2. **`৳32,400.00 unsold` on all four idle rows** spent a third of the column
   repeating a word the panel label already says. The figure alone reads the
   same; the full phrasing moved to `aria-label`, where it is not redundant.
3. **The activity filter painted a white box on the card.** `card-surface` is
   white at **72%**, so an opaque `bg-card` control did not disappear into it —
   but a transparent one drops the option popup to dark-on-dark. Fixed by
   painting the **options** rather than the control. A check now asserts that no
   borderless control's background differs from its card's.

### Verification

Two headless-Chromium harnesses, **23 + 41 checks, all passing**: grid gaps and
column counts against the reference's measured values, rail card count, one
full-width closer, every card radius 12, every `<h2>` 16px/600, column balance
within 180px, cards carry a transition, no control paints a box, and — at
**320 · 390 · 768 · 1024 · 1280 · 1440**, light and dark, en and bn — no page
x-scroll, no hidden overflow inside `main`, no silently clipped text and no
console errors. `tsc` and `npm run build` clean; lint holds at the 5 pre-existing
`exhaustive-deps` warnings. i18n parity across all **29** namespaces: 0 missing,
0 extra.

### Deliberately not copied

The reference's stat tiles are Total revenue · Counterfoils issued · Active
customers · AOV. Counterfoil's stay **Revenue · Capacity sold · Arrived ·
Booked ahead**, because nothing is sold from OS and capacity is the distinctive
angle — the organisation was the ask, not the content. Its 1M/3M/6M/1Y ranges
still cannot be copied either: the seed holds 31 days.

**Note for the next session:** `npx prettier` was run once on the dashboard and
reformatted the whole file (1093 insertions against a ~340-line change). There
is **no prettier config in this repo** — do not run it.

---

## Typography (2026-09-03) — Inter, and one type system

Owner supplied a type spec: Inter throughout, with a role table (page title
28/600 · section title 18–20/600 · card title 14–16/600 · body 14/400 · body
emphasis 14/500 · navigation 14/500 · caption 12/400–500 · dashboard metric
28–32/600 · table text 13–14/400–500 · button 13–14/500). Applied to the
dashboard, with the face swapped globally.

### Inter replaces Manrope

`layout.tsx` now loads Inter as `--font-inter`; `--font-sans` points at it with
Hind Siliguri still behind for Bengali codepoints. **Tabular figures are on
globally** (`font-variant-numeric: tabular-nums` on body): Inter's default
figures are proportional, so a column of money re-flows as its digits change
and a `1` leaves a gap the eye reads as misalignment. Every screen here is money
and counts in columns, so lining figures are the default rather than an opt-in —
which also let 20 scattered `tabular-nums` utilities come out of the dashboard.

`type-h1` dropped 700 → **600**: the spec sets every heading role at semibold,
and a bold page title above semibold card titles read as two systems.

### DM Mono is now only for identifiers

The spec has **no mono row**, and it names Inter for Table text and Caption —
which is what the times, counts, money and relative timestamps are. So
`font-mono` came off 20 of the dashboard's 21 uses. The one kept is the bare
order id in an expanded session row.

That line is the project's own: `layout.tsx` has always said DM Mono is for
"booking refs, status codes, IDs". Money and clock times are neither. The
headline metrics were the clearest case — `৳41,653.00` was **DM Mono 400**,
against a spec that asks for 600.

**Note:** other screens still use DM Mono for money and times. Only the
dashboard was swept, since that was the scope. The app is now inconsistent
between the dashboard and everywhere else until the same sweep runs elsewhere.

### What moved

| Role | Was | Now |
|---|---|---|
| Page title | 24px/700 Manrope | **28px/600** |
| Dashboard metric | 24–30px/**400 DM Mono** | **28–32px/600 Inter** |
| Field labels (`type-label`) | 11px | **12px** (the caption floor) |
| Notice rows | 13px/400 | **14px/400** (Body) |
| Row actions (Adjust/Cancel) | 12px/400 | **13px/500** (Button) |
| Chart ranges (7D/14D/30D) | 11px/400 mono | **13px/500** |
| Session-list footer | 12px/400 | **13px/500** |
| Scope toggle | 500 active / **400 inactive** | 500 both — the ink pill carries selection, not the weight |

### Roles are declared, not guessed

The audit spent four iterations misclassifying two elements: a notice is a whole
sentence inside a tinted clickable box (Body, not Button), and the session-list
footer is a control however long its summary line runs (Button, not Body). Every
heuristic that fixed one broke the other.

The fix was to stop inferring: those two carry **`data-type-role`**, and the
audit prefers a declared role over its own guess. Worth copying — DOM shape
genuinely cannot distinguish some roles, and guessing harder is not the answer.

### Two deliberate deviations

- **The mobile tab bar stays at 11px**, against Navigation's 14px. Five tabs
  across 390px is a tab-bar convention, not the sidebar's role; 14px would not
  fit. The audit now only measures elements visible at the viewport under test,
  so the hidden desktop copy no longer reports.
- **Section title (18–20px) is unused on the dashboard.** The page has a page
  title and card titles and no level between them. It applies wherever a screen
  grows real section headings.

### Verification

Three harnesses, **10 + 23 + 41 checks, all passing**: every role on spec by
family, size and weight; the layout conformance from the previous session
unchanged; feed behaviour unchanged. `tsc` and build clean, lint holds at the 5
pre-existing warnings, i18n parity clean across 29 namespaces.

The metrics grew from 24/30px mono to 28/32px Inter, which is exactly what
caused the hero-clipping defect two sessions ago — the silent-clipping detector
is clean at 320 · 360 · 390 · 420 · 768 · 1024 · 1280 · 1440.

### Pre-existing overflow found, NOT introduced here

A sweep of 13 routes × 390/1440 found **hidden overflow inside `main`** on four
routes. Measured against production (the previous commit, still on Manrope) to
attribute it: **the same four routes overflow before and after.** Inter being
marginally wider made three slightly worse.

| Route | Before | After |
|---|---|---|
| `/` (390 and 1440) | 160px | 160px |
| `/customers` (390) | 76px | **90px** |
| `/memberships` (390) | 62px | **68px** |
| `/reports/sales` (390) | 16px | **18px** |

This is the class of bug the revenue-chart session flagged and never audited:
`main` carries `overflow-x-hidden`, so the document-level x-scroll check passes
while content is silently swallowed. **The dashboard is clean at every width.**
Fixing the other four is a separate piece of work on unrelated screens.

---

## Notices (2026-09-03) — the rail items get the reference's anatomy

Owner supplied a screenshot of the Aura reference's Notices card and asked for
that treatment. The previous session had matched the card's frame but not its
items, and said so in a code comment: *"the reference also carries a bold title,
a description and a timestamp per notice; these items have none of those — one
sentence and a link is the whole record."* That was true of the **shape the
items were built in**, not of the data behind them. So the items were rebuilt.

### The item model

`{ text, href?, tone }` became:

```ts
type Notice = {
  tone: "warning" | "info";
  Icon: LucideIcon;
  title: string;
  body: string;
  at?: string;                              // only where a real moment exists
  action?: { label: string; href: string };
};
```

Every one of the seven rules now supplies a title, a description and a named
action. Nothing was invented to fill the shape:

| Rule | Title | Body | Timestamp |
|---|---|---|---|
| Cash variance | Cash short at close | the existing sentence | shift close, yesterday 22:00 |
| Resource out of service | *{name}* is out of service | **the recorded reason** | `resource.updatedAt` |
| No sessions after a date | Bookings will stop | the existing sentence | — |
| Sales window ends | Sales window ends | the existing sentence | — |
| Waitlist | Waitlist waiting | the existing sentence | — |
| Arrivals owing | Balance due on arrival | the existing sentence | — |
| Device unseen | Device has gone quiet | the existing sentence | `device.lastSeenAt` |

- **`at` is set only where the record carries a real moment.** A device's last
  contact and a resource's last edit are events. A waitlist depth and an unpaid
  balance are live derivations, so they get **no timestamp rather than a
  fabricated one** — which is the same rule the previous session applied, just
  applied per-field instead of to the whole card.
- **The out-of-service reason became the description**, which is what it always
  was — it had been concatenated into one sentence with the name. Where no
  reason was recorded the body says so; an empty line reads as a rendering
  fault. `resourceOutOfService` / `resourceOutOfServiceReason` are gone.
- **The glyph is now picked per RULE, not per tone** — Banknote, Wrench,
  CalendarOff, Clock, Users, Receipt, WifiOff. A cash variance, a dead device
  and a closing sales window are different kinds of problem, and the icon says
  which before anyone reads a word. Tone still comes off severity, so the
  existing "never guess tone from the wording" rule is intact.
- **Action links are neutral**, as the reference draws them: the tint and the
  border already carry severity, and amber-on-amber is both a second shout and
  the weaker contrast of the two.

### `relTime` is now shared

The feed's local "12 min ago" helper is hoisted to a `useCallback` the rail uses
too, so one notion of *ago* governs the page. It parses the instant rather than
comparing strings — the seed spells timestamps two ways (see the 2026-09-02
entry).

### Column balance had to be re-derived

Giving each notice a title, a description and an action grew that card from
**331px to 546px**, which pushed the two columns from Δ22px to **Δ180px** — the
conformance check passed at its 180px tolerance while the left column visibly
ended a screenful early. The feed gives the same back: **8 rows → 6**, Δ**33px**.

The tolerance is now **80px**, so the next drift of this kind fails instead of
scraping through. The feed's row count exists to balance the rail — the comment
on `.slice(0, 6)` says so, and says to re-measure if either card's anatomy
changes again.

### Not done

**No "View all" in the header.** The reference has one; Counterfoil has no
notices index, and these items are derived live from six different sources
(shifts, resources, products, waitlist, bookings, devices). A button to a page
that does not exist is worse than none — the same rule the activity card's
footer follows. Each notice carries its own action to the page that can fix it,
which is the better affordance anyway.

**No success-tone notice.** The reference has a green "Stripe connected". No
rule here produces a positive event, and inventing one to fill the palette
would be decoration.

### Verification

Three harnesses, **10 + 23 + 41 checks, all passing**, plus `tsc`, build, lint
back at the 5 pre-existing warnings (two dead glyph imports removed), and i18n
parity clean across 29 namespaces — 14 new keys authored in en and bn, 2
orphans dropped.

---

## Revenue chart (2026-09-03) — brought onto the dashboard's own theme

Owner screenshotted the Revenue trend card and asked for it to sit with the
theme the Activity and Notices cards now set. Measured rather than eyeballed:
the card was the last one still on the pre-Inter, pre-16px-title conventions.

### What was actually wrong

- **The axis was DM Mono at 10px.** Two problems in one: below the type spec's
  12px caption floor, and mono after the dashboard was swept to Inter. The
  visible symptom was the **৳ sign rendering badly** — the Bengali taka sign is
  not in the UI face, so it falls through per-glyph to Hind Siliguri, and at
  10px the substituted glyph crowded the digits beside it. Now **Inter 12px**,
  with the gutters widened to match (`padL` 52 → 58, `padB` 26 → 28).
- **The card had no `<h2>` at all** — a 12px small-caps field label was standing
  in for a title, which left the widest card on the page as the only one
  without a title at reading size. Now a 16px/600 heading like every other
  card, with the range toggles as its single right-hand affordance: the same
  header pattern as Operations at a glance, Top products, Live activity and
  Notices.
- **The active range was solid ember with ink text**, which is this system's
  **primary-CTA treatment**. A range selector is not a call to action, and it
  was the loudest thing in a card whose entire point is the line underneath —
  competing with the ember the series itself is drawn in. It now selects with
  **ink**, exactly as the page header's scope toggle already does; same kind of
  control, same reading. In dark it inverts to a light chip.
- **The legend restated the card's own title.** One series, one swatch, reading
  "Revenue trend" directly under a card titled Revenue trend. A legend
  distinguishes series, so it now appears **only when a comparison is actually
  drawn** — which is 7D and 14D, never 30D (the seed holds 31 days, so the
  previous window is empty; see the 2026-09-01 entry). The series stays named
  for screen readers via the svg's `aria-label` either way.
- **The tooltip was mono at 10/11/10px.** Now Inter at 12/13/12.

### Verification

A new chart harness drives both states: at 30D no legend and the subtitle reads
"Last 30 days"; at 7D the comparison path is drawn, the legend returns and the
subtitle reads "vs. previous 7 days"; hovering produces a tooltip that is Inter
and at or above the 12px floor at every line. All pass.

Alongside it the three standing harnesses — type **10/10**, layout **23/23**
(columns Δ49px), behaviour **41/41** — plus `tsc` and build clean.

**Lint baseline unchanged and worth restating**: `charts.tsx` reports 1 error,
`react-hooks/immutability` on `DonutChart`'s `acc += frac` at line 345. Every
hunk in this change is inside `AreaChart` (lines 91–244), so it is the
pre-existing error the 2026-09-01 entry already recorded, not a new one.

### Still on the old conventions

`BarChart`, `LineChart`, `HBarChart` and `DonutChart` keep mono axis labels at
8–11px. They appear on Reports, not the dashboard, and were out of scope here —
the same boundary the Inter sweep drew. Bringing them across is the natural
companion to that follow-up.

---

## Page header (2026-09-03) — into the sticky bar, app-wide

Owner boxed the breadcrumb / title / date block and asked for it in the top nav
bar, researched properly. Measured the reference first.

### What the reference does

`counterfoilos.lovable.app` has a **sticky `<header>`, 65px**, `position:sticky
top:0 z:30`, background `rgba(243,241,236,0.7)` with
`backdrop-filter: saturate(1.8) blur(14px)` and a 1px bottom border. Inside it,
**left**: `<h1>` 15px/600 with a 12px/400 subtitle stacked under it. **Right**:
search + ⌘K, two 40px icon buttons, a primary action, a 40px avatar. One bar —
not a bar above a header.

### What Counterfoil had

A 56px glass pane whose **left 737px were empty** (`ml-auto` pushed every
control right), and a separate page header below it. First card at **183px**.

### The move

The header now portals into the bar. `#os-page-header` takes the breadcrumb,
title and description; `#os-page-actions` takes the page's action slot.

- **A portal, not props or context.** `PageShell` is rendered by ~30 route
  files inside `{children}`, so threading title/description/actions up would
  mean touching every one of them. Context was the other option and is worse
  here: `actions` is a ReactNode whose identity changes every render, so a
  context setter would setState in a loop. A portal has neither problem and
  `PageShell` stays the single owner of what a page header is.
- **The actions get their own slot** rather than sitting beside the title.
  Measured: on one row the title needs ~400px and the controls ~846px inside a
  1152px pane, so they do not fit; and putting the actions beside the title
  squeezed it to 275px and **wrapped "Lalbagh Heritage Attractions" onto two
  lines**, which is what made the first attempt 144px tall. The controls now
  stack in two right-aligned rows — chrome above, page actions below — and the
  title keeps one line.

**Result: bar 121px, first card at 145px** (was 56px + separate header =
183px). Verified sticky: after scrolling 900px the bar is at `top:0` and the
title is still on screen.

### Two bugs found on the way

1. **The actions vanished on mobile.** The desktop bar is `display:none` below
   md but still **in the DOM**, so `getElementById` resolved and the portal
   dropped the controls into a hidden container. Worse, the hidden copy was
   *first in document order*, so anything selecting "the location select" got
   the invisible one — it broke a harness selector, which is how it surfaced.
   The portal is now gated on the md media query, so exactly one copy exists at
   any width. Confirmed against production: mobile geometry is identical
   (`groupW 157 · btnH 39`), including the pre-existing "This week" wrap, which
   was **already there before this change** and is not new.
2. **Two `set-state-in-effect` lint errors, one of them mine.** `OsShell:79`
   is pre-existing (confirmed by stashing). `PageShell` was reading the media
   query and the slot elements with `useEffect` + `setState`. Both are external
   stores, so both now use **`useSyncExternalStore`** — the media query with a
   real subscription, the slots with a no-op one, since those nodes live as long
   as the shell and never change identity. PageShell lints clean; OsShell holds
   at its one pre-existing error.

### Verification

All 11 OS routes put **exactly one** `<h1>` in the bar (`/dashboard`,
`/calendar`, `/orders`, `/customers`, `/products`, `/promotions`, `/holds`,
`/memberships`, `/reports/sales`, `/settings`, `/settings/team`), bars 104–125px
depending on whether the page declares a description and actions. The four
standing harnesses are unchanged — type 10/10, layout 23/23, behaviour 41/41 —
and the 13-route × 390/1440 sweep reports the same four pre-existing `main`
overflows with identical numbers, so this did not touch them.

---

## Selection sheets (2026-09-03) — the nine patterns get the mockup's chrome

Owner asked for the selection-systems UI only, taking the treatment from the
standalone Figma Make POS build. Both were rendered at 430px and compared per
variant; the deltas below are the ones that survived that comparison.

### The date strip was wrapping and orphaning

Five 84px date cards plus the calendar button cannot fit 398px, so the strip
wrapped: a lone card on a second row with **"More dates" stranded beside it in
dead space**. It is on seven of the nine sheets — every date-driven pattern —
so it was the most-seen flaw in the sheet.

- The strip is now **one row that scrolls**, never a grid that wraps. A
  partially-visible fifth chip is also the affordance that says there is more.
- Cards went from three lines (DAY / 29 / Jul) to **two** (`Today` / `29 Jul`),
  which is the mockup's pill and roughly halves the width each one needs. The
  capacity line ("318 left") stays where a rule produces one.
- The strip gains a **`DATE` section label**, so it reads as a step rather than
  as loose chrome above the list.

### The check badge was writing over the cards' own text

`ChoiceCard` draws its selected check 8px in from the top-right at 16px square,
so it owns the corner out to 24px. Anything reaching in there is overwritten.
This was recorded once before as "TODAY" rendering as **"TODA✓"** and fixed on
that one card by hand; it came straight back the moment the card was resized.

A **measurement sweep** — open all nine sheets, select every selectable card in
turn, and compare the badge's rect against every leaf text node's — found it
live on five sheets: `Tomorrow`, `Lane 1`, `Lane 2`, `Lane 3` and
`Karim Hossain`. None of those were visible in the screenshot I had been
reading; two only appear once the card is chosen.

All six selectable cards in the sheet now keep **28px clear** on that side
(symmetric where the content is centred, right-only where it is left-aligned).
The sweep is a standing check — it reports zero across all nine.

### Session rows say what is being decided

`SessionList` already led with the time and drew a fill bar; what it put in the
corner was the **price, identical on every row**, with places-left beneath it in
muted grey.

- **Places left is now the corner figure** at 13px/500, ember at ≤20% — the
  app's existing low-availability language, not a traffic-light scheme.
- The bar gained **the count it is drawing** (`0/40`) beside it. A bar with no
  figure is a shape; a figure with no bar is a number. Both cost one line.
- **The price is stated once, under the list**, and on a row only where a
  pricing rule actually moves it — which is exactly the rule `SlotMatrix`
  already follows for its cells. New key `sheet.pricePerTicket`.

### Duration and lane rows

Duration chips read `formatDuration` ("1 hr 30 min"), so five of them wrapped.
They now use **`formatDurationShort`** — "1:30", the mockup's chip, and a helper
this repo already had — and all five fit one row. The lane row became a
scrolling row for the same reason the date strip did: Lane 4 was landing alone
on a second row, stretched full-width by `flex-1`.

### Verified

- **45 sheet-renders clean**: nine sheets × 320 / 390 / 430 light, 430 dark and
  390 Bangla — no page x-scroll, nothing clipped without an ellipsis, nothing
  under the 12px caption floor, no console errors. (The 5-tab mobile bar's 11px
  and the seat map are the two declared exceptions, as before.)
- **Badge-overlap sweep: zero** across all nine sheets, including cards that
  only collide once selected.
- Standing harnesses unchanged: sheet variants all on theme, type **10/10**,
  dashboard layout **23/23**.
- `tsc` and `npm run build` clean; `eslint` clean on both changed files.
- i18n parity **0 missing / 0 extra** — three new keys authored in en and bn.

**Note for the next session:** the dashboard harnesses in the scratchpad point
at **localhost:3111**. Run the dev server on that port or they report a dead
page as a wall of failures (Times New Roman, 500s) that look like regressions
and are not.

### Not changed

The start-time stepper still reads "—" until a time is picked. It looks like a
bug, it is not one, and it is now recorded twice — the P4 work chose it
deliberately and the mockup has no equivalent control to copy.

---

## Selection sheets (2026-09-03, second pass) — the nine reference screens

Owner supplied nine screenshots of the standalone build's sheets and asked for
those designs in the POS. The exact rules were read out of that build's source
rather than eyeballed from the images.

### Availability is now a pressure, stated four ways

`SessionList` said "N left" in muted grey for everything up to sold out. One
function, `pressureOf`, now classifies a session and the label AND the bar both
read from it — so they cannot disagree:

| Left | Label | Colour |
|---|---|---|
| 0 | Sold out | danger |
| ≤4 | N left | ember |
| ≤10, or ≤20% of capacity | N seats | warning |
| more | N seats | success |

Thresholds are **absolute, not percentage**: four seats left is four seats left
whether the room holds 15 or 400, and it is the count the counter decides on.
The 20% clause is kept so a small room still warns in time. Every tier states
itself **in words**, so this is not a traffic light — the colour is redundant
with the text, never carrying it.

A sold-out session that takes a waitlist now offers **"Join waitlist →" on its
own line**, where it reads as the offer it is, instead of sitting in the corner
where the seat count goes.

### Resource × time became two questions

The fields × times grid was the right shape for a wall planner and the wrong
one for a phone: two fields across a fourteen-hour day scrolled sideways to
reach the afternoon, taking the row labels with it. `SlotMatrix` now asks for
the **resource first** (chips carrying a free-slot count) and shows **that
resource's times** in a 4-across grid. Switching resource keeps a compatible
time. Nothing is hidden: an unavailable time still says so and still explains
itself when tapped.

The **selected time is the one fill** in the pattern. Everything else selects
as a tint, per the standing rule — but the time is the last decision and the
thing the CTA then names, so the reference draws it solid and so do we.

### Panels replacing footnotes

- **Daily capacity** (BT-06) gets a panel — label, remaining, a bar and the
  total — because a day-capped product is run by that one number and there is
  no slot list to read it off. The bar fills to show what is **left**, matching
  the figure beside it. The number came off the date chips entirely, where it
  had been appearing a third time.
- **A course** gets an affirmative "Ready to add" panel instead of a bare list
  of dates that looked like a choice still to be made.
- **Providers** are full-width rows: avatar, name, next free, and the rate on
  the right — `Standard rate` or `+৳500 premium` — instead of the premium
  concatenated into the role line where it read as part of the job title.
- **Guides** state `Available` / `Not free` on their own line.

### Two defects found by rendering it

**A Fri–Sun tour opened on a Wednesday.** The date strip lists only open days,
but `date` defaulted to today regardless — so the guided sheet opened with no
chip selected, no departures, and "Closed on this date" where the departure
list belongs. It now opens on the first day the product actually runs.

**"Add 2 seats — ৳0.00".** The seat CTA summed the tier steppers, which a seat
map never sets because the seat *is* the ticket. `submitSeats` had always
priced the sale correctly from the seat rows, so the button was the only thing
lying — and it lied about money, on the primary action. **Confirmed
pre-existing against production before fixing** (production shows the same
৳0.00); now ৳800.00 for two ৳400 stalls seats.

### Seat legend

Selected seats were a solid version of their own category colour, which differs
from that category's available tint only in saturation — the one comparison a
28px tile cannot carry. Selection is now **solid ember with white text**, and
the legend gained `Selected`. That first produced a real collision: the legend
drew category swatches solid, and Stalls is itself orange, so two identical
orange squares meant different things. Category swatches are now drawn the way
an available seat of that category is drawn — tinted, with its own border.

### Not built, and why

**No screening selector on the seat map.** The reference has one; `prd_film`
has no schedule at all — no `slotMinutes`, no times. Showtimes would have had
to be invented, so the sheet keeps section + seats.

### Verified

45 sheet-renders clean (nine sheets × 320/390/430 light, 430 dark, 390 Bangla):
no x-scroll, nothing clipped without an ellipsis, nothing under the 12px floor,
no console errors. Badge-overlap sweep zero. Sheet variants on theme, type
10/10, dashboard layout 23/23. `tsc`, `build` and `eslint` clean. i18n parity
0 missing / 0 extra, twenty new keys in en and bn.

---

## Designer branch merged to main (2026-09-05)

Ishmam's 39-commit design pass (`design/seed-photography-and-dashboard`, authored 2026-09-01→03)
was **fast-forwarded onto `main`** and CLI-deployed to production. It is a POS + dashboard pass
onto the Aura reference: the dashboard reorganised to the reference skeleton (stat-tile anatomy,
Notices card, activity as a feed not a second orders table, a real revenue chart, Inter and one
type system), the OS shell's page header moved into a sticky top bar, the sidebar's selected row
became a tonal fill, and the POS product sheet rebuilt across all nine selection patterns with
one shared selection footer, per-tile live state (`src/lib/posState.ts`), a three-row cart, and
phone density. Four seed photos that showed the wrong place were dropped. `en`/`bn` `pos.json`
and `dashboard.json` both extended. Verified before the merge: `tsc --noEmit` clean, `npm run
build` clean; verified after: production `/pos` serves strings that did not exist on the
previous build.

### Deploy topology — why the designer's work never reached the production URL

Two independent reasons, both worth remembering:

1. **The work was on a branch, not `main`.** Nothing on a side branch reaches production.
2. **This Vercel project is not connected to GitHub.** It has only ever been deployed by the
   Vercel CLI from the owner's machine (`.vercel/project.json` →
   `sajid209-stacks-projects/counterfoil-frontend`). A push by *anyone* — owner included —
   publishes nothing on its own.

`counterfoil-frontend-three.vercel.app` is **not in the owner's Vercel account** (confirmed
against `vercel project ls`). The designer connected the public GitHub repo to a Vercel project
on *their own* account; Vercel appended `-three` because `counterfoil-frontend.vercel.app` was
already taken by this account. That project is a live mirror of whatever branch the designer
pushes, and it will keep deploying independently of this one.

**Open for the owner:** connect this repo to Vercel in the dashboard (the standing
recommendation from Phase 6, still not done). Until then every contributor's work needs a
manual `vercel --prod` from this machine to go live, which is exactly the confusion that
happened here. Also still open: delete the junk project `resources`.

### Vercel is now connected to GitHub (2026-09-05)

`vercel git connect` linked `sajid209-stack/counterfoil-frontend` to the project. **Pushes to
`main` now build and publish to https://counterfoil-frontend.vercel.app automatically** — the
CLI-only deploy era is over, and `vercel --prod` from the owner's machine is no longer required
for work to go live.

**Working agreement (owner's call, 2026-09-05):** contributors push **straight to `main`**. This
is a shared work-in-progress site, not a customer-facing one, so the review gate of a PR flow
was deliberately traded away for speed. Consequence to keep in mind: a broken build or a
half-finished screen pushed to `main` is the live site within about a minute, and there is no
gate to catch it. Verify before pushing rather than after.

---

## The vocabulary rename (2026-09-05)

The operator's word for what they sell is a **booking**, not a product. Renaming it
collided head-on with `Booking`, which already meant the reservation on an order — the
record that holds capacity, appears on the Check-In roster and gets locked or moved. Both
things called "booking" would have made "cancel this booking" ambiguous **to operators**,
not just in code. The owner chose to rename both, so the vocabulary is now:

| Was | Is | What it is |
|---|---|---|
| Product | **Booking** | the catalogue item — the thing you sell |
| Booking | **Reservation** | one guest's claim on capacity, hanging off an order |

- **UI only. `types.ts` is untouched** — it is the contract handed to the backend lane and
  matches their OpenAPI, so `Product` and `Booking` keep their names in code. Anyone reading
  the code should know: **the operator's word for `Product` is "booking", and for `Booking`
  is "reservation".**
- **Both locales swept** (30 message files). Bangla: পণ্য → বুকিং, and বুকিং → রিজার্ভেশন.
  রিজার্ভেশন rather than সংরক্ষণ because সংরক্ষণ is already Holds.
- **ICU placeholders are code and were protected** — a first pass renamed `{product}` to
  `{booking}` inside message strings, which would have broken every call site that passes
  it. The sweep now transforms only the text between braces.
- **"Booking rules" kept its name** — those are rules for the act of booking, and they read
  correctly in either vocabulary.
- **Routes moved with the word**, because the breadcrumb is derived from the path and
  leaving `/products` would have half-done the job: `/products` → `/bookings`, with a
  redirect in `next.config.ts` so existing links land. The Go arrivals list at
  `(go)/bookings` — reservations, no inbound links — became `(go)/reservations`, which is
  both the collision fix and the right word.
- **Verified**: 18 routes fetched and stripped of markup contain zero occurrences of
  "product"; tsc and build clean; the old paths 307 to the new ones.

---

## Session 2026-09-05 — five pieces, deployed one at a time

Ordered by the owner. Each shipped and browser-verified before the next began.

### 1. Every time slot carries its own price
The slot matrix and the session list both printed a price only where it differed
from the commonest rate. In practice a cashier reading a slot to a customer had to
work out which line underneath applied to the tile in front of them. Every available
tile and every session row now states its own price; the line underneath keeps the
basis (per field, per slot / per ticket), which the tiles cannot say. Base-rate
prices are muted and uplifts stay in the brand colour, so a peak slot still reads as
the exception without hiding the rule.

### 2. A phone gets a calendar, not a letter box
The three grids had **zero responsive classes between them** — Week forced 832px and
Month 704px inside a 390px screen, and Day laid resources across a 1,292px track.
Each grid now has a compact branch chosen by the same `md` query the rest of the
shell uses (extracted to `lib/useMedia`, which `PageShell` now shares):
- **Day** turns its axis vertical and moves the lane name inside the block. Lanes
  that are out of service are named above the track, because "no bookings" and
  "closed all day" must never look the same.
- **Week** keeps seven columns and lets them shrink, two abreast rather than three.
- **Month** goes to dots and opens the chosen day as a list underneath — on a small
  screen the grid is for choosing a day and the agenda is for reading one.

Verified at 390px in a width-constrained iframe (the automation browser still ignores
window resize — `resize_window` reports success but `innerWidth` does not change).

### 3. The vocabulary rename
Recorded in full in its own section above. Product → Booking, Booking → Reservation,
UI only, both locales, routes moved with a redirect.

### 4. Categories become editable
Categories were a first-class entity with a create endpoint and **no screen** — the
four seeded groups were the only four an operator could ever file anything under.
`/settings/categories` adds rename-in-place, reorder (sortOrder IS the chip order at
the counter) and retire. No delete: a category with bookings cannot be removed
without orphaning them, which is why the entity has no delete endpoint either.

At the till the chip row now shows only groups that are switched on **and have
something in them**, built from the sellable catalogue rather than the filtered grid
so chips do not vanish from under the finger while typing. The seeded "Add-ons" chip
had nothing in it and filtered the grid to nothing.

### 5. Filters on both calendars
- **OS calendar**: selects for booking, category and resource, plus state toggles.
  The toggles ARE the colour key — a legend explaining five states and a filter
  acting on them are the same control, so the passive key at the bottom is gone.
  Counts are read from the set *before* the state filter, so a count does not fall
  to zero merely because it is switched off.
- **Go schedule**: the same language sized for a thumb — booking as a select, Open /
  Full / Out of service as 48px chips. Rows gained an explicit `kind`, since the
  label is a price or a count and cannot be filtered on.

### 6. Repeat weekly — "the next 7 Wednesdays at 6"
The commonest standing sale a turf or court takes, and it used to mean walking the
sheet seven times. The hard part is not generating dates: some will already be gone,
and a cashier has to be able to say WHICH before taking money. Every date is tested
against the same availability engine the grid uses; unavailable ones are listed with
their reason, struck through and skipped, and the CTA counts only what will sell —
*"Add 2 dates — ৳3,000.00 — skipping 1 already taken"*.

`lib/recurrence.ts` stays pure: it generates dates and asks a caller-supplied
question about each, because availability differs per booking type. Wired into the
two paths where repeating is honest — fixed resource slots and plain timed sessions.
Guided tours need their guide free on every date and a course already IS a series,
so neither is offered. Each date re-prices, since a band or day override can move the
rate at the same clock time.

**Verified end to end**: 7 Wednesdays sold as 7 lines in one order, after which the
slot reads booked and the field drops from 14 free to 12.

### 7. Book now
Most of what a counter sells has one sensible answer: the next departure, the first
free field, one adult ticket. Each row gains a Book now control that adds it straight
to the cart, says what it chose, and opens the cart on a phone. The rule that makes
it safe is where it does **not** appear: seat maps, therapists, guides, courses,
bundles, credits packs, sections and anything needing a waiver keep the sheet.
Bowling is excluded too — the flexible sheet's own "Start now" already is this.
The group-size default and the end-time helper are taken from the sheet rather than
reinvented, so the shortcut and the long way round cannot sell different things.

### Still open after this session
- **Repeat** is not offered on guided tours (needs a per-date guide check) or on the
  flexible-duration path.
- Two **pre-existing** `react-hooks/set-state-in-effect` errors in `(go)/pos/page.tsx`
  (the sessionStorage deep-link effect). Confirmed present before this session's
  changes; left alone rather than risk the deep-link behaviour.
- The seed clock is still frozen at `DEMO_TODAY = 2026-07-29` — the owner's call.
- Seat-mapped products still have no live tile state (needs async `availableSeats`).

### Owner review, same day — three corrections

- **Buy now moved to the sheet's CTA.** The first attempt put an express control
  on each grid row, which was a misread: a shortcut there can only sell the
  default, and the sale a cashier wants to settle immediately is the one they
  have just configured. The grid shortcut and `quickAdd.ts` were removed. The
  sheet footer now has two exits — **Add** builds a bigger sale, **Buy now**
  adds the line and opens the payment step. On a repeated series only the last
  date asks to pay. It opens the payment; it does not complete it: the tender
  pad and wallet flows read their amounts on the next render (by which time the
  line is in the cart), but a card terminal settles synchronously from a sale
  built at call time, so that one method gets the cart and its own Charge
  rather than a card charged for the wrong total.
- **Percentages became typable** (`components/ui/PercentInput`). The order
  discount was four buttons (0/5/10/15) so an agreed 12% was unenterable; the
  line discount was one button that CYCLED 0-5-10-15-0. Both now follow the
  rule the duration controls already had: **the field is the control and the
  chips FILL it**. Accepts `12`, `12%`, `7.5`. It does NOT clamp to the role's
  cap — the cart's existing over-limit notice names the cap and says to ask a
  manager, which is an answer; a number that changes itself is not. Audited the
  rest of the app: OS percent fields (deposit, cancellation fee) were already
  free-typed and the cash tender chips sit beside a keypad, so these two were
  the only preset-only value pickers left.
- **The customer moved into the cart.** It was a 12px chip sharing the header
  row with Close and Park, which read as chrome. It is now the first thing in
  the cart at full width, showing the attached person's phone under their name
  — two customers share a name far more often than a phone, so that line is
  what confirms the right record. `AttachedCustomer` gained `phone`/`email`.

---

## UI/UX audit across all 53 routes (2026-09-06)

Owner asked for every page reviewed and fixed until it reads as genuinely
usable. Measured rather than eyeballed: a harness renders all 53 static routes
at 390 and 1440 and asks the questions a user would notice, ranked by
consequence rather than tidiness.

- **A** — the screen lies, breaks or hides something. A clipped number is a
  *different* number; a raw message key is a broken promise.
- **B** — the screen is unusable for someone: too small to read, too small to
  tap, a control that cannot be named.

**1,354 findings → 24**, across four measure-fix-measure passes.

### The big one: 1,184 pieces of text below the 12px floor, on 49 routes

The owner's type spec sets Caption at 12px. Only the dashboard had ever been
swept to it. Three sizes were in use across 137 sites — 10px (28), 11px (104),
9px (5) — including money, times, table meta and every status pill.

This was a mechanism problem, not 49 screen problems: **125 sites bumped to
12px in one pass**, plus the four chart labels the log had already flagged as
the natural companion to the Inter sweep. Two declared exceptions survive and
are the only sub-12px text left in the app: the five-tab mobile bars (11px —
five tabs across 390px is a tab-bar convention, and 14px does not fit) and the
seat grids (9px on 28px tiles, a spatial diagram where each seat carries a
full title attribute).

### Content that was being silently swallowed

`main` carries `overflow-x-hidden`, so a document-level scroll check passes
while content is eaten. Five routes were losing content that way. Each had a
different mechanism:

| Route | Cause | Fix |
|---|---|---|
| `/holds` `/memberships` `/reports/sales` | the **tab strip** could not fit five tabs with counts at 390px | Tabs scrolls instead of overflowing; tabs no longer shrink or wrap |
| `/customers` | a long e-mail in a **DataTable card** refused to shrink | `min-w-0` + `break-words` on the label/value pair |
| `/reports/sales` | the wide table's `overflow-x-auto` container had the default `min-width:auto`, so it grew to the table instead of scrolling it | `min-w-0` on the scroller |
| `/` | a decorative blur, `aria-hidden` and `pointer-events-none`, clipped by design | **not a defect** — the check now ignores decoration |

A tab that has scrolled off is a tab nobody can reach, so this was the worst of
the set: on a phone, `/holds` simply had no way to reach "Became reservations".

Wide tables now also carry a **scroll affordance** (`.scroll-x-hint`) — cover
and shadow gradients painted by the scroller itself, so they appear only on the
side that still has content and vanish at each end. No JS, no scroll listener.
A container that just cuts its last column looks broken rather than scrollable.

### Controls sized for the hand that uses them

53 controls were under the 44px thumb floor. They now grow for touch and keep
their density from `md` up, which is the same responsive-by-form-factor rule
the nav already follows — filters, search fields, pagination, date chips, the
`Tabs` strip, `Button` size `sm`, and the Go header avatar.

Deliberately **not** padded out: inline links inside sentences ("Design tokens
→", "Forgot password?"), breadcrumb links, and desktop table sort headers. The
target-size guideline exempts inline links, and padding them would break the
prose they sit in. That is what the remaining 24 findings are.

### Controls that could not be named

26 selects and inputs had no accessible name — a screen reader announced "combo
box" and nothing else. Each filter is now named **by its own first option**,
which is the one label guaranteed to describe what it filters; date pickers and
the opening-cash field took explicit names, and `/shift/open`'s visible label
was **associated** rather than duplicated.

`/pos` and `/login` had no `h1` at all. Both now carry an `sr-only` heading —
the Go chrome names the screen visually, so this is for assistive tech.

The Go **rail became a `<nav>`** rather than an `<aside>`: it is the primary
navigation on a tablet in landscape, so it should be a landmark.

### A hydration mismatch, and a lint error that went with it

`/shift/close` warned on every load. `AppearancePicker` computed
`aria-pressed` from the stored theme, which the server cannot know — so for one
frame the picker showed the wrong button selected. Both it and `ModeButton` now
resolve "has the client taken over?" through **`useSyncExternalStore`**, the
shape `PageShell` already uses for its media query. That also cleared
`ModeButton`'s pre-existing `react-hooks/set-state-in-effect` error.

### Verified

Four full passes: **1354 → 197 → 86 → 56 → 35 → 24**. Zero findings remain in
severity A. The 24 in B are the declared inline-link exemptions above.

Standing harnesses all hold: sheet variants on theme, **45 sheet-renders clean**
across 320/390/430 light, 430 dark and 390 Bangla, badge-overlap zero, type
**10/10**, dashboard layout **23/23**. `tsc`, `npm run build` and `eslint`
clean. i18n parity **0 missing / 0 extra**, eight new keys authored in en and bn.

**Harness note for next time:** three checks needed narrowing before they were
worth trusting — `sr-only` text is *meant* to be clipped to 1×1, decoration
that is `aria-hidden` + `pointer-events-none` is *meant* to be clipped, and the
44px floor is a thumb rule that applies on phones, not to a desktop pointer or
to a link inside a sentence. An audit that cries wolf on its own conventions
gets ignored.

---

## POS audit — every selection system and popup, in its open state (2026-09-06)

The previous audit measured pages **at rest**, which never sees a sheet — and a
sheet is where nearly all of the till's work happens. This one drives all
twelve selection systems and the popups into their open state and measures them
there, at 320 / 390 / 1024, in light and dark.

**99 findings → 0.**

### Colour was the whole story: 82 of the 99

Two systemic misuses, not 82 separate mistakes.

**1. Brand orange as a letterform.** `text-ember` is brand-500 `#f94a00` —
**3.50:1** on white, below the 4.5:1 reading floor. It was carrying selected
chips, active tabs, prices and live tile state across 57 sites.

The codebase already had the answer: `--color-brand-foreground`, documented as
"brand-coloured **TEXT**" and set to brand-700. It is the only brand step that
clears AA everywhere it lands:

| | on white | on the ember wash | on subtle | dark card |
|---|---|---|---|---|
| brand-500 `#f94a00` | 3.50 | 3.07 | 2.96 | — |
| brand-600 `#d63d00` | 4.64 | **4.08** | **3.93** | — |
| **brand-700 `#aa3000`** | **6.71** | **5.90** | **5.68** | 8.33 (brand-300) |

brand-600 is closer to the reference orange and fails on the wash, so the token
the project already chose wins. `text-ember` stays correct as a **fill**; it
was never right as a letter.

**2. The disabled grey on live text.** `--color-faint` is documented
"disabled-fg" and measures **2.09:1**. It was on inactive tab labels, cart line
detail, empty-state messages, the shift timer, lane rates, the seat map's
SCREEN label and unavailable slot times. Those are all live: an unavailable
slot is still tappable — that is what `explainUnavailable` is for — so its
label has to be readable. 18 sites moved to `muted` (5.63:1); the strike-through
and the surface still say "not this one".

**3. White on ember, again.** 3.50:1 light and **2.59:1** dark, on seven sites
including the category chip, the payment segmented control and a slot tile I
added myself last session. Ink on ember is 5.27 / 7.11 and is the rule the
project already set for the primary CTA. All seven now follow it.

### Targets a thumb can actually hit

Go is a till: it is touch at **every** width, so the `md:` shrink that suits OS
was wrong here. The header avatar, cart lines (as short as 38px), payment
segments (48px track, 40px buttons — the button is what you press), the waiver
checkbox, and the dismiss glyphs on Modal, Toast and BlockedNotice (16–18px
with no padding) all now clear 44px.

### Named surfaces

The product sheet carried `role="dialog"` with no accessible name, so a screen
reader announced nine different selection systems identically. It now points at
the `<h2>` it already renders, so the dialog announces the booking it is selling.

### Three harness corrections worth keeping

The measurements were wrong before they were right, and each correction is a
rule about the design rather than about the code:

- **Disabled controls are exempt from the contrast floor** (WCAG 1.4.3). Greying
  out is how "not yet" is said; 18 findings were the check misreading the design.
- **A checkbox inside a clickable `<label>` is not the target** — the label is.
- **An absolutely-positioned fill is not in its label's ancestor chain**, so the
  payment control's selected label measured against the track behind the thumb
  rather than the thumb. Verified from the markup instead: ink on ember, 5.27:1
  light and 7.11:1 dark.

### Verified

**0 findings at 320 and 390, light and dark.** At 1024 the only two entries are
the cart and customer popups being unreachable — correct, because at tablet the
cart is a persistent panel rather than a drawer, so there is no "View cart" to
press.

Standing harnesses hold: 45 sheet-renders clean, badge-overlap zero, type
10/10, dashboard layout 23/23, all-routes audit down to its 21 documented
inline-link exemptions. `tsc` and `build` clean; `eslint` identical to clean
HEAD (the 2 errors and 3 warnings in `pos/page.tsx` are the pre-existing
deep-link effect, confirmed by stashing). i18n parity 0 missing / 0 extra.

---

## The ticket-tier rows, rebuilt to the reference (2026-09-06)

Owner supplied a screenshot of the General Admission sheet and asked for that
design. It is the **tiered rows**, which the open-entry, date-validity,
fixed-session, guided, daily-capacity and sectioned patterns all share — so
this is one change across six selection systems, not one screen.

### What the rows were

Four separate bordered cards, each with the name on one line and **price,
capacity and age note concatenated into a single grey run-on**:

> `৳1,400.00 · admits 4 · 2 adults + 2 children`

Three facts of three different kinds, in one colour, at one size, in one line —
so none of them read. The price in particular is the number a cashier says out
loud, and it was the least prominent thing in the row.

### What they are now

One panel of hairline-separated rows. Each row states the three things in the
order they are decided:

- **the name** — 14px/500
- **who it admits** — 12px muted, its own line, only when there is one
- **the price** — 13px/500 in the brand text colour, its own line

with the stepper on the right. Hairlines instead of four card borders also stop
the group reading as four unrelated objects.

Above it, a **`CHOOSE TICKETS` section label**, so the list is announced the way
`DATE` announces the date strip rather than starting unheaded.

### The summary became a receipt line

`1 Adult · 1 Child · ৳800.00` was a sentence with the money buried at the end of
it. It is now what-you-are-buying on the left and what-it-costs on the right,
over a hairline — the shape a receipt has and the one the eye already scans for.
Every pattern's summary gets this, so the time, the guide and the duration still
appear where they apply.

### Two fixes found on the way

- **`text-maint` — a class that does not exist.** My own sub-12px sweep two
  entries ago replaced the fragment `text-[12px] text-f` with `text-[12px]
  text-m`, which caught `text-faint` mid-word and produced a no-op class. The
  tier meta line had been rendering with no colour rule at all since then. Gone
  with the rewrite, and worth remembering: **never pattern-match on a class-name
  prefix.**
- **The `−` accepted taps at zero.** It now disables at zero in both the tier
  and add-on steppers, which also takes it out of the tab order. A control that
  can be pressed and does nothing is a control that has to be tested by pressing.

### One deliberate difference from the reference

The reference draws the price in **bright brand orange**. Here it is the brand
**text** step: `#f94a00` measures 3.50:1 on white and fails the reading floor,
while `--color-brand-foreground` clears it at 6.71:1 light and 8.33:1 dark. It
is the same decision the POS colour audit made earlier today, and the price is
exactly the figure that must not be the hard one to read.

### Verified

POS audit **0 findings** at 390 light across all twelve selection systems and
the popups; dark shows only the known absolutely-positioned-thumb artifact. 45
sheet-renders clean, badge-overlap zero. `tsc` and `build` clean.

### Duration and slot handling, made consistent (2026-09-06)

Audited every place in the app that chooses a duration or a time slot, after
the till's variable-duration control changed:

| Where | State |
|---|---|
| POS flexible sheet | **stepper**, walks the configured increment, engine-priced |
| POS fixed slots (`SlotMatrix`) | every tile carries its own price |
| POS sessions (`SessionList`) | every row carries its own price |
| Quick pass (BT-14) | **was the outlier** — fixed |
| Check-In "Extend" | already used `cfg.incrementMinutes` / `maxMinutes` |
| Cart "+15m" extend | already read `durationConfig.incrementMinutes` |
| Order reschedule picker | slots with remaining/full — no price to show |
| OS `DurationEngineField` | min/max/increment, three models, deal prices |
| OS `ScheduleBuilder`, wizard, policies | `DurationInput` (config side) |

**The outlier**: the quick pass took `product.flexibleDurations`, fell back to a
hardcoded `[30, 60, 120, 180]`, and priced as `base × hours`. An operator who
set a 15-minute increment, a minimum, or a deal price got none of it there. It
now reads `durationOptions(cfg)`, prices through `productDurationPrice` (models,
bands and deals), and uses the same stepper the till uses — a pass is a span of
time sold on a resource like any other, so it has no business owning its own
arithmetic. The seeded Parking Pass gained a real `durationConfig`: half-hour
steps at ৳50 (so an hour is the ৳100 its tier says) with an all-day deal of
৳300 against a ৳400 formula.

Grepped for hand-rolled duration pricing afterwards; the only remaining one is
the quick pass's fallback for a product with no config, and the per-resource
replacement rate in `slots.ts`, which is correct by design.
---
---

## Date + Validity (BT-02) — the pattern finally asks its own two questions (2026-09-06)

Owner supplied the Winter Exhibition Pass sheet as the reference. Rendering the
existing one first turned up the real finding: **the sheet asked for neither a
date nor a validity.** Its subtitle said *"Book a date · valid a while"* and
what it showed was two ticket steppers. The pattern named after two questions
was asking neither.

Two reasons, both structural:

- The date strip is gated on `needsSchedule(bt) || provider`, and BT-02 is in
  neither set — it has no schedule, so it fell through.
- Validity was **one configured answer, not a choice**: `windowMode` +
  `validityDays` on the product, set once by the operator and never surfaced.

### Validity became a list

`ValidityOption { id, label, days, priceDelta? }` on `Product.validityOptions`.
`days: null` means the product's whole window, which is what a season pass is —
it runs to `windowEnd` rather than counting forward. **`types.ts` changed, so
this is contract for the backend lane**, alongside the existing
`windowMode`/`validityDays` which still describe a product sold in one length
only. An operator offering a single length gets no picker at all rather than a
row with one chip in it.

Seeded on the Winter Exhibition Pass: 7 days, 30 days (+৳200), Season (+৳500).

**The price deltas are a deliberate departure from the reference,** which draws
three lengths at one price. A season pass that costs the same as a week is not
a pass anyone would sell, and the demo would have shown an operator something
they could never ship. The extra is charged **per ticket as its own line** —
exactly the shape `providerPremiums` already uses — so the receipt says what the
money bought instead of a tier quietly costing more than its own printed price.
Each chip states its own extra, for the same reason the duration chips do: a
total that moves with no visible cause is the thing to avoid.

### The sheet

- **WHEN** — the date strip, now gated for BT-02 too. It is a different question
  here than on a session sheet: not *which departure* but *when does this
  start*, so the label differs from the `DATE` used elsewhere.
- **VALID FOR** — the lengths, as a scrolling chip row.
- **CHOOSE TICKETS** — the shared tier panel from this morning.
- The summary reads **"2 pass · 7 days"** rather than a tier breakdown, because
  what a pass buyer is choosing is a length, and the CTA says **"Add 2 passes"**
  rather than "Add 2 tickets".

### Verified

The money moves and reaches the sale: 7 days ৳1,300 → 30 days ৳1,700 (+৳200×2)
→ Season ৳2,300 (+৳500×2), and the cart line reads *"1 Adult · 1 Child · 2
Season pass"* with subtotal ৳2,300, VAT ৳345, total ৳2,645.

POS audit **0 findings** at 390 light across all twelve selection systems and
the popups; dark shows only the known absolutely-positioned-thumb artifact. 45
sheet-renders clean. `tsc`, `build` and `eslint` clean — the one warning was a
`formatDurationShort` import left dead by the teammate's duration-stepper
commit, now removed. i18n parity 0 missing / 0 extra, five keys in en and bn.

### Not built

**No editor for the lengths.** They are seeded, not configurable — the product
editor has no Validity section yet, so an operator cannot add or price one.
That is the obvious follow-up and the reason the field is on the contract now.

---

## The sheets get a reading floor (2026-09-06)

Owner: *"colors and fonts aint visible enough"*, on the guided sheet, with the
POS framed as a mobile app and a mobile web view rather than a desk tool.

Consulted the design-system guidance first (`ui-ux-pro-max`, `--domain ux`),
which returns the expected floors — 4.5:1 for body text, no grey-on-grey,
line-height 1.5–1.75. Then **measured** every text node in the sheets rather
than guessing which ones looked weak.

### What the measurement showed

The contrast audit had been passing this screen, and it was right to: nothing
was below 4.5:1. The problem was a dimension it was not looking at.

| | ratio | size/weight |
|---|---|---|
| "Choose tickets" (disabled CTA) | **1.56:1** | 16/500 |
| "−" at zero | **2.09:1** | 18/400 |
| "Led by Ayesha Siddiqua" | 4.77:1 | **12/400** |
| "0/15", "৳800.00" | 4.77:1 | **12/400** |
| date-pill second lines, "৳800.00 per ticket" | 5.63:1 | **12/400** |

So: **the whole secondary layer was 12px at weight 400.** It clears the letter
of AA and fails the thing the owner actually reported — a phone, held at arm's
length, in a venue. A contrast-only check cannot see that, which is why the
audit had been green on a screen that was visibly weak.

### The rule

**Nothing in a Go sheet is below 13px.** One sentence, trivially checkable, and
it sits inside the owner's own type spec rather than against it — that spec
puts Table text at 13–14px, and these meta lines, counts and prices are table
text, not captions.

39 sites moved: 27 content lines, then the 12 section labels. The labels went
last and deliberately — they are **uppercase**, which is the harder case to
read, so small-uppercase was the worst combination on the sheet rather than the
safe exception it looked like.

### The disabled states were the worst offenders

A disabled CTA at **1.56:1** is the largest object on the sheet and was
effectively blank. Greying out should say "not yet", not "not there" —
`Button`'s disabled label moved off `faint` onto `muted`, taking it to
**4.19:1**. WCAG exempts inactive controls, which is exactly why nothing had
flagged it; the exemption is about compliance, not about whether a cashier can
read the button telling them what to do next.

### Measured, not assumed

Two things I expected to be problems and were not, found by measuring before
changing anything:

- **The header is 56px**, not the space-eater it looked like, and the first
  choice sits 28px into the scroller on every one of the twelve sheets.
- Sheet *length* is the real mobile cost: session needs 1216px of scroll
  against a 717px viewport, provider 1097px. That is inherent to eight
  departures plus tickets, not to chrome.

### Verified

**0 weak-text findings across all twelve sheets** (was 25 after the first pass,
which is how the label holdout was caught). POS audit clean at 320 and 390,
light and dark, apart from the declared white-on-ember exception and the known
absolutely-positioned-thumb artifact. 45 sheet-renders clean. `tsc` and `build`
clean.

### Not done

**The CTA can name a section that is below the fold.** On the guided sheet it
reads "Choose tickets" while the tickets are a scroll away. The honest fix is a
disabled CTA that scrolls to the section it names when tapped — a standard
form-submit-scrolls-to-first-error pattern — but it needs a target per pattern
and `SheetFooter` currently knows nothing about the sections above it. Named
here rather than half-built.

---

## The till, redesigned to the reference vibe (2026-09-06)

Owner supplied three POS designs — a warm-orange mobile till, a purple
("pointr") mobile till, and a green desktop one — and asked for Go rebuilt to
that feeling: minimal, modern, calm. Keep the design system and every feature;
put the weight on the phone, because this is going to be a mobile app and a
mobile web view.

### What the three references actually share

Rendered and read rather than eyeballed for adjectives. The vibe is not a
palette — all three use a different accent — it is six mechanics:

| | Reference | Go, before |
|---|---|---|
| Card corner | 16–24px | **6px** |
| Depth | soft wide shadow, no edge | 1px hairline on everything |
| Controls | pill / circle | 6px rectangles |
| Accent | solid CTA · solid selection · 10–15% tint | tint + border + fill, mixed |
| Chrome | floating pill nav, floating action pill | full-bleed strips |
| Section headings | sentence case | UPPERCASE, tracked out |

The last one matters more than it looks: a 6px radius on every object is most
of why the till read as a form and the references read as an app.

### Go gets its own surface vocabulary — OS is not touched

The four radii in `@theme` were measured off the Aura reference **for OS** and
the log says only those four exist. Retuning them would have restyled the
entire admin app for a request scoped to the till. So Go got its own names
instead: `--radius-go` 18 · `--radius-go-sm` 14 · `--radius-go-lg` 28, plus
`--shadow-go` / `--shadow-go-pop` and two classes, `.go-surface` (a solid card
lifted off the warm ground, no edge) and `.go-raised` (floating chrome). The
project's standing dark rule — elevation is a surface step plus a 1px line,
because a shadow on near-black reads as nothing — is restated on both, since a
Go card that leans on its shadow alone loses its edge in dark while the
greyed-out one beside it keeps a border, which inverts the reading.

`ChoiceCard` turned out to be **used only by the Go sheet**, so its radius moved
with no OS consequence. `ProductThumb` is shared, so `chip` (which is what OS
uses) keeps the 3px corner and only `thumb` follows the Go radii. `Button` and
`ModeButton` got opt-in `shape` props rather than new defaults. `Modal` and
`Toast` are shared and were left alone; `BlockedNotice` is Go-only and moved.

### The shell

- **The bottom bar is a floating pill** — inset 12px, 62px tall, on
  `.go-raised`. Selection is a soft ember pill behind the whole tab with a
  heavier icon stroke, not a 2px rule on one edge.
- **All five labels stay.** The warm-orange reference expands only the active
  tab and leaves the other four as bare icons, which is the single most
  copyable thing in it — and the wrong call here. This is the primary
  navigation of a till used under queue pressure by staff with real turnover,
  and icon-only navigation is a known comprehension problem. The pill is the
  part worth taking; the label removal is not. Measured after: all five fit at
  320 · 360 · 390 · 430.
- **A ground scrim under the bar.** Content passes *behind* a floating bar, and
  the 12px of page on every side turns that into a sliced-looking card. A
  gradient of the page colour lets the list dissolve instead. The column above
  reserves the bar's height, so nothing is ever parked underneath it.

### The sheets

The structural move: **the sheet ground is now paper, not white**, so each
panel reads as its own white card on it — the way the purple reference groups
an order screen. White-on-white had needed a hairline round everything just to
be legible.

- Section headings were `type-label` — uppercase, tracked out, `muted`. That is
  the OS **field-label** role, right beside an input on a form and wrong on
  "Date" / "Departure" / "Choose tickets", which are headings. Now 14/600 in
  `fg`: hierarchy from weight and colour instead of shouting, and one step
  above the 13px body under it. Uppercase is also the harder case to read,
  which is why the reading-floor pass had to size these up in the first place.
- Every stepper and nudge is circular; chips, time tiles and the CTA are pills.
- Cards **lift** when they are available and stay flat when they are not, which
  is a second, non-colour way of saying "not this one".
- **Sheets rise from the edge they belong to** (320ms, the project's own
  easing) and the scrim fades. `backwards` fill, so no transform lingers to
  create a containing block. The existing `prefers-reduced-motion` block
  neutralises both.

### The cart

- **The line got its width back.** Four 48px targets sat beside the text
  column, leaving about 200px for the name and the money together, so a name as
  ordinary as "All-Day Re-entry Pass" truncated. The actions moved to their own
  row; name and money now have the full card width.
- Drag handle, tinted icon discs on the summary rows, a pill payment track with
  a pill thumb, and Charge as a pill.

### Three defects found on the way

1. **A raw ISO date on the till.** `posLiveState` rendered "Starts
   2026-08-04" on the product list — the same fault fixed in the course sheet
   earlier today, in a place that sweep never reached. The cart's slot label had
   it too. Both now go through a new shared `formatDay` in `lib/format.ts`,
   which also absorbed three hand-rolled copies of the same formatter.
2. **Schedule rows could not name what they were scheduling.** Time, state,
   Sell and the overflow button took 310 of 358px, so every row read "Cric…" /
   "Futs…" — on a screen whose entire job is to say which field is booked when.
   Time and name take their own line under `sm`; from `sm` the single row has
   the width for all of it.
3. **`PROJECT_LOG.md` had committed merge-conflict markers** (`   upstream` at line 2449). Both sides were real, distinct entries; both kept.

### A regression of mine, backed out

Hiding the summary bar when the cart is empty read better and matched the
references — and it was wrong. That bar is the **only** route into the cart on
a phone, and the customer picker lives inside the cart, so hiding it made
"attach the member before ringing anything up" impossible. The bar stays and
goes quiet instead: a plain card until there is a sale, loud ember after.

### Two harness corrections, both of them mine

Neither was a product defect, and both would have been "fixed" in the app if I
had trusted the tooling:

- **A dark circle sat over the Sell tab in every screenshot.** It survived a
  1× re-render, so it was not a compositing ghost — and `querySelectorAll("*")`
  found nothing there, because it is the **Next.js dev-tools indicator**, a
  `nextjs-portal` shadow root. Dev-only. Harnesses now hide it.
- **The audit reported the payment control at 1.00:1.** `bgOf` walked
  ancestors, so a fill painted by a positioned *sibling* — the segmented
  control's thumb, under a z-10 label — was invisible, and white-on-ember
  measured as white-on-white. It now reads the element's own fill first, then
  the real paint stack via `elementsFromPoint`, then ancestors. **The first
  attempt skipped the element's own background and made it worse** (a phantom
  1.12:1 on every ember chip), which the re-run caught. Verified from the
  markup instead: white on ember, **3.50:1 light / 2.59:1 dark** — the owner's
  declared exception, unchanged.

### Verified

- **POS audit — 11 findings at 390 light, 390 dark and 320 light, and every
  one of them is the declared white-on-ember exception.** Zero severity A,
  zero B, across all twelve selection systems, the catalogue and the popups.
- **45 sheet-renders clean** (nine sheets x 320/390/430 light, 430 dark, 390
  Bangla): no page x-scroll, nothing clipped without an ellipsis, nothing under
  the floor, no console errors.
- **0 weak-text findings across all twelve sheets** — the 13px reading floor
  from this morning holds through the restyle.
- Nav labels measured, not assumed: all five fit at **320 / 360 / 390 / 430**.
- `tsc --noEmit` clean - `npm run build` clean.
- **eslint identical to clean HEAD** — 5 errors and 5 warnings, all
  pre-existing, confirmed by stashing; the only difference in the whole report
  is one line number moving where a comment was added.
- i18n parity **0 missing / 0 extra** across 29 namespaces. No new keys: the
  redesign is shape and surface, so every string it touches already existed in
  both locales.

### Not done

- **Modal and Toast keep their OS corners.** Both are shared; softening them is
  an OS decision, not a till one.
- **The CTA can still name a section below the fold** — carried over, still the
  most substantial remaining mobile-UX item in the sheets.

---

## The sell wall becomes a grid of cards (2026-09-07)

Owner supplied a grid-card mockup and asked for the till's product list rebuilt
as cards, properly researched.

### The card, and the order it answers in

Icon tile and status pill on the first line, then **name → price → what it is →
what it is doing right now**. That is the order a counter asks in, and it is the
mockup's own order.

Two pieces of guidance shaped the build rather than the picture:

- **Essential Text Truncation (Critical)** — *distinguishing names* need
  complete access, and must not be clamped merely to make cards uniform. So the
  grid rows **stretch** to equal height instead of the name being cut; the name
  gets three lines before it clamps, and the sheet behind the card carries it in
  full. That is why the 84-character stress product sets three lines rather than
  one.
- **Compact Label Overflow (High)** — the status pill is `nowrap` and never
  shrinks. A pill that wraps to two lines is worse than no pill.

### The price, and why it is allowed to be ember

`formatPriceShort` drops a trailing `.00` — on the loudest element of a card,
"৳4,000.00" is three characters of noise, and the reference draws whole prices.
It drops a **zero, never a value**: anything with paisa still shows it, and the
cart, receipts and reports keep `formatMoney`, where two decimals are an
accounting convention rather than a style.

At **20px/700** the price is also *legal* in the brand orange. WCAG counts
>=18.66px bold as large text, where the floor is 3:1, and `ember` measures
**3.50:1 on white and 6.21:1 on the dark card**. Every other price in this app
uses the darker `brand-foreground` step precisely because at 13px it would not
clear the body floor. The size is what buys the colour.

### Five defects the grid exposed, all pre-existing

1. **`getSlots` never checked `isOpenOn`.** It returned the weekly pattern's
   times for *any* date with full remaining, and each caller was expected to
   remember the open-days check separately. The sheet did; the product card did
   not — so a Fri–Sun tour advertised **"Next 14:00 · 15 left" on a Wednesday**
   while the sheet behind it could not sell before Friday. Fixed at the source,
   so every caller is right at once. The card now looks ahead and says
   **"Next Fri 31 Jul 10:00"**, which is exactly what its own date strip offers.
   New key `live.nextDay` in both locales.
2. **Low availability fired at full availability.** With one court the 20%
   threshold rounds to 1, so *1 of 1 free* counted as low and the new card
   badged a completely free court **Limited**. `LOW` now also requires
   `left < total`: low means some of it has gone.
3. **The page scrolled sideways 788px at 1024 and 1280.** Attributed before it
   was touched — `doc=1812` **identical on production**, so pre-existing, not
   the grid. The category strip is an `overflow-x-auto` row whose min-content is
   the SUM of every chip, and the till column had no `min-w-0`; the same
   mechanism the dashboard was fixed with.
4. **Keyboard focus was invisible on every product card.** `overflow-hidden`
   (which keeps the press tint inside the rounded corners) clipped the inner
   button's outline completely — the probe confirmed focus *was* on the card and
   nothing was drawn. The ring moved to the card itself, where a box-shadow
   cannot be eaten by the card's own overflow.

   The same fault had a second form on the search field, which drew a **square
   outline inside a round pill**. `focus-visible:outline-none` did nothing, and
   the reason is worth keeping: the global `:focus-visible` rule is
   **unlayered**, so it beats every Tailwind utility, and an opt-out has to sit
   at the same level. Hence the unlayered `[data-focus-host]` rule.
5. **"Fort Main Gate" was printed twice** at >=640px — once in the context bar
   and again 40px away beside the search, taking a bite out of the field to do
   it. The context bar is where the counter is named.

### Verified

- **The badge was proven end to end, not asserted**: sold Yoga Session down
  through the real till (sheet → cart → cash → complete → New sale) and the card
  went from *"20 of 20 left today"* to **"Limited" / "3 of 20 left today"**.
  That walk also smoke-tested the whole redesigned flow, which issued a real
  reservation reference.
- **Card and sheet agree**: a probe reads each card's live line and then opens
  its sheet and reads the bookable days. Heritage and Sculpture Garden Tour now
  name Friday; Planetarium, which does run today, still names 12:30.
- Grid geometry at **320 / 390 / 430 / 768 / 1024 / 1280**: 2 columns on a
  phone, 3 from `sm`, 4 from `xl`; no page x-scroll, no clipped text, no wrapped
  pills.
- POS audit at 390 light, 390 dark and 320: **only the declared
  white-on-ember exception**. The 20px ember price raises no finding, which is
  the large-text rule doing its job.
- 45 sheet-renders clean · 0 weak-text findings across twelve sheets ·
  `tsc` and `build` clean · **eslint identical to clean HEAD** · i18n parity
  0 missing / 0 extra with two new keys authored in both locales.

### Not done

- The icon tiles are **one neutral surface**, where the mockup tints each one a
  different pastel. Eight hues would break the standing one-accent-per-screen
  rule (D8), and the calm wall is what lets the ember prices carry the glance.

---

## POS v2 — the cartless till (2026-09-07), part 1 of 4

Owner asked for a **second** POS variant with no cart, laid out as one scrolling
page, and was explicit that it is a **design** to hand to the engineering team
(whose backend already exists) — so `/pos` must not change. It has not: the only
edits outside `src/app/(go)/sell/` are one More-menu entry, one namespace
registration and two nav strings.

### What "no cart" resolved to

Two honest readings were put to the owner, who chose the first:

- **The scroll IS the sale.** Each thing added stays as a block where it was
  configured; finished blocks collapse to a line stating what was decided; the
  total is a bar that never scrolls away. No cart region, no drawer, no sheet
  over the selection. Multi-item sales survive — a single-product venue simply
  never sees a second block, so this contains the strict express case for free.
- (Rejected: strict one-item express — two products would mean two orders and
  two receipts, which is worse at a counter and no faster at a gate.)

Wide screens are **two columns** (wall left, sale right), not a next/next
stepper: a wizard is more taps than the scroll for the fastest users and would
be a third layout to keep in sync.

### Sharing, and what is deliberately duplicated

`/pos` being off-limits rules out extracting the shared engine, so v2 **copies**
the till's arithmetic and writes its own selection UI. The cost is named rather
than hidden: two implementations that will drift. It is the right trade here —
this is a design artifact with a known lifespan, and the inline selection was
always going to diverge visually from a sheet, so shared code would have been
all `variant` branches. When v2 wins, one is built and the other deleted.

What IS shared is the contract, which is what the backend lane is wiring to:
`lib/api`, `lib/orderMath`, `lib/duration`, `lib/pricing`, `lib/posState`, and
the three selection sub-components (`SessionList`, `SlotMatrix`, `RepeatPicker`)
which were already separate files.

### Shape

```
(go)/sell/page.tsx              blocks · sticky total · pay section
(go)/sell/complete/page.tsx     v2's own completion (New sale returns to /sell)
(go)/sell/_lib/saleMath.ts      PURE: items → CheckoutLine[] + totals
(go)/sell/_lib/selection.ts     PURE: draft → item, and what is still missing
(go)/sell/_components/Catalogue.tsx
(go)/sell/_components/SelectionInline.tsx
```

Two rules the structure enforces:

- **One resolution pass.** Blocks, the footer total and the eventual payload are
  all computed from the same `resolveDraft`/`priceSale` output. The lines that
  priced the bar are the array handed to `checkout()` — rebuilding the payload at
  charge time is how a till shows one number and charges another.
- **The footer never says "Continue."** `resolveDraft` returns which question is
  still open, so the button reads "Choose a time" → "Choose how many" →
  "Take ৳2,760.00" → "Complete ৳2,760.00".

### Patterns in this part, and the ones that say they are missing

In: open entry · date-and-validity pass · fixed sessions · guided departures
(with the guide step, first free guide auto-picked) · daily allowance ·
resource × time slots · custom amount.

Not in, and **stated on screen** rather than silently omitted: seat maps,
flexible duration, providers, courses, credits packs, sectioned rooms. A
selection screen that quietly drops the one question a booking type is run by
would sell the wrong thing.

### Defects found by rendering it, not by reading it

- **A daily-capped booking was routed to the session list.** `needsSchedule`
  is true for BT-06 (it needs to know which days it runs) but it has no
  sessions, so the block showed an empty departure list under a call to action
  demanding a time it does not have. `patternOf` now branches on
  `isDailyCapped` before `needsSchedule`.
- **The wall was in the DOM twice** — once hidden behind `lg:` for the desktop
  column, once for the phone — so a screen reader found two search fields and
  anything selecting "the search box" got the invisible one. Exactly the trap
  the page-header portal hit on 2026-09-03; fixed the way that was, with
  `useMediaQuery`. Verified: exactly one search field at every width and state.
- **The date chip wore its own check badge.** `ChoiceCard` owns the top-right
  24px and the chip is 76px of centred text, so the badge landed on the month —
  the same collision the sheets were swept for. These chips use `hideCheck`;
  selection reads from the ember ring instead.
- **`h-full` had nothing to resolve against.** The Go shell hands its children
  no height, so the two columns grew the page instead of scrolling. The desktop
  branch now states its height (`100dvh` less the 64px header and the 96px the
  shell reserves for the tab bar, which a landscape tablet does not have).
- **`SlotMatrix` heads its own two questions**, so wrapping it in a Step printed
  "Time" above "Field" above "Time".
- **A `set-state-in-effect` error** on the completion screen — session storage is
  an external store, so it is read with `useSyncExternalStore`.

### Verified

Driven in a real browser, at 320 · 390 · 430 · 768 · 1024 · 1440, light and
dark, en and bn: **no page x-scroll, nothing clipped without an ellipsis, and
nothing below the 12px caption floor** except the two standing exceptions (the
`sr-only` heading, which is meant to be clipped, and the 5-tab mobile bar's
11px). Sales completed end to end three times — single item, two items, and a
Family tier (admits 4) plus a day-capped booking — each landing a real order and
ticket with correct VAT (৳2,400 + 15% = ৳2,760).

`tsc` clean · `npm run build` clean · `eslint` clean on every new file ·
i18n parity **0 missing / 0 extra across 30 namespaces** (new `sell` namespace
authored in both locales).

### Inherited, not introduced

A session list footed with "৳800.00 per ticket" under tiers priced ৳800 and
৳1,200 reads as a promise it does not keep. That line is `SessionList`'s own and
`/pos` shows the same thing, so it was left alone rather than edited in a shared
component. Worth fixing in v2's own session list later.

### Still to come (parts 2–4, all four scope groups were approved)

2. The remaining selection patterns inline (duration, providers, seats,
   sections, course, credits, add-ons, repeat weekly, group size, waiver).
3. Sale-level rows: customer + member pricing + points, discounts + coupons
   with the policy cap and required reason.
4. Park/resume, settling an existing booking (which cannot be a block — it is
   `addOrderPayment` against an order that already exists, so it needs its own
   entry point), and the bKash/QR pending flows.


---

## Three till variants, and the features the backend cannot keep (2026-09-07)

Owner's direction, in their words: three POS variants, reachable from the home
screen; v2 needs partial payment, discounts and customers; **promotions and
memberships come out of every system for now, because the backend is not ready
for them**; and a third variant restoring the design as it was before Ishmam's
6 September pass.

### Hidden, not deleted — `lib/features.ts`

`FEATURES.promotions`, `.memberships` and `.loyalty` are three booleans, all
`false`. Nothing under `lib/api`, nothing in the seed and none of the routes was
removed, so lifting a flag restores the feature whole. Points came out too, at
the owner's instruction.

Two rules the gating follows, both of which matter more than where the controls
went:

- **Gate the source, not the markup.** The till sets `benefit`, `pointsAccount`
  and `program` to null behind the flag, so every downstream sum and every
  control that reads them goes quiet at once — rather than nine separate places
  each remembering to check. `priceSale` and `buildOrderLines` still ACCEPT a
  member discount or a coupon; what changes is that no screen can produce one,
  which keeps the money engine identical to the one the backend team is reading.
- **Gate the write, not only the control.** A sale made while points are hidden
  must not add ledger entries, or the balances waiting behind the flag are wrong
  when it is lifted. `issueMembership`, `spendPoints` and `earnPoints` are all
  behind the flag at the call site.

Swept: OS sidebar · Settings sub-nav and hub · the customer record's Membership
& points tab · the v1 till's coupon row, membership sale, points sheet and
member-rate banner · the CF-M- branch at the gate, which now falls through to
the ticket path and is refused as an unknown code — the truth, rather than a
card that half works. A cashier's **manual discount is not a promotion** and
stays on: it is a role-and-policy mechanism that works with no promotions engine
at all.

The passes row was renamed "Passes & balances" — it now holds a credits pass and
settling a booking, and naming a control after something it cannot do is worse
than a shorter name.

Verified in a browser rather than by grep: **zero** occurrences of Memberships,
Promotions or Points across the dashboard nav, the settings hub and the till.
`eslint` on `pos/page.tsx` is byte-identical before and after (6 problems both
sides — the pre-existing deep-link effect), so the gating introduced nothing.

### The variant picker

`lib/tills.ts` is one registry read by everything that offers the choice: the
picker at **`/tills`**, the switcher in the Go header, the More sheet and the
home page's bottom link row. A variant marked `ready: false` is **shown but not
offered** — a link that 404s is worse than an honest placeholder.

The header switcher appears only on a till route (elsewhere it would offer to
change something the current screen is not) and only from `sm`, where the header
has room; the phone route in is More → Till design. Same
responsive-by-form-factor rule the nav itself follows.

### v2 gains the three things it was missing

- **Customer** — reuses `pos/CustomerPicker` rather than a second copy: it is a
  self-contained component, and two customer pickers would be two places for a
  flagged customer's reason to stop appearing.
- **Discount** — `DiscountInput` (percent or money), capped by the business
  policy and falling back to the signed-in staff's **role limit** where no
  policy is set. The cap is on the EFFECTIVE rate, not what was typed, and the
  refusal names the cap and the way past it. A required reason blocks the sale
  with "Add a reason for the discount" rather than a silent disabled button.
- **Partial payment** — two rules meet in one row: a booking's **deposit** says
  what the booking requires, an **advance** says what this customer actually
  handed over. The footer then collects `dueNow`, not the total, and `checkout`
  lands the order as `partial` (`payNow < total`).

Priced in two passes, because a percentage needs something to be a percentage
of: the sale at list price sizes the discount, then the sale is priced again
with it.

**A defect found by walking it:** the completion screen showed the change due
but not the **৳517.50 still owed**. A part-paid sale has to say that on the slip
the customer walks away with, or the only record of the balance is in the ledger
and the person who owes it never saw it.

Browser-verified end to end at 430px: 2 Adult ৳1,000 → 15% refused with "Over
the 10% limit for this counter" and the footer reading "Needs a manager" → 10%
accepted, reason demanded, **VAT ৳135 on the discounted ৳900** → Half → Due now
৳517.50, balance ৳517.50 → tendered ৳518, change ৳0.50, order partial.

Overflow sweep at 320 · 390 · 430 · 768 · 1024 · 1440: no page x-scroll, nothing
clipped without an ellipsis (the `sr-only` heading excepted, which is meant to
be). `tsc`, `npm run build` and `eslint` clean; i18n parity 0 missing / 0 extra.

**Harness note:** `DiscountInput` commits on blur or Enter, not on input, and
React 19's focus delegation means a synthetic `blur` event does not reach it.
Drive it by its chips, or dispatch `focusout`. Two "failing" checks were this
and not product bugs.


---

## The classic till (2026-09-07) — the design before the 6 September pass

The third variant, at **`/classic`**. Owner's definition: the design as it was
*before Ishmam changed those UI elements* — so this is not a re-drawing from
memory, it is the till **restored from `acb8291`**, the last commit before that
pass began.

### What is restored, and what deliberately is not

Restored verbatim from git into `src/app/(classic)/`: the Go layout, the till
page, its completion screen, the customer picker, and all five selection
sub-components (`ProductSheet`, `SessionList`, `SlotMatrix`, `RepeatPicker`,
`Keypad`).

`globals.css` turned out to be **purely additive** across the redesign — every
old class still exists — so the older look needed no CSS surgery. Of the four
shared primitives that changed, three were supersets: `shape="pill"`, `raised`
and `size="card"` were *added*, so markup that predates them gets the old
rendering for free. Only two real deltas remained (the ember CTA went ink →
white, and the choice-card radius moved), so the classic variant keeps **its own
copy of `Button` and `ChoiceCard`** in `(classic)/_ui/`, re-exporting the rest of
`@/components/ui` unchanged. Nothing shared was forked.

**The logic layer is current, not restored.** `lib/api`, `lib/posState`,
`lib/orderMath` and the rest are today's — `posLiveState` had gained a phrasing
since, and classic follows it. This is a visual variant, not a fork of the
engine, so all three tills price identically and write the same order shape.

The same `FEATURES` gating was applied: no coupon row, no membership sale, no
points. Verified in-browser at six widths — zero occurrences.

### Three inherited lint errors, fixed rather than imported

The restored file carried three `react-hooks/set-state-in-effect` violations
(an error in this repo, not a warning). Copying them in would have added three
new errors to a clean tree, so each was reworked in the classic copy:

- **The non-cash fallback** kept a `method` state and corrected it in an effect.
  It is now a render-time derivation — what the till *will* charge with is a
  function of what was picked and what is actually live.
- **The Schedule deep-link** read session storage in an effect and setState'd.
  It now reads once in a lazy initialiser and resolves during render when the
  catalogue lands.
- **The completion screen** read session storage in an effect;
  `useSyncExternalStore`, the shape this codebase settled on.

Also removed: a `buildSale()` call whose result was discarded — dead work the
old file did to destructure a `payload` it never used. `(classic)` lints with
**zero errors and zero warnings**.

### Verified

Sold end to end at 1280: General Admission → "Add 1 ticket — ৳500.00" → cart →
"Charge ৳575.00 — Cash" (৳500 + 15% VAT) → tender → `/classic/complete`, so the
loop closes inside the variant. Overflow sweep at 320 · 390 · 768 · 1024 · 1280
· 1440: no page x-scroll, nothing clipped without an ellipsis bar the `sr-only`
heading. `tsc` and `npm run build` clean.

### One authentic defect, kept on purpose

The classic till prints **"Fort Main Gate" twice** at ≥640px — once in the
context bar and again beside the search. That is a real fault the 6 September
pass fixed, and it is faithfully present here because the brief was to restore
the design, not an improved version of it. Silently repairing it would make the
comparison dishonest. **Say the word and it goes.**

### Navigation between the three

The Sell tab inside `/classic` stays in the variant; Schedule, Scan and Check In
lead back to the Go chrome rather than being copied a second time — this is a
TILL design, not a fork of front-of-house. The `TillSwitcher` is added to the
classic header as review scaffolding (it is not part of the restored design);
without it there is no way out of the variant but the browser's back button.


---

## The scrolling till learns the other five booking types (2026-09-07)

Owner asked whether `/sell` had the other booking types. It did not: **5 of the
18 seeded bookings** fell into the honest "not on this till yet" panel. A till
that cannot sell a third of the catalogue is not comparable to the other two, so
the remaining patterns were built.

| Pattern | Booking | Was |
|---|---|---|
| Flexible duration (BT-05) | Bowling Lane | unsupported |
| Provider (BT-10) | Deep Tissue Massage | unsupported |
| Seat map (BT-07) | Evening Film | unsupported |
| Credits pack (BT-12) | 10-Class Yoga Pack | unsupported |
| Course (BT-13) | Beginner Swim Course | unsupported |

`patternOf` now returns nine shapes. Two corrections fell out of writing it: a
**credits pack has no special selection** — it sells as a quantity like any
tiered item, so it simply routes to `tiered`; and a **layout beats sections**,
because a room with a seat map sells the seat and its sections are then only how
those seats are priced.

### What each one asks, and why in that order

- **Flexible** asks *how long* first, then the lane, then the start — because
  the length decides which starts are even possible (a three-hour booking cannot
  start an hour before closing). Changing the length re-checks the chosen start
  and clears it rather than leaving it pointing at a span that no longer fits.
  "Any" lane resolves to the first free one **at resolve time**, so the summary
  names the lane the sale will actually take instead of promising one and
  assigning another.
- **Provider** asks *when* before *who* — offering a therapist before a time
  offers people who may not be free when the customer wants to come. The
  premium is a **line**, not a different price: the treatment costs what it
  costs and the senior therapist is an extra the receipt can show.
- **Course** has nothing to configure — it runs on dates it already owns — so
  it states that in the affirmative and asks only for places.
- **Seats** keep their own rules: the selected seat is **solid ember with white
  text**, not a saturated version of its own category colour, which is the one
  comparison a 28px tile cannot carry.

The pure/UI split held: everything except the seat map resolves synchronously in
`_lib/selection.ts`. Seats are the one asynchronous shape, so the UI fetches
`availableSeats` and writes the chosen labels **and their prices** into the
draft — rather than the resolver pretending it can look them up.

### The check that mattered

**Both tills must price identically.** The same selection — Bowling Lane, 2 hr,
Lane 1, 17:00 — was driven through v1's sheet and v2's blocks: **৳1,925.00 on
both**. The duration engine, time bands and per-lane rates agree across the
variants, which is the whole point of sharing `lib/duration` rather than
copying it.

Two harness self-corrections worth recording, because both looked like product
bugs and were not:

- v1's duration control is a **stepper**, not chips, so a click looking for a
  "2 hr" button never landed and v1 appeared to price the same booking at
  ৳1,000. It was still on 1 hr.
- The provider list appeared to show only one therapist. The card renders
  "+৳500.00", and the probe was filtering on the word "premium". Both Nadia and
  Karim render, correctly, with Karim's premium beside him.

### Verified end to end

- **Seats**: A1 + A2 Stalls → grouped as "2 × Evening Film · Stalls ৳800.00",
  VAT ৳120, total ৳920, sold. (v1 once shipped "Add 2 seats — ৳0.00" here; v2
  is right from the start because the seat prices travel with the selection.)
- **Provider**: ৳3,000 treatment + **৳500 Karim premium as its own line**, VAT
  ৳525, total ৳4,025 — and the spa's deposit policy split it automatically into
  **৳2,275 now, ৳1,750 at arrival**, with the balance printed on the receipt.
- **Flexible**: 2 hr on Lane 1 from 17:00, ৳1,925 + VAT = ৳2,213.75, window
  stated as "17:00 – 19:00".
- Overflow sweep on the three new heavy patterns at 320 and 390: no page
  x-scroll, nothing clipped without an ellipsis, and the only sub-12px text is
  the seat numbers — the same **declared exception** v1's seat grid already
  carries (9px on a 28px tile, each seat carrying a full title attribute).

`tsc`, `npm run build` and `eslint` clean; i18n parity 0 missing / 0 extra with
the new keys authored in both locales.

**Still not on the scrolling till**, and now the only gaps: add-ons, repeat
weekly, the group-size stepper for per-booking pricing, and the waiver gate.
Those are cross-cutting options rather than booking types — every type can be
sold without them.


---

## Two owner findings (2026-09-07)

### 1. "Sold as" comes off every till

The chip row offered the **nine selection systems as filters** beside the
operator's own categories — Open entry · Date pass · Sessions · Time slots · By
duration · Daily limit · Seats · Guided · Appointments.

Removing it is not only the owner's call, it settles a standing contradiction.
The Phase 7 governing rule is that **internal identifiers never appear in the
UI** and booking type is *derived*, shown only in a read-only Advanced section —
which is why there is no BT dropdown anywhere. That chip row was the
booking-type taxonomy, relabelled and put at the counter. A category says what
a thing IS, and that is the filter worth keeping.

Gone from `/pos` and `/sell`, along with the `sys:` branch in both filters and
the ten now-orphaned message keys in both locales. `/classic` predates the
feature and never had it. `eslint` on `pos/page.tsx` is unchanged at its
documented baseline (6 problems), so nothing else moved.

### 2. The scrolling till's total bar was clipped by the tab bar

Measured, not eyeballed: the Go tab bar is a floating pill inset 12px from the
bottom and 64px tall, so it owns the **bottom 76px**. The v2 total bar was
pinned at 70px, which put its lower edge **6px inside** the nav — exactly the
slice in the owner's screenshot.

Now 82px, matching the v1 till **exactly** rather than being picked by eye, so
both tills' bottom furniture rides at the same height — which is what a design
comparison needs. Content padding went 160 → 176px so the last row still clears
it at the end of the scroll.

Measured after: `/sell` **+8px** clear at 320 and 390, `/pos` **+8px**,
`/classic` **+7px**.

**A false alarm worth recording.** A heuristic sweep reported `/classic`
overlapping by 9px. Measuring its actual cart bar — rather than the
biggest-bottom-most element the heuristic guessed at — showed **+7px clear**.
Classic's nav is a full-bleed strip at `bottom:0`, not the floating pill, so its
own 64px offset is correct by design and always was. Three tills, three
different offsets, and only one of them was wrong.

---

## The cart (2026-09-07)

Owner asked for the cart researched and improved. Four rules from the guidance
database drove it, plus three defects the work surfaced.

### Removing a line is undoable

**Confirmation Dialogs (High)** — *prevent accidental destructive actions*. The
trash button deleted a line instantly with no way back, and at a till that line
is a whole configured booking: date, slot, guide, tiers, rebuilt from scratch
while a queue waits.

A confirm dialog on every removal is the wrong trade for that queue, so this
takes the other route the rule allows and the app already uses elsewhere: do it
immediately and offer **Undo**. `Toast` already carried an `action` — nothing new
was needed but the call. The line returns **at its original index**, not on the
end, because a cart that reshuffles under a cashier is its own bug. Verified by
removing the middle of three lines and undoing it.

### An empty cart stops describing a sale that does not exist

**Empty States (Medium)** — *guide users when no content exists*. The empty cart
showed Subtotal ৳0.00 over VAT ৳0.00 over Total ৳0.00, a live-looking payment
selector and a dead Charge button. Five controls, no sale. All hidden until
there is a line.

The **customer row stays**, because attaching a member before ringing anything
up is a real flow and this drawer is its only route on a phone — the same reason
the summary pill was kept in the last session.

### Toasts stop covering the thing you are about to press

**Confirmation Messages (Medium)** says confirm a successful action; it does not
say cover the primary one. "Added X" was landing on top of Charge at the exact
moment a cashier reaches for it, because on a phone the bottom is where every
control lives — nav pill, cart pill, and inside the open cart the payment
selector and Charge. The top of a phone is empty by comparison. Toasts are now
top on mobile and bottom-left from `md`, where nothing competes.

### The pencil was the line tap, twice

The line's text block already carried `role="button"` and opened the same sheet
with the same argument. Two controls, one action, 48px of a phone cart each
time. A **chevron** replaces it: it says *this row opens* rather than *this row
has an edit button*, and it is the language the five rows below already speak.

The header also states the sale's size ("3 items"). Once the drawer is open the
phone summary pill is gone, so that was the only place the cart could not say
how big it was.

### Three defects found on the way

1. **Charge was 650px below the fold at tablet landscape** — a very plausible
   till setup. Attributed before it was touched: `y=1549`, `docScroll=1629`,
   **identical on production**, so pre-existing. The page scrolls at `lg` and
   the product column is taller than the viewport, so the cart column ran down
   with it. The cart is now `sticky` with its own height, and Charge is on
   screen at rest (y=820 of 900) and stays pinned while browsing.

   Worth remembering: the first attempt left `lg:static` on the element
   alongside the new `lg:sticky`. Two position utilities at one breakpoint, and
   which one wins is stylesheet order, not intent.
2. **The Total row was sliced mid-glyph** by the pinned payment bar, which
   reads as a rendering fault rather than "there is more below". New
   `.scroll-y-hint` mirrors the existing `.scroll-x-hint` onto the other axis —
   painted by the scroller itself, so each shadow shows only on the side that
   still has content. No JS, no scroll listener.
3. **`--color-subtle` and `--color-card` are the same value in dark**, so every
   soft pill and icon disc added this session vanished there: Close and Park
   read as bare labels and the summary-row glyphs floated with no disc.

   The first fix — a `bg-line` fill in dark — traded one problem for another and
   the audit caught it: `muted` on `line` is **3.85:1**, under the floor. The
   pills now take a **border** in dark instead of a fill, which keeps the label
   on `card` at **5.13:1** and still gives the control an edge. The icon discs
   keep the fill: an icon answers to the 3:1 non-text floor, which 3.85 clears.

### Verified

- **Undo behaviour, end to end**: three lines, remove the middle, Undo offered,
  line restored at index 1.
- POS audit at 390 light, 390 dark and 320: **only the declared white-on-ember
  exception**, zero A, zero B.
- 45 sheet-renders clean · 0 weak-text findings across twelve sheets · grid
  geometry unchanged at six widths with no x-scroll · `tsc` and `build` clean ·
  **eslint identical to clean HEAD** · i18n parity 0 missing / 0 extra, two new
  keys in both locales and one orphan (`cart.edit`) removed with the control it
  belonged to.

### Not done

- **Discount, Coupon and Passes still show on an empty cart.** All three
  allocate across lines, so they have nothing to act on — but each opens a
  working sheet and hiding them would remove a route rather than a redundancy.
  The three that were actively misleading (the ৳0.00 stack, the payment
  selector, the dead Charge) are the ones that went.

---

## The cart, second pass — hierarchy, and the missing exit (2026-09-07)

Owner asked for the cart researched and improved again, with a screenshot of a
one-line sale.

**A note on the research:** searches for cart-line efficiency and for grouping
related controls returned nothing on point — two narrower retries gave back
generic contrast and help-placement rules. The verified hits held to here are
**Focus States (High)** and **Contrast Readability (High)**. The layout calls
below are judgement plus the built-in priority table, and are labelled as such
rather than dressed up as database matches.

### The problem was hierarchy, not styling

Lines, modifiers and totals were three zones separated by identical hairlines,
in identical row heights, with identical icon discs. So a cart holding one
Cricket booking gave more room and more visual weight to **Customer, Discount,
Advance and Passes** than to the thing being sold. Four settings outranked the
sale.

The modifiers now sit on a **recessive ground** — paper in light, a step *down*
from the card in dark — so the cart reads in the order a till is worked in:
what is being bought, then the settings, then what it costs, then charge. One
surface change; no control moved, renamed or removed.

### Clear all — the exit that was missing

A customer walks away from a five-line sale and there was no way to abandon it.
The bin, five times; or **Park**, which SAVES the sale, so the next customer
inherits it. Clearing was the one thing the cart could not do.

**It asks first, and deliberately does not offer the Undo that single-line
removal gets.** The difference is real rather than stylistic: clearing runs the
same reset `park` does, including `releaseCheckoutHolds`, which puts held places
back on public sale. Undo cannot promise to take that back — somebody else may
have taken the slot in the meantime — so this is the case the guidance's first
branch (confirm before an irreversible action) exists for.

It appears only when there is more than one line: with one line the bin is
already a single tap.

### Two options considered and rejected

- **A quantity stepper on cart lines.** The commonest till edit, and tempting.
  But it only works for a single-tier line with no slot, resource, provider or
  seat — and this codebase deliberately removed a grid "Book now" shortcut for
  exactly that reason: *a shortcut there can only sell the default*. The sheet
  is the single place selection happens. A stepper that appeared on some lines
  and not others would rebuild the inconsistency that was removed on purpose.
- **Collapsing the line's action row** to save ~48px per line. Every version
  either truncated the booking name or split the tappable text into two
  buttons. The three-row line is taller and unambiguous, and the meta
  ("Outdoor Field · Group of 2 · 16:00 today") stays whole.

### Verified

- **Clear, end to end**: two lines, dialog states the count and that it cannot
  be undone, **Cancel keeps both**, Confirm empties to the empty state.
- **Undo still behaves**: remove the middle of three, restored at index 1.
- POS audit at 390 light, 390 dark and 320: **only the declared white-on-ember
  exception**, zero A, zero B.
- 45 sheet-renders clean · `tsc` and `build` clean · **eslint identical to
  HEAD** (one line number moved) · i18n parity **0 missing / 0 extra** across 30
  namespaces, five new keys in both locales.

### Still open

- **`Modal` keeps its OS 12px corner** inside a till that is otherwise on the
  Go radii. It is shared with the admin app, so softening it is an OS decision.
- **Removing a single line does not release its checkout hold.** Pre-existing,
  and load-bearing for Undo: the hold still standing is exactly why the line can
  come back. Holds self-release in ten minutes, so the leak is bounded — but it
  is a leak, and worth naming.

---

## The cart, rebuilt to the reference (2026-09-07)

Owner supplied a cart mockup and asked for it built. Its shape: a named sale, a
line with a thumbnail and a quantity stepper, each decision in its own labelled
panel, a receipt-style totals card, and one pill to charge.

### What the reference changed

- **The cart names itself.** "Current sale" with the count beneath it, and a
  circular ✕. Park stays as a pill beside it — the mockup has no Park, but it
  is a real feature and dropping it to match a drawing would be a functional
  regression.
- **The line takes the reference's two-row shape**: thumbnail, name and chevron
  on top; controls left and the money bold on the right underneath. The
  thumbnail is `ProductThumb size="card"`, the same 44px tile the sell grid
  uses, so a cart line and its card show the same picture.
- **The per-line controls lost their borders.** Three bordered 48px circles read
  as three equal siblings to the content; borderless 44px glyphs read as what
  they are — secondary to the money beside them. The touch target is unchanged.
- **CUSTOMER is an invitation, not a navigation row.** Empty, it is the dashed
  target the reference draws. Filled, it is the record with the phone beneath
  the name — two customers share a name far more often than a phone, which is
  the line that confirms the right person. The card already says CUSTOMER, so
  the row that also said it was the label twice.
- **DISCOUNT is always open.** It was the most-used modifier and cost a tap to
  reveal.
- **The totals became a receipt panel** with a rule above Total.
- **Charge stops repeating the method.** The segmented control directly above
  states it and marks it selected, so the button was saying it twice — and it
  was the half that truncated first on a narrow screen. `chargeAmount` stays in
  the message files because `/classic` still uses it.

### The quantity stepper, and where it does not appear

Argued against in the previous pass and settled by the owner's mockup, which
draws it on a General Admission line — which is exactly where it is safe.

`simpleQty` gates it: one tier, and nothing reserved. **A booking is not a
quantity.** A lane at 12:00, seat A5, a group of two, a provider appointment —
each is one thing, and a stepper on it would be a control with nothing to count
and no way to price a second one. So Bowling Lane has none and General
Admission does. The sheet still owns every other kind of change, which keeps
the standing rule that selection happens in one place.

### One deviation from the mockup, on purpose

The mockup draws discount as four chips (0 / 5 / 10 / 15). The typed field
stays beside them, because a previous session fixed exactly this: four fixed
buttons meant a manager who agreed **12%** had no way to say so and the till
silently made it 10. The chips still fill the field; they are just not the
whole menu. Less tidy than the drawing, and the owner can have chips-only if
the tidiness is worth the 12%.

### What the reference made me revisit

Promoting the modifiers from rows to prominent panels changed the empty-cart
calculation. Four quiet rows were harmless; two labelled cards offering a
discount and a coupon on a sale with no lines are a promise with nothing behind
it. **DISCOUNT and the adjustments panel are now gated on having a line.**
CUSTOMER stays — attaching a member before ringing anything up is a real flow
and this drawer is its only route on a phone.

### Verified

- POS audit at 390 light, 390 dark and 320: **only the declared white-on-ember
  exception**, zero A, zero B.
- Undo still restores the middle of three lines **in place**; Clear still asks,
  cancels cleanly and empties to the empty state.
- 45 sheet-renders clean · `tsc` and `build` clean · **eslint identical to
  HEAD** after removing a `methodLabel` binding the Charge change orphaned ·
  i18n parity **0 missing / 0 extra** across 30 namespaces, three new keys in
  both locales.

### Still open

- The **stepper only reprices single-tier lines**, which is the whole point of
  the gate, but it does mean a two-tier line ("1 Adult · 1 Child") is still a
  sheet round trip to change. That is the sheet's job and not obviously wrong,
  but it is the one case where the mockup's convenience does not reach.
- `Modal` keeps its OS 12px corner; removing a single line still does not
  release its checkout hold. Both carried forward from the previous entry.

---

## The cart becomes a route (2026-09-07)

Owner's three asks, with a screenshot: the discount chips do not match the
theme's radii; the cart should sit on the POS ground with white cards; and
**"no need popup, direct to individual cart page"** — repeated, with *"build a
individual cart page properly"*.

### 1. The chips

The `%`/`৳` toggle, its field and the four percentage chips were on the OS 6px
corner inside a till that is otherwise pills. They are pills now, still 44px.
`DiscountInput` is shared by all three tills and `/classic` is deliberately the
pre-redesign look, so this is a **`shape="go"` prop rather than a new default** —
the pattern `Button` and `ModeButton` already use.

### 2. The surfaces, inverted

The cart was a white sheet with paper panels. It is now the till's own ground
with **white cards on it**, measured at `rgb(245, 242, 235)` behind
`rgb(255, 255, 255)`. The `dark:bg-surface` override came off with it: in dark
the panels are `card` over `surface`, which is the project's own elevation rule
rather than a second one written for this screen.

### 3. A real route, and the trade that bought it

`/pos/cart` is a route. Not a drawer, not a query parameter.

**The till is mounted at `pos/layout.tsx`, not at a page.** A Next layout stays
mounted while you move between its child routes; a page is unmounted and
rebuilt. The sale — the lines, the customer, the discount, the coupon, the pass,
the points, the advance, the derivation and the whole checkout path — is one
1611-line component holding about 45 state hooks. Mounting it once at the layout
is what lets the cart be a route without that state having to survive an
unmount.

**The honest cost:** `pos/page.tsx` and `pos/cart/page.tsx` exist to declare the
routes and render `null`. Both carry a comment saying why. `/pos/complete` and
`/pos/payment` are ordinary child routes and render normally through
`{children}`.

**The alternative, and why not now:** lifting the sale into a provider is a
refactor of the **money path**, not of routing — roughly 700 lines including
`buildInputs`, the discount stack, `buildSale` and `charge`. This repo pushes
straight to `main` with no review gate and no tests but these harnesses. That is
a bad trade to make inside a styling request. The URLs do not change when that
refactor happens, so it is free to happen later.

Full-bleed, no rounded lip and no drag handle: those are the grammar of a sheet
you pull up, and this is a destination. `lg:inset-auto` keeps the tablet's
sticky side panel from inheriting the phone's `inset-0`.

### Back is now the truth

`openCart` pushes `/pos/cart`; `closeCart` is `router.back()`. Measured:
`history.length` goes 2 → 3 on open and stays 3 on Back, landing on `/pos` with
the sale intact — so the phone's own back button does what the label says
instead of leaving the till mid-sale.

**A transient worth recording:** one run reported Back landing on `about:blank`,
which would have been much worse than the `push` it replaced. It did not
reproduce — the dev server was still compiling and the click landed before
hydration. Re-running gave `/pos` with "2 items". A single red result from a
harness that races a rebuild is not evidence.

### Verified

- **The money path still works after the route change**, which is the only
  thing that mattered: a full sale — sheet → cart page → cash → complete — sold
  Yoga Session down from 20 to 3 and the grid card badged itself **Limited**.
- Route behaviour: `/pos` → pill → `/pos/cart` with the sale intact
  (৳1,725.00) → Back → `/pos` still reading "2 items" → forward → `/pos/cart`.
- At 1024 **both routes render identically** — grid plus sticky panel, panel at
  `sticky@12px`, no x-scroll.
- POS audit at 390 light, 390 dark and 320: **only the declared white-on-ember
  exception**, zero A, zero B. Undo still restores the middle of three in place.
  45 sheet-renders clean. `tsc` and `build` clean, `eslint` identical to HEAD,
  i18n parity 0 missing / 0 extra across 30 namespaces.

### Housekeeping for whoever is next

Two stashes are sitting on this clone, both redundant:
`stash@{0}` (WIP on 4941167) and `stash@{1}` (WIP on acb8291, the BT-02 work
that is already on `main` — `ValidityOption`, `validityOptions` and `val_season`
are all in the tree). The second is almost certainly what produced the committed
merge-conflict markers found in this file on 6 September. Both are safe to drop.

**And a lesson worth keeping:** `git stash push` / `pop` around an `eslint`
baseline comparison failed twice this session because that stale stash conflicts
on pop, which leaves the tree in a state that *looks* like lost work. Compare
against a committed ref instead of stashing.

## The pale band above the cart (2026-09-07)

A screenshot with a red box around the strip between the cart's sticky header
and its first card: **"fix these UI errors, no need background shadows."**

### What it was

`.scroll-y-hint`, written two turns earlier and wrong the moment the cart
stopped being white.

It is the vertical twin of `.scroll-x-hint`: four backgrounds painted on the
scroller itself — two `linear-gradient`s in `var(--color-card)` that cover the
content at each end, and two `radial-gradient`s in `rgb(0 0 0 / 0.13)` that
sit still while the content moves under them, so a shadow appears only on the
side that still has something below it. No JS, no scroll listener. It was there
because the pinned payment bar was slicing the Total row in half, which reads
as a rendering fault rather than as "there is more below".

Then the cart inverted: paper ground, white cards. The cover gradient kept
painting `--color-card` — **white on paper** — so the trick that had been
invisible became a 28px pale band under the header with a soft shadow beneath
it. The class did exactly what it was written to do. It was the surface under
it that changed.

Removed from the scroller, and the rule deleted from `globals.css` rather than
left dead. `.scroll-x-hint` stays: the horizontal filter rail it paints is
still on card white, where the trick is still invisible.

The affordance it was buying is not lost. The lines are cards now, and a card
clipped by the payment bar reads as more-below on its own — a shape cut in half
is legible in a way a sliced line of text is not.

### Clear all moves below the lines

Same screenshot, same band. "Clear all" was a 44px right-aligned strip *above*
the first line — so the first thing at the top of a cart was the way to destroy
it, and it was half of what made that strip look like chrome.

It now follows the lines it acts on. Pulled up 8px, because the gap below it —
the panel's own padding, then the rule under it — was the same 12px as the gap
above, and a control spaced equally between two groups belongs to neither.
Measured after: 4px above, 12px below, still a 44px target.

### Not removed

The **card lift** (`--shadow-go` on `.go-surface`) stays. The shadow in the red
box was the painted background on the scroll container, not the elevation on the
cards, and the cards are what makes white-on-paper read as stacked rather than
as a patchwork. If the soft lift is also unwanted it is one token.

### Verified

- Computed style on the scroller: `background-image: none`. Grep: zero
  `scroll-y-hint` in `src/`. Rendered at 2× — clean paper from the header to
  the first card.
- Clear all: cancel keeps all three lines, confirm empties the sale, dialog
  copy intact, zero console errors.
- POS audit at 390 light, 390 dark and 320 — only the declared white-on-ember
  exception. Undo still restores the middle of three in place. 45 sheet-renders
  clean. `tsc` and `build` clean.

## The calendar, first pass — the clock, the chrome and the unreadable block (2026-09-07)

"Research schedule calendars UI and UX and properly improve the UI and UX of
the calendar." Measured first, at three widths and both themes, because a
calendar's problems are quantities.

| | desktop | tablet | phone |
|---|---|---|---|
| chrome before the grid | 281px (31%) | 337px (42%) | 520px (**62%**) |
| blocks clipping their own title | 16/28 | 19/28 | **26/27** |
| narrowest block | 53px | 35px | **21px** |

And `scrollTop: 0` against `scrollHeight: 945` — the grid opened at 06:00 while
the venue's first booking is at 08:00, so the first thing on screen was empty
morning and every booking was below the fold.

### The calendar did not know what day it was

`DEMO_TODAY`'s own comment warns that "two components each holding their own
copy" is the bug. All three grids called `new Date()`. In the demo that is a
date the seeded week never contains, so **no column was ever today, the
current-time line never drew once, and the button labelled Today jumped to a
day the grid did not agree was today**.

`demoNow()` now lives beside `DEMO_TODAY` — the demo's date at 12:00, the hour
the till already pins itself to — and the page passes it to all three grids.
Today marks in week and month; the now-line draws.

The now-line is `info`, not `ember` and not `danger`: the legend already spends
ember on Booked and danger on Session closed, and the clock is neither.

### Opening where the day is

`tradingWindow` derives the drawn hours from the products' own
`startTime`/`endTime` instead of a hardcoded 06→23. It lands on the same 06→23
here, which is the point — it was right by coincidence and is right by
derivation now.

Deliberately **not** narrowed to the busy hours: a manager checking whether
07:00 is free needs to see that it is empty. The cure for an empty morning is
`focusMinute` — scroll to now when the window contains it, otherwise to the
first thing booked, a quarter-viewport down for context. `scrollTop` 0 → 315.

### You could not read a booking, and hover was the only recovery

The Critical rule is that distinguishing names need complete access by a
*visible* path. A 53px block clipped its name and offered a `title` tooltip,
which a touch screen never shows.

`EventDetail` — click a block, get the whole name, the status **in words**, the
time range, the day, the party and the resource, then Close or Open order.
Verified end to end: an 81px block showing a clipped "Planetarium Show" opens a
panel reading "Planetarium Show / BOOKED / 11:45 – 12:30 · Thursday 30 July /
3 guests", nothing clipped inside it, Escape closes.

Clicking used to navigate straight to the order — a whole page load to answer
"what is this?". Now reading is free and going is one more click. Every block
also carries a complete `aria-label`, so the accessible name never truncates
even where the visible one does.

### Chrome

The nav and the label it changes were 60px apart — arrows in the page header,
range beside the tabs. They share one row now, range between the arrows, as a
`aria-live` region because stepping a week changes nothing else a screen reader
would announce.

The three selects fold behind a Filters disclosure with a count of how many are
set. The five-state key stays out on desktop: it is the legend, and hiding it
makes five colours unreadable. On a phone it folds in with the selects, where
it was costing three 44px rows of a screen that was already 62% chrome.

### The day view was eight empty lanes

Every active resource got a row whether the day touched it or not, so the
bookings sat below the fold under eight blank courts, and 17 hours × 76px + a
160px name column needed 1,452px inside 1,250px — the evening ran off the right
edge.

Empty lanes fold, with "Show 6 empty"; out-of-service lanes never fold, because
"nothing booked" and "closed today" must not look the same. `HOUR_PX` 76 → 60
so the whole trading day fits the width it has. Clipped blocks there: 10 → 3.

### A phone does not get a seven-column time grid

47px per column, 21px when two share an hour. What survived read "Badm", "S",
"S". Week now uses the shape the month view already uses here and every pocket
calendar settled on: a day strip carrying each day's load as dots, and a list
underneath where the name wraps instead of truncating. **26 clipped → 0.**

### Two of my own regressions, caught by measuring again

- The subtitle second line I added to week blocks pushed tablet clipping 19 →
  23 and phone 26 → 38. `lanes === 1` is not "wide enough" — a 1024 column is
  97px. Gated on a real breakpoint (`XL`, 80rem) and it went back to 16.
- The arrived tick I added to satisfy "never status by colour alone" ate a 29px
  day-view block whole, leaving a green tick and no name at all. Icons are now
  gated on the room left for the name; a block reading "Yog" says more than a
  lone tick.
- Lint caught a third: the compact early return sat above the scroll hooks, so
  crossing 768px would have changed hook order. Moved below them.

### After

| | desktop | tablet | phone |
|---|---|---|---|
| chrome before the grid | 236px (26%) | 257px (32%) | 400px (47%) |
| week blocks clipping | 16 | 16 | **0** |
| day blocks clipping | **3** | 4 | 0 |

Contrast measured across every text node in the card, both themes: **zero**
below its threshold. The today pill is `text-ink` on ember at 5.30:1, not white
at 3.50:1. `tsc`, `build` and `eslint` clean on every file touched; i18n parity
0 missing / 0 extra across 30 namespaces.

## The calendar, second pass — wrap, one row, and the filter that looked like an empty week (2026-09-07)

### Wrap before truncating

The rule for a name that distinguishes one booking from another says to wrap or
stack it, and only then to clip. A 45-minute block is 39px tall — two lines of
12px text — so the title now takes both when the block is tall and is not
already spending its second line on the subtitle.

Desktop week clipping **16 → 12**, with nine blocks now on two lines. "Private
eve" reads "Private event"; "Bowling" in a narrow Friday column reads "Bowling
Lane". What still clips is genuinely long — "Grand Heritage Architecture Tour"
in a 53px three-abreast column — and that is what the detail panel is for.

### One row for the day view too

"By resource / By booking" had a row of its own, which is the whole reason the
day view carried 32% chrome against the week's 26%. It is a filter on how the
day is grouped, so it sits on the filter row. Day chrome **32% → 26%**.

### An empty grid caused by a filter looked like an empty week

The worst of the three was Day: switch every state off and the card collapsed to
88px of bare hour axis under a lone "Show 8 empty". Week and Month drew a
perfectly ordinary empty grid — and *that* is the real defect, because a week
with nothing in it and a week whose contents you have filtered away are the
same picture.

Now, when the window is empty and something is filtering: "No bookings match
these filters — nothing in this view is in one of the states you have left
switched on", with the way back. The toolbar's own Clear filters stands down
while that notice is up rather than offering the same button twice. Day names
its empty state instead of showing an axis over nothing.

### Verified

Keyboard end to end: Tab reaches an event block with a 2px ember focus ring,
Enter opens the detail panel (`aria-modal`), Escape closes it. Contrast across
every text node in the card, both themes: **zero** below threshold. Detail panel
still resolves a clipped 81px "Planetarium Show" in full. Filters: closed at
rest, `aria-expanded` tracks, 35 nodes → 7, badge "Filters (1)"; the phone gets
the tone key folded in beside the selects. `tsc`, `build`, `eslint` clean on
every file touched; i18n parity 0 / 0 across 30 namespaces.
---

## Multi-slot selection, a date strip that never scrolls, and the money made loud (2026-09-07)

### 1. Slots became a set, not a choice (`/sell`, BT-04)

Tap an hour to take it, tap it again to give it back, and the set **survives
changing the day** — so "Field 1 at six on Saturday and Field 2 at four on
Sunday" is one sale instead of two trips through the same screen.

The model change is that a **block can now resolve to several lines**.
`Resolved.item` became `Resolved.items`, and each picked slot carries its own
date and becomes its own booking line — which is also what holds capacity for
every one of them rather than only the last. Where a block yields several lines
the id is suffixed, so each keeps a stable identity across renders.

Three affordances the set needs and a single choice does not:
- **Days already carrying part of the sale are dotted in the date strip**, so a
  multi-day selection is legible from the picker rather than only from the list.
- **A "Chosen slots" panel** lists everything taken across every day, with a
  remove on each — the only place a slot on a day you have since left can be
  given back.
- **The collapsed block says "3 slots · 2 days"** rather than listing them,
  which would turn the summary back into the thing it was collapsed to avoid.

This does **not** use the shared `SlotMatrix`. That component asks for a single
answer and is used by the other two tills, so teaching it a second mode would
put one variant's behaviour inside everybody's component.

**Where else this makes sense:** provider appointments (BT-10) are the same
shape — a fixed price per slot, no per-slot quantities — and would take it
cleanly. Fixed sessions (BT-03/09) are *not* the same: they also carry ticket
quantities, so "3 sessions × 2 Adult" needs deciding (per slot, or shared?)
before it can be honest. Flexible duration already has repeat-weekly, and each
span would need its own length, so it wants a different control.

**Verified**: three slots across two days = ৳4,500 + VAT ৳675 = ৳5,175, sold as
**three separate booking lines**; re-tapping a slot removed it (৳3,450) and
tapping again restored it. A struck-through Saturday 18:00 correctly refused —
that is the seeded turf-sharing booking, not a bug.

**A defect this exposed:** the three lines read *"Cricket · Outdoor Field"*
three times on the receipt, differing only by a time that was not printed.
Lines now carry their slot, because three identical charges is what a receipt
dispute is made of.

### 2. No horizontal scrolling, in any till

New shared **`DateStrip`** (`components/ui`), used by all three: a wrapping grid
of five days with the calendar as a **full-width row beneath**, never a row that
scrolls sideways. `Today` and `Tomorrow` are named rather than dated, because
that is what a cashier and a customer both say out loud.

The scrolling row it replaces had two faults: a chip that has scrolled out of
view is a day nobody knows is on offer, and the calendar sat at the **end** of
that scroll — so reaching any date past the fifth meant scrolling past four you
did not want to find the control that offers all of them.

The **category chip rows** in all three tills now wrap too. Measured after: zero
horizontal scrollers on `/sell`, `/pos` and `/classic`. The one exception is the
**seat map**, a 12-wide spatial diagram that must scroll — the same declared
exception it already carried.

`dateBtn` and its `moreDates` state are gone from both ProductSheets.

### 3. The pay panel leads with the money

On a part-paid sale the total is context and **the amount to collect is the
answer**, so the emphasis follows the money rather than the arithmetic: subtotal,
VAT, total and balance drop to muted rows, and **"Collect now"** becomes the
figure — 24px, in an ember wash. Paid in full they are the same number and
printing it twice says nothing, so there is exactly one loud line either way.

**"Tendered" is gone**, in every till — it is a ledger word, not a counter word.
It reads **"Cash received"** now (`pos.cash.tendered` retargeted, so v1 and
classic get it too).

And the sticky footer stopped disagreeing with the panel: it showed *"Total
৳3,450"* beside a button reading *"Take ৳1,950"* — two different numbers side by
side, the easiest kind of misread at a counter. It now shows what the button is
about to take, labelled "To collect".

### Verified

`tsc` and `npm run build` clean. `(classic)` and `(go)/sell` lint with **zero
problems**; `(go)/pos` is **identical before and after** (7 problems both sides,
confirmed by stashing), so none of this touched its documented baseline. i18n
parity 0 missing / 0 extra with the new keys in both locales.

## The calendar, third pass — filled blocks, cards and a hover card (2026-09-08)

Five reference shots and four asks: dashboard cards with the important numbers,
full-colour blocks instead of a bar down one edge, a popup on hover, and a
smoother surface generally.

### Filled, not flagged

The code argued against this in a comment — "the bar carries the status and the
fill stays calm; a month of attended bookings tinted green is a wall of the
least actionable thing on screen". The owner asked for the opposite and is
right about the effect: a grid of white rectangles reads as a table, a grid of
tinted ones reads as a schedule. The comment now records that the decision
changed and why.

New `--color-*-wash` tokens per tone in both themes, written out rather than
taken as an alpha of the base colour — the status colours are 700/800-level and
10% of a dark green over paper is a grey-green, not a pastel. Hatching survives
on the two blocked tones as texture *over* the fill: it is the app's "you
cannot have this" signal, used the same way on out-of-service lanes.

**Colour still means status, not service.** In the references it means service
(Yoga pink, Zumba yellow) with status as a separate dropdown — but here the
five-state key *is* the filter, so a fill that disagreed with the legend would
break the one control that explains the colours. Flagged for the owner as the
alternative it is.

### Two things the fill broke, caught by measuring

- **Dark mode contrast fell to 4.1:1** on every block subtitle. `text-muted` is
  tuned against the card, not against a tinted fill. Subtitles went back to a
  dimmed inherit, which composites against whatever fill it is actually sitting
  on: 6.2:1 dark, 6.3:1 light, and zero failures across both themes.
- **Today's column tint was ember, and so is every booked block now**, so
  Wednesday's bookings sank into their own background. The column tint is gone;
  the header pill and brand weekday still mark the day.

### Cards

Four figures for the window on screen — bookings, attended, no-shows, held
capacity — each against the previous equivalent window, so they move when you
step a week rather than reporting a fixed "last 7 days" unrelated to where you
navigated. Counted before the state toggles apply: switching "no-show" off is a
way of looking at the grid, not a claim that there were none.

The first build cost 144px of desktop and 280px of phone — **81% of a phone was
chrome**. Rebuilt at two lines: the period line went because the toolbar states
the range directly beneath it, and the comparison moved up beside the delta it
qualifies. Phone gets one scrolling row rather than two rows of cards. Desktop
36%, phone 58% — still more than the 26/47% before the cards, which is the
honest price of having them.

### The hover card

Blocks are 53–165px wide, so most cannot say their own name. Clicking already
opened the full panel; hover now answers the cheaper question without one.
Placed beside the block, flipped when it would run off the right, clamped
inside the window, and derived from props rather than held in state.

**Pointer only.** `mouseenter` fires on tap, which would put a card under the
finger at the same moment the tap opens the panel behind it. Verified on an
emulated iPhone: tap gives `{peek: false, dialog: true}`.

### Verified

Contrast across every text node in the grid, both themes: zero below threshold.
Peek: full name, status in words, range, day and party, nothing clipped, inside
the viewport at both a middle and a right-edge block, clears on leave. Keyboard
unchanged — Tab to a block, 2px ember ring, Enter opens, Escape closes. Filter
empty-state notice still fires in all three views. `tsc`, `build` and `eslint`
clean; i18n parity 0 / 0 across 30 namespaces.

**Harness note:** the stat cards are `.card-surface` too, so every probe that
said `querySelector(".card-surface")` silently began measuring a stat card
instead of the grid — one of them reported "0 low-contrast" while measuring the
wrong element entirely. All four now take the tallest card. A harness that
quietly changes what it measures is worse than one that fails.
