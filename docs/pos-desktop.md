# Counterfoil POS (Go) on a desktop — research, rules and screens

The owner, 2026-10-25: redesign every POS/Go desktop screen as world-class, modern, minimal,
calm SaaS — researched against Shopify POS, foodpanda's POS, the best SaaS desktops, and
booking and ticketing box offices, with the theories behind them. The colour system does not
change. The phone and tablet-upright screens do not change (docs/mobile.md §5).

"Desktop" here means the `rail` variant: at least 1024px wide and landscape — a counter
tablet held sideways, a laptop, or a desktop monitor.

## 1. Research

| Source | What it does | What we take |
|---|---|---|
| Square POS / Square for Retail | Item grid on the left; "Current sale" panel docked right with the lines and one Charge button carrying the amount | Grid left, sale right, one primary with the money on it |
| Shopify POS | Smart grid of tiles; cart docked right; checkout opens as its own focused screen with the amount large and tender options | A focused checkout, not a sheet sliding up from the floor |
| foodpanda / Toast / D.CC references | A white left sidebar with the store first, sections, and the user at the foot; a cart panel with order type, customer, items, totals, promo and one "Proceed payment" | A real sidebar on a desktop; customer and promo live with the sale |
| Lightspeed / Loyverse | Search always visible; the sale panel never scrolls its pay button away | A sticky foot on the sale panel |
| ROLLER, Gateway Galaxy, Clorian, Spektrix, Tixly (attractions and box office) | A date at the top of selling; sessions with capacity left on each; a basket that names date and time per line; a seat or slot picker in a drawer, not a new page | The sell date stays a first-class control; a booking opens in a side drawer beside the sale |
| Linear, Stripe, Shopify admin (SaaS) | Quiet white chrome, one accent, sentence-case headings, 24px gutters, collapsible sidebar | The admin console's own rhythm, so OS and Go read as one product |

Theories applied:
- **Jakob's law** — cashiers already know grid-left / sale-right; do not invent a new layout.
- **Fitts's law** — the pay button is large and pinned bottom-right of the sale panel, where the
  hand ends every sale; frequent controls sit at edges and corners.
- **Hick's law** — few choices on screen at once; secondary actions behind one menu.
- **Gestalt: common region and proximity** — one card per group; space inside a group smaller
  than space between groups.
- **Serial position / F-pattern** — the page title and the most-used control top-left; money
  and the primary action on the right.
- **Recognition over recall (Nielsen)** — every icon has a word beside it on a desktop.
- **Doherty threshold** — feedback under 400ms: a tap adds instantly, the line animates in.
- **Aesthetic–usability effect** — calm, aligned, consistent screens are trusted and read as
  easier; nothing decorative that does not carry meaning.

## 2. Rules

1. **Shell.** A white sidebar (the OS chrome colour) replaces the 88px icon rail:
   - top: the counter picker (counter name, venue under it) — no logo, as the owner decided;
   - destinations with an icon and a word: Sell, Schedule, Scan, Check in; a hairline; then
     My sales, My requests, Shift, Quick pass, Reservations, Settings (till settings), Help;
   - foot: the shift line (on shift for 3:24, End shift) and the signed-in person (avatar,
     name, role) with a menu (My profile, Switch user, Till design, Design system).
   - 248px from 1280px; from 1024 to 1279 it is a 72px icon rail with tooltips.
   - Selection is the OS recipe (`NAV_SELECTED`): a light neutral fill and a semibold label.
   - The More sheet and the phone tab bar stay exactly as they are below `rail`.
2. **Top bar.** On a desktop there is no separate floating header row: the sidebar carries the
   counter and the person; the page header (`GoPageHeader`) carries the title. The developer's
   page-state picker and the till-design switch sit at the sidebar foot.
3. **Pages.** Every page sits in `GoPage` (24px gutter; full / wide 1200 / narrow 880) with a
   `GoPageHeader` (title 24px, a quiet subtitle, actions right, one primary rightmost).
