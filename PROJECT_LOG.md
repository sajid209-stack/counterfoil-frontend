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
