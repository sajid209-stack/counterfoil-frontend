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
