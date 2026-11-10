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

## 12. My sales by date range, with Export and Print (2026-11-08)

Square's sales summary and Shopify POS's reports put one date-range control above the figures and
let the same range drive export and print. My sales does the same with the admin's own
`DateRangePicker` (named ranges beside a two-month calendar): Today, Yesterday, Last 7 days, This
week (from Monday), This month, Last month, or any dates drawn on the calendar; nothing after today.
- The figures compare with the same number of days just before the range; "nothing to compare
  with" is said once, under the lead figure.
- The cash drawer shows for today only.
- Over several days each sale shows its date and time, in a wider first column.
- **Export** saves the range's sales (and any search) as CSV: date, time, code, items, method,
  amount, refunded, status; amounts in major units; a byte-order mark so Excel reads Bangla and ৳.
- **Print** opens the whole list first, so the printout holds every sale in the range, and prints
  the range under the title.
- On a phone the range button takes the row and Export and Print are 44px icon buttons with names.

## 13. Arrivals v2: the day as an agenda (2026-11-10)

The owner: the arrivals list's dropdowns were bad UI and UX. What the best door and front-desk lists do
(OpenTable and Resy's host list, Mindbody and Zenoti's front desk, Luma's and Eventbrite Organizer's
check-in): every guest is on screen, grouped by time, with one obvious action per guest and the state
readable without reading. None of them makes the host open a group to find the person standing there.

- **No accordions.** Each session is a card; every party is visible. A finished session says
  "✓ Everyone's in" in its header instead of folding away. Search, filters and a scan still narrow
  the list, and a scan still marks the guest's row.
- **Time down the left** (desktop): a 5.5rem sticky column, so the session you are scrolling through
  stays named, the way the OS calendar's agenda reads. A phone has no room for a column, so the time
  leads the card's header as a chip.
- **A "Now" line** (today only), ember, between what has started and what is still to come: the
  question at a door is "who is next".
- **The row:** avatar · name over "size · (n of m in) · place · code" · ONE right-hand slot · menu.
  The slot is the action when there is something to do (Check in n / +1 / Take ৳…), else the status
  (All in / No-show). The old row put a "Not in yet" pill beside a "Check in" button and gave the head
  count its own column; together they cost the name ~14rem and truncated the code. The avatar carries
  the state at a glance: initials while expected, a success tick once in, a stop for a no-show.
- **Phone:** the same row stacked; a party with nothing to do is one line (status + menu), not a line
  and a lone "…".

Verified on a production build: f19663fb (ec29f026) scratchpad `pos/ci2.mjs` 20/20 at 1440, 1280 and
390 (every party visible, no expanders, time + progress per session, Now line with nothing started
after it, avatars, check-in flips the row), `pos/btn.mjs` 84/84.

## 14. Check in v3: one list, one card (2026-11-10)

The owner marked four things on the v2 desktop: the scan card and the arrivals column started at
different heights, the "Arrivals · Today" heading spent a row saying what the page title already
said, the filter chips were heavy (a loud orange "All"), and the time column was mostly empty space.
The phone carried the same weight: search, a date row and the chips stacked before the first guest.

What changed, and why (Linear and Luma's guest lists, Apple's segmented controls, Resy's host list):

- **One card holds the list.** Its top bar is the search and the filter, so the controls sit with
  what they act on. On a desktop its top lines up with the scan card beside it. The visible
  "Arrivals" heading is gone (kept for screen readers): the page title and the date already say it.
- **Sessions are sticky subheaders,** not cards: a thin tinted row with the time, the name and
  "n of m in" (or "✓ Everyone's in"). The 7rem time column is gone, so every row gets that width back.
- **The filter is a quiet segmented track:** grey track, the chosen option a white thumb. Orange
  stays for actions. 44px tall on a phone, 32px on a desktop.
- **Rows:** the action button sizes to its words, right-aligned; a done party shows plain coloured
  text ("✓ All in", "No-show"), not a pill. On a phone the check-in button sits on the guest's own
  line; only "Take ৳…" (a long label) gets a second line.
- **The Now rule** spans the card between what has started and what is to come.

**v3.1 (same day).** The owner: the grey session bands looked odd, and a hovered row (beige) merged
into the band above it. Sessions are now a quiet line on white (time in ink · name in grey, progress
right), separated by one hairline and space; rows are inset with a rounded hover tint and no rules
between them; the "…" is a ghost button, so each row has one outlined control: its action.
