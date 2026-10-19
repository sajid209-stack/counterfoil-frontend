# Refunds and write-offs

How Counterfoil handles money going back to a guest (a refund) and money the
business stops chasing (a write-off), in OS (desktop and phone) and in the POS.
This is the spec for both lanes; the contract is in `src/lib/api/refundRequests.ts`,
`src/lib/api/writeOffRequests.ts` and `src/lib/api/refundPolicy.ts`.

## 1. What the research says

| Product | What we take |
|---|---|
| Shopify admin | A refund starts from the sale, line by line; the amount can be edited down; the reason is internal. One primary action. |
| Shopify POS | Each staff action is **Allowed**, **Denied** or **Approval required** per role. We already have this for refunds (`counterRefund`); write-offs get the same three. |
| Square | Partial and per-item refunds; who may refund is a role permission. |
| Stripe | A refund has a status (pending, succeeded, failed, cancelled), the list filters by status, and the reason is one hover away. |
| Foodpanda (customer side) | What customers hate is slow, templated replies. So every request carries a **respond-by time**, and an overdue one is the first thing a manager sees. |
| AR write-off practice | A write-off has a category, a note, an approver, and an amount threshold above which someone senior must approve. |

The backend team's admin (screenshots, 2026-10-19) has the right model and the
wrong surface: every button is orange, filters are orange pills, everything is a
tall card in a narrow column, and dates read "Oct 18, 2026, 11:38 PM". We keep the
model and fix the surface.

## 2. The model

**A refund request** asks for money back on one sale. Three kinds, because the
counter meets three situations:

| Scope | When | On approval |
|---|---|---|
| `booking` | Cancel a booked slot (a court at 7 PM) | Refund the booking's lines in full, cancel the booking (its slot goes back on sale), void its tickets |
| `tickets` | Give back some tickets on an order (2 of 4 entry tickets) | Refund those tickets' share of their line, void those tickets |
| `goodwill` | Make up for something without cancelling (lights out for 20 minutes) | Refund an amount; tickets stay valid; nothing is cancelled |

The amount for `booking` and `tickets` is **worked out, never typed** — it is
what was paid for those lines or tickets, less earlier refunds. Only `goodwill`
takes a typed amount, capped at what is still held on the sale. A manager may
approve a goodwill request for less (never more); a booking or ticket refund is
approved whole or declined, because a part-refund would void a ticket for part
of its price.

**A write-off request** asks to stop chasing a balance that is still owed. It
names the sale, an amount up to what is owed, a category
(uncollectible, customer dispute, business decision, administrative) and a note.
Approving it calls the existing `writeOffOrder`. A manager may approve less.

Both have the same life:

```
pending ──approve──▶ approved      (refund: refunded · write-off: written off)
   │ ──decline/reject─▶ declined
   │ ──counter takes it back─▶ withdrawn
   └ ──nobody decided by the auto-close time─▶ expired   (derived on read)
```

**One open request per booking** (refund) and **one per sale** (write-off).

## 3. Timing — Settings → Refunds & write-offs (`RefundPolicy`)

| Setting | Default | What it does |
|---|---|---|
| Counter can ask for a refund | Until the booking starts | `before_start` · `until_end` · `any_time`. After it, the POS says why it cannot ask. |
| Answer requests within | 24 hours | Sets each request's `dueAt`. Past it, the request reads **Overdue** and sorts first. |
| If nobody answers | Keep waiting | Or close automatically after N days (status `expired`, the counter is told). |
| Refund back to | The way they paid | Or cash at the counter. |
| Counter write-offs need approval above | ৳0 (always) | A counter write-off at or under this amount goes through without a manager. |

Who may ask, or act directly, is per role (Settings → Roles → At the counter):
`counterRefund` (exists), `counterWriteOff` (new), each Off / Ask a manager / Do it.

## 4. OS

Two new menu items, top level, after Issued orders: **Refunds** and
**Write-offs**, each with a count badge of what is waiting. Orders keeps a
one-line banner ("3 refunds waiting · Review") instead of the old queue.

**List page** (desktop): title; a quiet summary line ("5 waiting · ৳2,340 ·
1 overdue"); underline **Tabs** with counts — Waiting · Refunded/Written off ·
Declined · All; search (sale number, guest, reason) and Filters (reason/category,
asked by, scope). The list is a table: guest and booking, amount, reason, asked
by, asked (relative time), respond-by chip (`Due in 3 h` / `Overdue`), status.
Oldest first in Waiting; newest first elsewhere. A row opens the detail.

**Detail**: a right-hand sheet on desktop, full-screen sheet on a phone.
Amount large; status; what (booking, slot, place, tickets) with a link to the
sale; why (reason and note) with who asked and when; the policy check
("Asked 5 h before the slot"); a short timeline; the consequence in one line
("Cancels the booking and voids 2 tickets" / "Tickets stay valid").
Actions in a sticky footer: **one primary** (Refund ৳X / Write off ৳X), a
secondary "Different amount" where allowed, and a soft-danger Decline/Reject
that asks why. Never three orange buttons.

**Phone**: the same, as one card of two-line rows; tabs scroll; the detail sheet
holds the actions at the bottom.

## 5. POS

- **Ask for a refund** from a booked slot (Schedule sheet), a party (Check-in
  menu), a scanned ticket (Scan verdict) and a recent sale (My sales). The sheet
  asks: what (Cancel the booking · Some tickets · An amount, tickets stay valid),
  why (reason tiles), a note, then **Send to a manager** — or **Refund ৳X now**
  where the role may do it directly.
- **Ask to write off** from a balance due (Check-in Due rows, the Schedule
  balance sheet): category tiles, amount (defaults to all that is owed), note.
- **My requests** (More sheet): what this counter asked, with status, so the
  cashier can tell the guest what the manager decided. A slot or party with a
  waiting request says so ("Refund asked").

## 6. As built (2026-10-19)

| Part | Where |
|---|---|
| Contract | `src/lib/api/refundRequests.ts`, `writeOffRequests.ts`, `refundPolicy.ts`; `orders.ts` gains `refundOrderTickets`, `refundOrderAmount`, `ticketShares`; `tickets.ts` gains `voidTickets`; `Role.counterWriteOff` and `counterAction(role, "writeOff")` |
| OS lists and details | `/refunds`, `/write-offs` (`src/app/(os)/refunds`, `src/app/(os)/write-offs`); menu items with a waiting count after Orders; `?open=<id>` opens a request |
| Orders | one-line banner (`orders/_components/RequestsBanner.tsx`); the old queue (`components/RefundRequests.tsx`) now answers move requests only; the order page has a Requests card |
| Settings | `/settings/refunds` (Refunds & write-offs) and the "Write off what a guest owes" row in Roles |
| POS | `(go)/_components/RefundFlowSheet.tsx` (three choices), `WriteOffSheet.tsx`, `RequestNotes.tsx`; `/my-requests` in the More sheet; "Ask for a refund" on My sales |

Decisions taken while building:
- A refund never gives back more than came in. On a part-paid booking, cancelling refunds what was paid; the lines still leave the sale.
- A goodwill refund is a negative line at the sale's VAT rate plus a negative payment, so the sale falls with the money and the order does not then read as owing it.
- `expired` is derived when read, from the auto-close setting; it is never stored. Waiting lists are oldest first, the others newest first.
- Demo requests (three waiting refunds including one goodwill, one declined; two waiting write-offs, one rejected) are made on first read from the seeded bookings, picked by id, never by `rand()`. None is approved: an approved request moves money.
- The scanned-ticket entry point (§5) was not built: refunds at the gate are rare, and Check-in, the Schedule and My sales cover the counter.