4. **Sell.** Three regions: sidebar | the wall | the sale panel.
   - The wall: one toolbar row — sell date, search (wide), Held — then the grid (auto-fill
     cards, 200–240px wide). Shop items keep their quiet "Shop" heading. No category chips.
   - The sale panel: 384px, white, full height, docked to the right edge, its own scroll.
     Head: "Current sale" and the item count, Pause and Clear in a menu. Lines as compact rows
     (picture, name, date/time, stepper, price). Foot pinned: subtotal, VAT, total, and one
     orange "Take ৳X" the width of the panel. Empty: a quiet illustration line, not a big card.
   - A booking opens in a **right-hand drawer** over the wall (480–560px), footer pinned, so the
     sale stays visible.
   - **Checkout** opens as a centred two-column dialog (about 880px): left, the sale summary
     (lines, customer, discount, promo code, totals); right, how they pay, how much now, cash
     received and change, then Complete sale. Same steps and same order as the phone.
5. **Schedule, Check in, Scan, My sales and the rest** use the full width they are given: the
   board edge to edge; lists as one card of rows with a summary panel on the right; forms
   centred at 880px. No stray empty columns; no content floating in the middle of a wide screen.
6. **Calm.** Sentence-case headings, 16px card titles, 13px muted secondary text, one orange
   primary per screen, no boxes inside boxes, hairlines instead of borders where a list is in a
   card, 44px minimum targets (the till is touch at every width), 13px reading floor.
7. **Unchanged.** Colours and tokens; the flows (what a cashier taps, in what order); every
   data-attribute and accessible name the regression scripts use, unless the screen it named
   is redesigned (then the script is updated to the new design, never loosened).

## 8. Round two: a desktop is not a big phone (2026-11-05)

Owner review: cards too big, buttons too big, the booking drawer and the popups "weird", the
schedule shows too few hours, checkout and sale complete waste the screen, and Scan and Check in
should be one place. The phone (below `rail`) does not change; every rule here is `rail:` only.

Research behind it: Square, Shopify and Toast on a desktop mark a choice with a tint and an
outline and keep solid colour for the one action that finishes the step; Meetup merged its
attendee list and its check-in list into one view with scanning beside it; Campus Labs and
FooEvents put the scan box and the attendee list in one screen on a tablet; Guest Manager leads
with arrived / not arrived counts.

1. **Sizes.** Controls 40px (`h-10`); options in a toolbar or segmented control 36px (`h-9`);
   the primary action in a footer 44px (`h-11`). No 56–64px buttons, no 88px icon tiles.
   Labels 14px medium; section labels 14px semibold; secondary text 13px muted.
2. **Choosing.** `TILE_CHOSEN` (Tiles.tsx): a brand tint, a 2px orange ring and brand text; no
   tick. Solid orange is only the screen's one primary action and a count badge. A segmented
   control (Lanes / Fields / Courts) uses the kit's neutral segmented look, not orange.
3. **Dialogs and drawers.** No drag handle on a desktop. Head: title 16px semibold, an optional
   13px muted line, a 36px close button. Body padding 20px. Foot: buttons right-aligned, 40px,
   the secondary outlined then the primary. Widths: small 440, medium 560, large 960.
4. **Cards on the wall.** Auto-fill from 10rem, 12px gap, picture 16:10, name 14px, price 16px,
   a 28px round mark.
5. **Floating bars** (a chosen slot on the schedule): one row, 56px, words left, buttons right.
6. **Use the width.** Checkout and Sale complete are two columns on a desktop with everything
   on one screen; the schedule board fills the height under one compact toolbar.
7. **Scan and Check in are one destination on a desktop**: the scan panel and today's
   arrivals side by side.

As built (2026-11-05): the wall is 4 cards a row beside the sale panel at 1366–1440 (≈180×220,
was ≈210×320); lane tiles stay 4 a row so their status reads in full; the schedule board keeps
full-width columns (a 360px cap left an empty field); the Hold dialog is 440px; free board cells
show their price on hover and focus only; `/scan` on a desktop renders the combined Check in
screen; the scan logic lives once in `scan/_components/ScanPanel.tsx`.

## 9. Round three: typography and the checkout in the sale panel (2026-11-05)

