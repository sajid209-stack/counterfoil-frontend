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

## 7. Phone shell v4 — the bar and the menu (2026-10-19)

The owner: the phone's top bar and the menu with its sub-menus look basic; every OS phone page
should be more modern and minimal. Desktop and tablet (≥ 768px) are unchanged.

### What the research says

| Source | What it does | What we take |
|---|---|---|
| Linear (iOS), Notion, Slack | The drawer opens on the workspace (a tile with its initials), groups destinations, and shows hierarchy as a disclosure: a chevron opens nested rows on a thin guide line | Workspace head; parents with a chevron; children on a guide line, shown only when the group is open |
| Shopify admin (mobile) | The bar always says which store you are looking at | The bar's second line names the venue on venue-scoped pages, and opens the venue picker |
| Apple HIG (inset grouped lists, navigation bars) | Rows live in white rounded groups on a grey ground; the bar gains its separator only once content scrolls under it | The menu is white cards on the paper ground; the bar's hairline appears on scroll |
| Material 3 navigation drawer | The current destination is marked by a filled indicator, not only by weight | The current page's icon tile is solid ink with a white glyph — the language of the till's tab bar, which the owner approved |
| Stripe / Mercury mobile | Account and preferences are one compact block at the foot, not a list of form fields | "You" card: avatar, name and role; Appearance and Language as two small segmented controls |

### Rules

1. **Bar** (53px, unchanged). Left: the page glyph in a 32px soft tile (`rounded-sm bg-subtle`, 6px corners),
   or the back arrow. Then two lines — the page name (15px/600) and, on venue-scoped pages, the
   venue (12px muted with a small chevron), which opens the venue picker. Right: the page's
   actions, unchanged. At rest no line; once the window has scrolled it gains a hairline and a
   soft shadow (`data-scrolled`).
2. **Menu sheet**: the paper ground with white rounded cards, 12px apart.
   - **Head**: a 40px business tile (initials, solid ink, white text), the business name (16/600)
     and "Counterfoil OS · N venues" (13px muted); a 40px round close button.
   - **Venue**: one row in a card — pin, "Venue", the venue's name, chevron — opening the picker.
   - **Destinations** (one card): parents are 48px rows — a 32px icon tile, the 15px label, the
     badge, and for a parent with children a separate 44px chevron button. The current page: its
     icon tile is solid ink with a white glyph and the label is 600; no row fill. Children are
     hidden until their group is open; the group holding the current page opens itself. Open
     children are 44px rows indented to the label column with a 1px guide line on the left; the
     current child has the light `nav-selected` fill and 600.
   - **Other apps**: three tiles in a 3-column grid (icon tile, label, ↗).
   - **Settings**: its own card row with a chevron.
   - **You**: avatar, name and role; Appearance and Language side by side as compact segmented
     controls; My profile and Sign out as rows.
   - Page state stays at the very foot, quiet.
3. **Menu button**: unchanged position and hide-on-scroll; 52px, frosted, with a small ink dot when
   a refund or write-off is waiting at the venue.
4. **Settings' phone section sheet** uses the same anatomy as the menu (icon tiles, ink tile for the
   current section, attention dots kept).
5. **Settings form rows**: the soft glyph is drawn only where the control sits at the row's right
   (a switch, a short value). A row whose field stacks under the label has no glyph, so the label
   and its field share one left edge.
6. **Calendar agenda**: a day is one white card of rows divided by hairlines — the time on the left,
   a 3px tone bar, then what and who. No grey boxes inside the card.

## 8. OS on a phone, v5: calm, flat, thumb-first (2026-11-08)

Owner: research the Shopify app, foodpanda and the best SaaS phone apps down to the pixel, and the
theory behind them, and redesign Counterfoil OS on a phone to be calmer, minimal, easy, with no
information overload. Colours do not change. Desktop and tablet (≥ md) do not change.

### What the references do, and why

