# Memberships

A membership is something a customer buys once and uses many times: unlimited
entry for a year, six visits a month, a family of four on one card. Counterfoil
has had the model since Milestone 2 (plans, renew, pause, cancel, the CF-M-
card at the gate, member prices at the counter). It was hidden behind
`FEATURES.memberships`. This is its menu, and the redesign of every screen.

Contract: `src/lib/api/memberships.ts` (plans, memberships, `viewOf`,
`membershipSummary`) and `src/lib/api/types.ts` (`MembershipTier`,
`Membership`, `MembershipView`). In the UI a tier is called a **plan**.

## 1. What the research says

| Product | What we take |
|---|---|
| Shopify Subscriptions | Plans and the people on them are managed in ONE place, not plans in settings and people elsewhere. A contract list is searchable by name or ID; a row opens a detail page that groups the actions by task and links to the customer. |
| Stripe Billing | Row actions live in an overflow menu, not as buttons on every row. Cancelling asks *when*: now, or at the end of the period. Pause is a different thing from cancel and is offered first, because a cancellation cannot be undone. |
| Mindbody, Glofox | Plans are defined by price, period and usage rules (visits, who it covers); the operator tracks renewals in one view. Their weakness is complexity: we keep the plan editor to what a venue needs. |
| Counterfoil's own lists (Catalog, Sequences, Refunds) | One sentence per row, status pills only for exceptions, phone rows not tables, a sheet or page for one record. |

## 2. Words

Plain-language rules apply (`docs/plain-language.md`).

| Don't write | Write |
|---|---|
| tier, subscription, contract | plan / membership |
| subscriber | member |
| lapsed, expired | ended |
| churn | did not renew |
| MRR | each month (as in "৳42,500 each month") |
| auto-renew | renews by itself |
| entitlement, benefit | what they get |

## 3. Information architecture

```
Memberships            /memberships                  overview + members
  └ Plans              /memberships/plans            the plans, as cards
                       /memberships/plans/new        a new plan
                       /memberships/plans/[id]       edit a plan
                       /memberships/new              add a member
                       /memberships/[id]             one membership
```

Memberships sits under Customers in the rail (members are customers). Plans
is its child, Shopify-style. `/settings/memberships` redirects to
`/memberships/plans`; the Settings entry is removed (one place, not two).

## 4. Screens

### 4.1 `/memberships` — overview and members

- **Header:** title, one line ("Who is a member, what they get, and whose
  membership ends soon."), primary **Add member**, secondary **Plans**.
- **Figures** (four, the same component the dashboard uses): **Members**
  (active, with "+N this month"), **Each month** (what active memberships are
  worth per month, `monthlyValue`), **Ending soon** (in 30 days, amber only
  when > 0, click filters), **Ended** (did not renew, click filters).
  Phone: the same four as a sideways-scrolling row.
- **Plans strip:** one compact card per plan: name, "৳3,500 a year",
  members on it, a thin bar of its share of members. Clicking filters the list
  to that plan; the active one is selected. A last quiet card "New plan".
  Phone: scrolls sideways.
- **Members list:** quick tabs **Active · Ending soon · Ended · Paused ·
  Cancelled** (with counts), search (name, code, plan, named people).
  Columns: **Member** (initials avatar, name, code in mono under it), **Plan**
  (name; "For 4 people" under it when > 1), **Visits** ("4 of 6 left" with a
  thin meter, or "Unlimited"), **Renews / Ends** (date, and "in 12 days" or
  "Ended 26 days ago" under it; "Renews by itself" icon when on), **Status**
  (pill only when not Active — Active is the normal state and stays quiet,
  except "Ends in 12 days" in amber), row menu (Open, Renew, Pause / Start
  again, Stop renewing, Cancel, Open customer).
  Row click opens `/memberships/[id]`. Phone: `PhoneRow` (avatar, name, plan ·
  ends, pill for exceptions, menu).
- **Empty** (no memberships at all): what a membership is, **Add member**, and
  **Create a plan** when there are no plans.

### 4.2 `/memberships/[id]` — one membership

- **Header:** back to Memberships, title = member's name, status pill, actions:
  **Renew** (primary only when ended or ending soon), more menu (Pause / Start
  again, Stop renewing / Renew by itself, Cancel membership, Open customer,
  Print card).
- **Left column:**
  - **The card:** a membership card drawn like the physical one: venue name,
    plan name, member name, code in mono, "Valid until 12 Dec 2026", on the
    brand ink surface (mode-locked like the ticket stub). It is what staff read
    out at the gate.
  - **Usage:** visits ("4 of 6 used this period", meter, "Resets 3 Dec"),
    guest passes ("1 of 2 used"), or "Unlimited entry".
  - **People on it** (family plans): the named people, editable (name and a
    short note like "Child"), up to the plan's limit.
  - **What they get:** the plan's benefits as plain lines (entry, discount,
    visits, guest passes) — read from the plan, with "Edit plan" link.
