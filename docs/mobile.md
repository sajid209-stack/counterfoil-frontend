# Counterfoil on a phone — research, audit and rules

Spec for the mobile pass of 2026-10-17. It covers Counterfoil OS (the admin) and
Counterfoil GO (the till) at phone widths, 320–430px. It sits on top of
`docs/design-system.md`; nothing here changes a colour, a token value or a component's
desktop behaviour.

## 1. What the research says, and what we take from it

| Source | Pattern | Why it works | What we take |
|---|---|---|---|
| Shopify admin, mobile web | Page name in a slim top bar; the page's one create action as a **labelled** pill beside it ("Add customer"); everything else under "⋯" | The label is information scent: you know what the button does before you press it | The phone bar's primary becomes a labelled pill when its label is short, an icon disc otherwise |
| Shopify admin, mobile web | Lists are one card of two-line rows; status shown as a chip **only when it is the exception** | A column of identical "Active" chips is noise; the eye should land on the row that is different | Catalog and other lists drop the chip for the normal state |
| Shopify admin, mobile web | The menu is a sheet: destinations first, account and tools last | Hick's law: the first options are the ones you came for | The menu sheet puts the venue and destinations first and moves the page-state tool to the foot |
| Shopify POS | Header carries search, scan and connectivity; theme is a setting, not a header button | The header is for the sale; preferences are set once | GO drops the light/dark button from the phone header (it lives in Display & language) |
| Shopify POS | Cart: lines, then the totals, one primary button with the amount on it; extras (customer, note) are rows, not open fields | Progressive disclosure: an empty field invites a question nobody asked | Checkout's promo code becomes a row that opens a field, like Discount already does |
| Shopify POS | More: daily tools first (customers, analytics, register, staff), settings and support last | Frequency order | GO's More sheet leads with sales, shift and quick pass; design tools move to the end |
| Square, Foodpanda | Figures are short and all visible; a number is never cut mid-word | A clipped label ("Transa…") reads as a fault, and a clipped figure is a different figure | Figure bands never scroll sideways or clip on a phone: a 2-column grid of compact cells |
| Apple HIG, Material 3 | 44 × 44pt targets; one primary action per view; bottom actions reachable by thumb | Fitts's law and one-handed use | Already held across both apps (audit: 0 targets under 44px outside Activity) |

## 2. Audit (390 × 844, light; overlays included)

Measured first: no page scrolls sideways, no text is clipped by the page, no console errors on any
of 21 screens. The problems are about hierarchy and noise, not breakage.

### OS

| # | Problem | Where | Severity | Fix |
|---|---|---|---|---|
| O1 | Figure bands scroll sideways and cut a figure or label mid-word ("Transa…", "Arrived 7 of…", "Averag…") | Dashboard, Orders, Analytics | High | 2-column grid of compact cells on a phone; all figures visible |
| O2 | The phone bar's create action is an unlabelled orange disc | Every list page with a primary | Medium | Labelled pill when the label fits ("Add customer"), icon disc otherwise |
| O3 | "Published" chip on every catalog row, plus two channel glyphs and a menu: four marks per row, and names truncated to "Beginner Swim Co…" | Catalog | Medium | Chip only for the exception (Not published); the name wraps to two lines |
| O4 | The developer page-state control sits second in the menu sheet, above every destination | Menu sheet | Medium | Move it to the foot of the sheet |
| O5 | "Today / This week" is a full-width orange bar — the loudest thing on the dashboard | Dashboard | Low | Compact control sized to its options, right-aligned with the date |
| O6 | Six targets under 44px (the expand chevrons) | Activity log | Medium | Rows open on tap; 44px targets |
| O7 | Filters sheet: the Date section's button says "Date" under a "Date" heading | Every FilterBar sheet | Low | The button states the current value ("Any time", "Last 30 days") |
| O8 | Stock counts read "15 each", and an empty count reads a red "none" | Inventory | Low | "15 in stock"; "Out of stock" |

### GO

| # | Problem | Where | Severity | Fix |
|---|---|---|---|---|
| G1 | A light/dark button in the header on every screen | All GO screens | Medium | Remove from the phone header; it is in Display & language |
| G2 | A day-limited booking's sheet shows the heading "Choose a time slot" with nothing under it | Booking sheet (e.g. Yoga Session) | High | Draw the heading only when there are slots |
| G3 | The promo code is an always-open field in checkout | Checkout sheet | Low | A row that opens the field, like Discount |
| G4 | More sheet leads with Till design and Design System, and carries the page-state tool | More sheet | Medium | Daily tools first; design tools and page state at the end |