Owner: the checkout dialog is too wide and odd ("or do the checkout in the right side where the
cart is"); New customer should open in place, not as another popup; a chosen schedule slot should
be rounded; the schedule's session blocks have no hierarchy; and every POS desktop page needs a
typography pass.

Research: hierarchy comes from weight and colour as much as size; labels are de-emphasised and
values emphasised; a lighter weight reads as disabled, so secondary text steps down in colour, not
weight below 400; data-dense screens use four sizes or fewer and three weights or fewer per
component, tabular figures for money. Square, Toast and Lightspeed take payment in the same
right-hand panel that held the sale, so the item wall stays in view and nothing jumps.

An audit of eleven POS pages (1440×900) found: two near-black text colours (body inherited the
brand ink #141413; components use fg #22211f), so the till root now sets `text-fg`; adjacent
lines with the same size and weight (reservations names and times, my-sales names and amounts,
schedule times and seats); 16px button words on a desktop; values and labels at the same weight;
the chosen option on settings and profile white on solid orange at 3.5:1.

1. **Text roles** live in `(go)/_components/type.ts` (`T.page`, `T.card`, `T.item`, `T.body`,
   `T.meta`, `T.label`, `T.caption`, `T.button`, `T.price`, `T.total`, `T.stat`, `T.status`).
   Every POS desktop text uses one. Desktop buttons are 14px.
2. **Checkout on a desktop happens in the sale panel**: "Take ৳X" turns the panel into the
   payment step (Back, To pay, customer / discount / promo, how they pay, how much now, cash
   received, Complete sale). No dialog. The phone keeps its own flow.
3. **New customer opens in place**, inside the customer picker, under the search.
4. **A chosen slot on the board is rounded**, inset from the grid lines.

## 10. Round four: fewer decisions after a sale, one door screen on every device (2026-11-05)

- **Till settings → After a sale** (per device, `lib/prefs` `printAuto` / `sendAuto`): print
  Off · Receipt · Tickets · Both; send Off · SMS · Email · Both. Square, Shopify POS and
  Lightspeed set the receipt default per register so the post-sale screen is one decision.
- **Sale complete**: one header row (result and amount left; Print ▾, Send ▾ and New sale right),
  a status line for what already happened automatically, then the receipt and the tickets.
- **Check in list**: one white card; each session is a quiet sticky header (time, name, "4 of 4
  in", a slim bar, chevron); parties are fixed-column rows (name and code, people, status,
  action, menu) so actions line up. On a desktop the row action is a neutral 36px button: a
  solid orange button on every row would be ten primaries on one screen.
- **Phone**: Scan and Check in are one tab; `/checkin` opens on Scan with a Scan | Arrivals
  switch.
- **My sales**: Today | Yesterday, a KPI strip (sales, number, average, items, refunds, with the
  change against the period before), the drawer, payment methods, a searchable transactions
  table whose actions sit in a row menu, best sellers.
- Fixed: the sell-date calendar opened half above the screen (a `fixed` popup inside the blurred
  toolbar is positioned against the toolbar; it is now portalled to the body); the schedule's
  resource switch is a standard pill segmented control that does not shrink and clip.

## 11. Round five: grounds, names and two-fact buttons (2026-11-05)

- **Three grounds in a grouped list** (check-in): page, a white card with a 1px edge, and
  session headers on a tint halfway between the two (Polaris draws grouped lists this way), so a
  header never reads as a hole in the card.
- **A code is never a title**: a party with no name is "Guest" (an order behind it) or "Walk-in",
  with the code under it in 13px regular monospace.
- **Phone check-in**: filters are one row of 40px chips; rows are name + status, one meta line,
  then a 40px neutral action and the menu.
- **Two-fact buttons** (a day and its date, a time and places left): one fixed height, both lines
  centred, the main fact 14px 600 over the detail 13px muted, never truncated; three across on the
  storefront so "Tomorrow" fits. `app/s/_components/flow/tile.ts` holds the anatomy.
- **My requests**: a segmented control with counts, short cards (item and amount, kind and time
  with status, the reason, details folded), the narrow page measure on a desktop.