| Detail (Shopify admin iOS unless noted) | Why it works | What we take |
|---|---|---|
| A floating dock at the foot: a round Search, a pill of 4 icon tabs (Home, Orders, Products, Menu), a round assistant; the current tab sits on a soft grey pill | Primary destinations always one thumb-tap away in the natural thumb zone (Hoober); NN/g: hidden navigation cut discoverability ~20% and made phone users 15% slower; Apple HIG: 3–5 tab destinations | A dock replaces the lone hamburger: Search ○ + [Home · Orders · Calendar · Catalog · Menu] |
| Large titles (≈34pt bold) at the top of each tab, collapsing to a small centred title as you scroll (iOS) | Says "you are at the top of this section"; the big title becomes chrome only once content needs the space | Large title 28/700 on top-level pages; a 44px compact bar with the 16/600 title fades in on scroll |
| Page actions as small round icon buttons in one pill (＋ ⋯) beside the title | One primary per screen, and it is not a shouting orange bar; actions are tools, not headlines | Phone actions become 40px round icon buttons in a pill; the words stay as the accessible name |
| Lists flat on white: no card per row, a date as a section heading, row = bold reference, one meta line split by thin rules, a grey status pill, the amount right in muted ink | A card per row repeats a border and a shadow per item and halves the density; whitespace and alignment group better than boxes (Gestalt proximity) | Lists are flat rows on the white page with inset hairlines; sections by day; one meta line |
| Search is a full-width pill with sort and filter icons inside; filters are a row of text tabs (All, Unfulfilled, Unpaid…), the current one on a grey pill | The commonest filters are one tap; the full filter set lives in a sheet so the list stays calm (progressive disclosure) | Search pill with a filter icon inside; quick-filter text tabs; the rest in the filter sheet |
| Sheets: a drag handle, a round close button top-left, a centred title, an optional round action top-right; the content is plain rows with chevrons | A consistent, predictable sheet frame; the close is where the thumb expects it and always the same | Kit Sheet on an OS phone: round 40px close left, centred 17/600 title, optional action right |
| Settings: a large title and plain rows (outline 24px icon, 17pt label, chevron), no cards; a sub-page has a round back button and a title; grouped content in rounded white cards with hairlines | Settings is navigation, not content — a list is the fastest scan | An OS phone has a Settings index list; a section is a sub-page with a round back button |
| Home: the numbers that matter as a horizontally scrolling row of figures above a chart, then "Here's your activity" | The day's state at a glance without a grid of boxes; one chart, not four | Dashboard: a scrolling figure row, the chart, then flat Activity and Recent orders lists |
| foodpanda: generous tap targets, sticky search, one primary action per screen, strong photography on item rows | Thumb ergonomics and recognisable items | 48px thumbnails on catalogue rows; ≥44px targets |
| Shopify POS: section labels as muted small text above plain rows; one full-width primary at the foot | Labels group; the primary is unmistakable and in the thumb zone | Section labels 13/500 muted; the one primary full-width at the foot of a form |

### Rules (below md, OS only)

1. **Ground.** The page is white (`card`), not the paper. A group that needs a container is a white
   rounded card (20px radius) with a 1px `line` edge and no shadow (inset grouped). No card per
   list row, no box inside a box.
2. **Type** (phone): large title 28/700, −0.02em; section heading 17/600; row title 16/600 (a
   reference or a name); body 15/400; meta 14/400 muted; caption and section labels 13/500 muted.
   Money: 15/600 in rows, 28/700 as a hero figure. Weights 400/500/600/700 only.
3. **Spacing.** 20px page gutter; 24px between sections; rows 60–72px with 12px vertical padding;
   hairlines inset to the text column; ≥44px targets everywhere.
4. **Navigation.** A floating dock 12px above the safe area: a 52px round Search (opens the command
   palette) and a pill of five 52px icon tabs — Home (dashboard), Orders, Calendar, Catalog, Menu
   (opens the existing menu sheet). Frosted card ground, 1px line, soft shadow. The current tab:
   `nav-selected` pill behind an ink icon; others muted. A waiting refund or write-off puts a dot
   on Orders. Each tab has its name as its accessible name. Pages keep room for the dock.
5. **Header.** Top-level pages open with the large title and, on venue-scoped pages, the venue
   under it (14px muted, chevron, opens the venue picker); the page's actions sit to the right of
   the title as 40px round icon buttons in one pill. A 44px compact bar (centred 16/600 title,
   back button on records) appears once the large title has scrolled away. Records (an order, a
   customer) open with a round back button and the title.