- **Right column (desktop) / below (phone):**
  - **Details:** plan (link), started, current period ends, renews by itself
    (switch), price, sold on (order link when `orderId`).
  - **History:** started · paused · started again · cancelled (with reason) —
    from the record's dates, newest first.
- **Cancel** is a dialog that offers the gentler choice first:
  **Stop renewing** (keeps access until the end date; `setMembershipAutoRenew
  false`) or **Cancel now** (ends today; needs a reason). Pause is offered as a
  line ("Going away for a while? Pause instead.").

### 4.3 `/memberships/new` — add a member

One page, three steps stacked, each answered in place (not a wizard):
1. **Who:** search customers (name or phone), pick one; or "New customer"
   (name, phone) inline. A customer with an active membership shows it and the
   choice to renew instead.
2. **Which plan:** plans as selectable cards (name, price a period, the one-line
   benefits).
3. **Details:** starts (today by default), people on it when the plan covers
   more than one (the member's name pre-filled first).
- A sticky summary/footer: "Friend of the Museum for Ayesha Siddika ·
  ৳3,500 · until 17 Nov 2027" and **Add member**. No payment is taken here
  (nothing is sold from OS); the summary says "Take payment at the counter."
  Done → the new membership's page.

### 4.4 `/memberships/plans` and the plan editor

- **Plans** page: plans as cards in a grid (name, price a period, the benefit
  lines, members on it, "Renews by itself", status: Selling / Not selling),
  primary **New plan**. Card opens the editor.
- **Editor** (`/memberships/plans/new`, `/memberships/plans/[id]`):
  sections in one column with a live preview card at the right (desktop) of
  the plan as a customer would see it, and the sentence summary:
  - **Name and description.**
  - **Price:** amount + period (Monthly · Every 3 months · Yearly · One time,
    lifetime).
  - **What's included:** entry — Unlimited visits / A number of visits each
    period (number) — which bookings an included visit is for (Every booking /
    Only some); **Member price**: % off, on Everything / Only some bookings.
  - **Who it covers:** One person / A family or group (up to N people);
    guest passes each period.
  - **Renewal:** Renews by itself (switch), remind the member N days before.
  - Save bar; **Stop selling** (archive) with members-on-it warning.

## 5. Mobile

Every screen works at 393px: figures and plans strips scroll sideways, lists
become `PhoneRow`s, the membership card is full width, the plan editor's
preview moves under the form, sticky bars clear the dock.

## 6. Seed

Three plans (Friend of the Museum, Family, Explorer) and about two dozen
memberships across every state, generated by index from the seeded customers
(never `rand()`), so the overview has real numbers.

## 7. As built

Shipped 2026-11-17. `FEATURES.memberships` is on, which also turns on member
pricing, selling a membership and the CF-M- gate at the till.

- **Menu:** Memberships sits under Customers with Plans as its child.
  Settings no longer has a Memberships entry; `/settings/memberships` is a
  307 to `/memberships/plans` in `next.config.ts`.
- **Files:** `src/app/(os)/memberships/` — `page.tsx` + `_components/list/`
  (Figures, PlansStrip, MembersTable, CancelDialog), `[id]` +
  `_components/detail/` (MembershipCard, UsageCard, PeopleCard, BenefitsCard,
  DetailsCard, HistoryCard, CancelDialog), `new` + `_components/new/`,
  `plans`, `plans/new`, `plans/[id]` + `_components/plans/` (PlanCard, PlanForm).
  Shared drawing in `_components/shared.tsx`. Messages: `membershipsList`,
  `membershipDetail`, `membershipPlans` (en + bn); the old `memberships`
  namespace still holds status words and benefit lines.
- **Contract additions** (`src/lib/api/memberships.ts`): `membershipSummary()`,
  `monthlyValueOf(tier)`, a `tierId` filter on `listMemberships`.
- **Seed:** 20 memberships written against the real today and taken
  un-rebased in `client.ts` (rebasing only moves all-past records, which
  double-shifted the ended ones). Active 14 · ending soon 6 · ended 3 ·
  paused 2 · cancelled 1 · about ৳8,000 a month.
- **Differences from §4:**
  - The overview figures are their own component (a sideways row on phones),
    not `FigureBand`, which is a 2×2 grid on phones.
  - The plan filter is a `FilterBar` filter, so its chip and Clear come from the kit.
  - The detail page puts the card and Usage side by side from `xl`.
  - Cancel dialogs: the list uses ChoiceCards, the detail page a `RadioGroup`.
    Both offer Stop renewing (default) / Cancel now (reason) / Pause instead.
  - History shows only what the record holds; "Started again" is not
    recorded (`resumeMembership` clears `pausedAt`).
  - Print card prints the whole page; isolating the card needs a print rule.
  - A recurring plan must cost more than ৳0; a one-time plan may be free.
- **Checks:** tsc, eslint, check-i18n, lint:tokens, `npm run build`; a
  14-step browser walk (scratchpad `seq/mwalk.mjs`: counts, plan filter,
  search, ended tab, add member end to end, renew from the row menu, new plan
  preview, settings redirect); screens seen at 1440 and 393, light, dark and
  Bangla. Bangla strings are not natively reviewed.