Kept on purpose: the floating menu button (Shopify's own pattern; pages pad so it never covers a
last row), the orange selected segment (the owner's decision of 2026-10-13), the camera viewport on
Scan (the owner's decision; drawn even without a camera so the layout never jumps), and the docked
64px tab bar.

## 3. Rules for phone layouts

**Both products**

- A figure is never cut and never hidden behind a sideways scroll on a phone. Figures go in a
  2-column grid of compact cells (12px label, 18px value); an odd last cell spans both columns.
- A status chip marks the exception. The normal state of a list ("Published", "Active") has no chip.
- Names that tell rows apart wrap to two lines before they truncate.
- Developer tools (page state, till design, design system) never come before what the person
  came to do.

**OS**

- The top bar holds the page name, at most one labelled primary, "⋯" and the account. Long labels
  fall back to the icon disc with the label as its accessible name.
- Filters live in the sheet; every control in it states its current value.

**GO**

- The header holds the counter, search where the screen has it, and the person. Preferences are not
  in the header.
- Sheets show a question only when it has answers.
- Checkout shows the amount, how they pay, and Complete; customer, discount and promo code are rows
  that open in place.

## 4. The calm pass (2026-10-17, second round)

The owner's review of the first pass: a phone still shows too much and does not feel relaxing.
The first pass made every figure visible; this one decides which few deserve to be. It supersedes
the "all figures visible" rule in §3 for phones.

### Principles

1. **One screen, one job.** The first screen of a page answers its one question; everything
   else is a tap away (progressive disclosure), never deleted.
2. **Two figures, not six.** A phone shows the two figures a person acts on. The rest sit behind a
   quiet "Show all" text button that names how many — a disclosure, not a hidden value.
3. **The normal state is silent.** No chip for Paid, Unused, Confirmed, Published; a chip only
   for what needs attention (Part paid, Refunded, Used, Voided, Cancelled…).
4. **Nothing repeats what the page already says.** No date on every row when the page is "today";
   no legend that restates a bar's labels; no summary paragraph above a list of the same numbers.
5. **Fewer boxes, more air.** Prefer one card of rows over a stack of cards; prefer white space
   over borders; one accent colour per screen region.
6. **Lists start short.** Dashboard feeds show three rows, then "View all".
7. **POS cards are image-first.** A card is a picture, a name, a price and a round add button —
   the way every commerce app teaches people to buy.
8. **The POS tab bar floats.** A dark floating pill; the current tab is a light pill that names
   itself; the others are icons in fixed positions (staff learn positions, and the current
   tab is always named in words).

### Per page (phone only; ≥ 640px unchanged)

| Page | Calm change |
|---|---|
| Dashboard | Two figures (Sales, Places sold) + "Show all 4"; chart range is a small menu in the card header, not a 3-way bar; Activity and Recent orders show 3 rows |
| Orders | Two figures (Sales, Still owed) + "Show all 5"; no "Paid" chip on rows |
| Analytics | Two figures (Revenue, Orders) + "Show all 6" |
| Finances | Available and Unsettled only, with Withdraw and Deposit; Withdrawn/Deposited behind "Show all"; the history's summary paragraph goes |
| Issued orders | No "Unused" chip; Used and Voided keep theirs |
| Expenses | Total and the bar; the category legend behind "Where it went" |
| POS sell | Image-first cards with a round add button; All / Shop sized to its options |
| POS tab bar | Floating dark pill, current tab named |
| My sales | Payment methods with no sales are not listed |
| Arrivals | No date on each row; no "Confirmed" chip |

### Review round (2026-10-18)

An independent review of the calm pass in three voices (product designer, cashier, manager)
scored OS phone 7/10 and GO phone 6/10. Fixed after it:

| Where | Fix |
|---|---|
| GO sell wall | The Cart/Take bar and the tab pill read as one block over an opaque page-colour backdrop with a short fade; the wall's padding clears it, so no card shows between the bars |
| GO cards | A price never truncates (320px included); the round button is a "+" when one tap adds and a chevron when it opens a sheet; a card with no photo has a half-height plate; "Other amount" is a slim full-width row |
| GO tab bar | The pill has a 1px edge; More lights on every page opened from More |
| GO booking sheet | Past start times fold behind "Show N earlier times"; a booking with one court, lane or field drops the resource row; the footer states day, length and time |
| GO shop | "42 bottles left", not "42 bottle left" |
| OS menu button | Hides while scrolling down, returns on scroll up, at the top and bottom, and on focus |
| Finances | Days start collapsed on a phone; the order reference has its own line; no Today/Yesterday tag beside the date |
| Dashboard | No delta pill on a figure that is 0; the chart's menu says "Last 30 days"; no Activity filter on a phone |
| Customer | At a glance shows spent and orders, the rest only above 0; no empty Coming up card; no duplicate booking count |
| Booking record | Below 640px the eight tabs become one "Section" dropdown; zero-sale tickets fold into "N more with no sales"; no empty Coming up |
| Order | No status chip when fully paid |
| Team | The phone bar says "Invite" |
| Payments | "Always on" sits on its own line under Cash |
| Calendar | The selected Day/Week/Month is semibold ink |

Not taken, because they reverse earlier decisions of the owner: an outlined instead of orange
selected payment method, removing Arrivals, hiding the developer tools by role, and dropping the
price from the Schedule's free cells.

## 5. The till in one card language (2026-10-18)

The owner: the Sell page's new look should be the look of every POS phone screen — modern,
minimal, relaxing. The shared pieces are `src/app/(go)/_components/Tiles.tsx`.

1. **The page is the ground; every group is its own white card** (`GoCard`, `card-surface`, the
   GO card radius) with a 12px gap of page between cards. No box inside a box. No grid of cells
   joined by hairlines (the Schedule's hour board is the one exception: it is a timetable).
2. **Every choice is its own rounded tile** (`Tile`, `ActionTile`, `tileClass`) with 8px gaps:
   dates, times, lengths, lanes, ways to pay, notes, print and send, More destinations, staff on
   the sign-in screen, check-in counts.
3. **Chosen = solid orange, white text, a small tick.** Not available = the page colour, a line,
   no shadow, muted (struck where it is a time).
4. **Lists are one card per item**, like the wall: a cart line, a party at check-in, a ticket, an
   arrival — with a 48–56px picture or glyph where the thing has one.
5. **Headings are 16px semibold, sentence case, with no coloured eyebrow above them.** Secondary
   text is 13px muted. One orange primary per screen, bottom right or full width at the foot.
6. **Icons in a soft round** (40px, `bg-subtle`) when an action is drawn as a picture.
7. **No category chips on the till.** The wall shows everything; shop items sit under a quiet
   "Shop" heading.

### Owner update (2026-10-18, second message)
- **Dates are three tiles: Today · Tomorrow · More dates.** A date picked from More dates takes
  Tomorrow's place (chosen), so the row never grows past three.
- **No shop jump. A "Held" button (lock) sits beside the search instead**, shown only while this
  venue has places on hold (not the till's own checkout holds), carrying their count. It opens the
  list of what is held — who for, what, when, until when — and each can be sold (released and put
  in the cart) or put back on sale. Selling the shelf is by scrolling the wall or searching.
- **The scrolling till (/sell) speaks the cart till's card language** (§5).

## 6. OS on a phone, modern and minimal (2026-10-18)

The owner's references: separate rounded KPI cards with an icon and a change pill (Apixer), and
card-per-question dashboards with a period pill and compact tables (the dark/light Overview,
Customers, Orders, Payments sets). Same colours, same tokens; desktop and tablet (≥ 640px)
unchanged.

1. **Head.** The bar names the page; under it one quiet line with the date or scope ("Wed 29 Jul"),
   and the page's scope control as a small pill on the right (a menu, not a full-width bar).
2. **Figures are separate cards** in a 2-column grid, 8px apart: a 32px soft-round icon in a tint
   of the figure's own tone (top left), the change as a small pill (top right), the label in 13px
   muted, the value at 22–24px semibold. Four at most on a phone; more behind "Show all N".
3. **Charts are cards:** 16px semibold title on the left, the period as a pill menu on the right,
   the headline figure, a legend of dots where there is more than one series, a smooth line or
   rounded bars, dashed gridlines, quiet axes.
4. **Lists are cards:** a title with a small icon, then either two-line rows or a compact table
   (12px muted column heads, 14px rows, numbers right-aligned). Three to five rows, then "View all".
5. **Air:** 16px page gutter, 12px between cards, 16px inside them. No hairline-heavy blocks, no
   chip for a normal state, one accent per card.

**Pieces** (all in `src/components/ui`, all phone-only: from `sm` up they draw what they always did):

- `StatStrip` / `FigureBand` (and `MetricStrip` on the OS pages): each item takes an optional `icon` (a lucide
  glyph, 16px is applied) and `iconTone` (`"ember" | "success" | "info" | "warning" | "danger" | "neutral"`,
  default neutral). An item with no icon draws none. `delta` goes top-right, the label is 13px muted, the value
  is 20px at 320px and 24px from 360px. `FIGURES_SHOWN` is 4; the "Show all N" fold starts beyond it
  (`useFigureFold`, `FigureToggle`, which a page should draw only when `fold.folds`). The `data-stat-band`
  hook and `data-metric` / `data-figure` attributes are unchanged. `StatItem.tone` still colours the value;
  `iconTone` colours the icon.
- `PageShell`: `subtitle` (a line under the stood-down heading, e.g. the date) and `scope` (a node
  right-aligned on that line, usually a `PeriodPill`). Both are drawn below `sm` only; omit them and the page is
  unchanged. The page should draw its own desktop control in a `!phone` branch (`const phone = !useMediaQuery(SM)`,
  `SM` is exported from `@/lib/useMedia`).
- `PeriodPill` `({ value, onChange, options, label, align? })`: the kit `Select` as a 36px pill with a 44px target
  (`Select` gained `pill`, used with `bare`). `label` is its accessible name.
- Card patterns used by the figure pages: a card title can lead with a 28px soft icon that is `sm:hidden`
  (dashboard `CardIcon`); a card that is one block on desktop and two on a phone uses `card-surface` with
  `sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none` on the inner blocks (Expenses summary).