6. **Lists.** Flat rows on white with inset hairlines; a search pill with a filter icon inside; up
   to five quick-filter text tabs in a horizontal row (current on a grey pill); the full filter
   set in a sheet; dated lists grouped under day headings (15/600 muted).
7. **Sheets.** Round 40px close at the top-left, centred 17/600 title, optional round action at
   the top-right, the drag handle above. Content as plain rows.
8. **Figures.** No 2×2 grid of boxes on a phone: a horizontally scrolling row of figure chips
   (label 13 muted over value 20/700), or a single hero figure.

### As built (2026-11-08)

- **Shell** (`OsShell`, `MobileNav` `PhoneDock`, `PhoneBar`, `PageShell`, kit `Sheet`): white phone ground
  (dark keeps the darker page so cards still step out); `.card-surface` on an OS phone is an inset group
  (white, 1px line, 20px, no shadow — globals.css, `[data-os-shell]`); the dock (Search + Home · Orders ·
  Calendar · Catalog · Menu, the waiting dot on Orders); large titles with the venue line, a 44px compact
  bar on scroll (`--os-phone-bar`), page actions as round icon buttons; records get a round back and no
  venue line; OS sheets get a round close at the top-left and a centred title.
- **Lists** (`DataTable` phone branch, `PhoneRow`, `QuickTabs`, `FilterBar pill`): every table is flat
  rows on a phone; search pill with the filter inside; quick-filter tabs on Orders, Customers, Catalog;
  Orders grouped by day.
- **Dashboard and Analytics**: `MetricChips` (dashboard/_components/MetricStrip) — a sideways row of
  figure chips that grow to fit their figure; flat chart sections; "Here's your activity" lists.
- **Calendar**: soft round controls, a neutral Day/Week/Month switch, the strip and agenda edge to edge.
- **Settings**: `/settings` is a page — on a phone the list of sections (Shopify's anatomy); from md it
  moves on to Business. A section's back button returns to the list.

### v6: Counterfoil's own, not a copy (2026-11-08)

Owner: v5 copied Shopify too closely (the floating search circle and icon pill, the grey search pill
and chip tabs, round-close sheets with a centred title, even "Here's your activity"). Take the
principles, draw them in Counterfoil's language. What changed from v5:

| v5 (too close to Shopify) | v6 (Counterfoil) | Why it is better here |
|---|---|---|
| Floating round Search + a pill of bare icon tabs | A docked full-width tab bar with labels: Home · Orders · Calendar · Catalog · More; the current tab marked by a short ember bar on its top edge, as the till and the rail mark "here" | Labels are recognised faster than glyphs (an operator opens this a few times a day); the ember bar is the product's own sign for "here" |
| Search in the dock | Search at the top of every page, in the header's tool row | Where a phone looks for it, beside the page's own actions |
| Venue as a muted line under the title | The venue as a pin chip in the tool row | A multi-site attraction's scope reads as a control, and the title gets its line to itself |
| Grey search pill, chip tabs on grey pills | A 12px-radius white field with a hairline; Counterfoil's ember-underline tabs (as Refunds already had) | One tab language across the product |
| Grey status pills in rows | A coloured dot and the word in its tone | Status is a fact about a row, not its headline |
| Round close top-left, centred title | Title on the left (18/600), close as a soft square on the right; the menu head leads with the business tile | Reads left to right; the soft tile is the menu's own icon ground |
| "Good afternoon · …", "Here's your activity" | The date; "What's happening" | Our words |
| Plain figure chips | Each chip leads with a soft icon tile in the figure's tone (the §6 language) | Figures are told apart before a word is read |

### v7: quieter header, menu like the rail, one radius (2026-11-10)

Owner review of v6:
- **Header**: no search and no venue on phone pages; the venue is chosen in the menu only. One row:
  the way back on a record, the title, then a bell (the activity log, with an ember dot when a refund
  or write-off waits) and the page's primary action as an orange 40px button, the colour the desktop
  header's primary has. The dashboard's activity list moved behind the bell.
- **Menu** (the More tab): drawn like the desktop rail — plain 20px icons, rows with the rail's
  selected fill (`navStyles`), children indented under the label, sections separated by space and a
  small label; no cards, borders or guide lines. Other apps are rows with ↗.
- **Colour**: the primary action is ember on a phone as it is on a desktop; Day/Week/Month uses the
  desktop's ember-underline tabs.
- **One radius**: on an OS phone every container and control is 12px (`body:has([data-os-shell])`
  sets the radius tokens: control, inner, card, sheet, lg, xl, 2xl, 3xl). Round stays only for round
  things — avatars, dots, count badges, progress bars. The 3px and 6px steps stay for tiny marks.

### v8: a floating bar, a menu you close from the bottom, you in the header (2026-11-10)

- **Bar.** The idea taken from the best phone apps is the floating bar: a capsule 12px off the floor
  and 16px in from each side, frosted card with a line and the float shadow, so the page runs under
  it. The drawing is Counterfoil's: every tab keeps its name under its icon, and the current tab sits
  in a soft ember bubble with brand-text icon and name (ember marks "here"; a grey bubble would only
  mark "different"). The waiting count stays on Orders. `--os-fab-clear` is 90px + safe area; sticky
  save bars sit at 82px.
- **Menu.** No close at the top. Its foot, where the thumb already is, holds your profile (avatar
  + name, to /settings/profile) and a round close, over a fade from the sheet colour so the last
  rows dissolve instead of being cut. Other apps, Appearance and Language left the menu; Appearance
  and Language live on your profile. Sign out stays, last, in danger text. (`PhoneSheet` `foot`.)
- **Header.** Your profile sits beside the bell, the same 40px circle, initials on ink.
- **Page actions.** No longer in the header. `PhoneActionsSlot` (PageShell) puts them at the right
  end of the page's first toolbar row: the calendar's date row, every FilterBar's search row. A page
  without a slot gets its own right-aligned row above the content. Desktop is unchanged.

### v9: icon tabs, the venue in place, you as a menu (2026-11-10)

- **Bar.** Icons only, 24px; each tab keeps its name as its accessible name ("Orders, 4 waiting").
  Five truncated words ("Dashbo…") read slower than five glyphs learnt in a day. The current tab is a
  solid ember circle with a white icon (48px); idle tabs have no fill. On the current tab the Orders
  count turns ink so it does not vanish into the ember.
- **Venue.** A dropdown in place inside the menu, not a second sheet: the row's chevron turns, the
  venues open right under it indented like a parent's pages, the current one filled and ticked, one
  that has stopped selling says so. Choosing applies at once and folds the list; the menu stays open.
  `VenueSheet` is gone.
- **You.** The header's profile circle opens the account menu, the desktop bar's `AccountMenu` in
  its `person` variant: your name and "Signed in as …", Appearance, Language, My profile, Settings
  (the phone's list of sections) and Sign out. Tap outside or Escape closes it.

### v10: one rhythm (2026-11-10)

- **Menu spacing, on the 8pt grid.** Rows that are destinations are 48px and sit flush (0 gap; the
  fill marks the current one, so no gap is needed to tell rows apart); a parent's pages are 44px,
  flush under it. Groups are 16px apart: Venue · the business's pages · Settings + Sign out (both are
  about the account) · Page state. No stray padding under an open group.
- **Bar padding.** Each tab is its 48px circle, and the capsule pads every side by the same 6px, so
  the current circle sits concentric in the bar's round end (outer radius = inner radius +
  padding). The five circles spread edge to edge with equal gaps. Height unchanged (62px).
- **Venue picker.** A contained card 8px under the Venue row, on the row's own edges, rows split by
  hairlines. Each 56px option is led by the venue's initials (ink tile on the current one, soft on the
  rest), the name, then a "Not selling now" pill where it applies, and an ember tick on the current
  one. Choosing applies at once and folds the card.

- **v10.1 (2026-11-10):** the header bell hides on the Activity log itself (it would open the page
  you are on).

**v10.2 (2026-11-10):** Customers joins the tab bar (Dashboard, Orders, Calendar, Customers, Catalog, More). Below 360px the circles are 44px so six fit a 320 phone.

**v10.3 (2026-11-11):** the menu sheet enters in 360ms (iOS sheet curve) with the backdrop fading in and the foot rising in after it; it now EXITS too (200ms, accelerating, from wherever a drag let go) before unmounting; reduced motion closes at once. Analytics joins the tab bar: seven tabs, circles 48/44/40px at 430/360/320.
