# UI audit: OS, POS, storefront and auth (19 Nov 2026)

A pixel-level audit of every Counterfoil surface on desktop (1440) and phone (393), in light and
dark.

## Method

1. **Measured.** A headless sweep of 93 routes × 4 variants (372 page loads) checked:
   - text under 12px
   - WCAG contrast (4.5:1, or 3:1 for large text)
   - phone touch targets under 44px
   - sideways and hidden overflow
   - text clipped without an ellipsis
   - border radii outside the token scale
   - fonts outside the type stack
   - page errors
2. **Looked.** Three reviewers took one surface each (OS admin; POS and the classic till;
   storefront, product pages and auth). Each screenshotted its screens and their states (sheets,
   dialogs, menus, empty states, validation errors) in all four variants, fixed defects in its own
   files and re-checked them. The kit, global CSS and shared libraries were fixed centrally, so no
   two people edited one file.
3. **Re-measured.** The same sweep was run on a production build after the fixes.

## Result

| Check | Before | After |
|---|---|---|
| Text under 12px | 0 | 0 |
| Radius off the token scale | 0 | 0 |
| Fonts off the stack | 0 | 0 |
| Page errors | 0 | 0 |
| Phone touch targets < 44px | 142 | **0** |
| Contrast (outside the kept brand decision) | 17 | **2** (both are measuring artefacts) |

The 118 "clipped" and 4 "hidden overflow" hits are deliberate: labels that are `max-md:sr-only`,
and scroll strips that bleed to the screen edge on purpose.

## Fixed

**Kit (all surfaces)**
- **OS phone header:** the account avatar and the sheet close button get the same invisible 44px
  tap area as the bell and back buttons.
- **QuickTabs:** short tabs ("All") get a wider tap area.
- **Notice:** the link action is at least 44px wide on phones.
- **Sheet:** the title is centred on the close button. It sat 8–15px above it.
- **Modal:** the close button lines up with the title. It hung between the title and the
  description.
- **DataTable:** on right-aligned number columns the sort glyph goes before the label, so the header
  edge lines up with the figures. It sat 17px left of them.
- **FilterSearch:**
  - Chrome's navy clear button is replaced with a themed one.
  - A long placeholder ends in an ellipsis instead of being cut mid-word.
  - On phones the field fills its row.
- **PhoneRow meta:** every part can shrink to an ellipsis, so earlier parts are no longer cut
  mid-word.
- **PageToolbar:** carries the phone actions slot, so the create button sits beside the search on 10
  list pages instead of alone in an empty row.
- **Storefront brand ink:** also measured against the soft tint. The "Most popular" badge and the
  selected date chip were 4.26:1 and 4.40:1.

**OS**
- **Sidebar:** a parent and its child were both highlighted (Memberships and Plans). Now only the
  matching row is, and aria-current follows it.
- **/booking-rules and /pricing (phone):** rows were clipped mid-word; they are now proper phone rows.
- **/customers:** a filtered search with no result said "No customers yet". It now says "No
  customers found" and offers Clear filters, like /orders.
- **Settings sidebar:** the "Supervisor" caption on the selected row is readable (it was 3.85:1 in
  dark).
- **Tap targets:** /memberships "See all" and the /sequences "needs a look" link.

**POS**
- **Booking popup:**
  - the "10:30 PM" start-time chip wrapped onto two lines;
  - uneven gaps around the staff block (about 100px of dead space);
  - "Repeat weekly" sat flush under the last ticket row.
- **Cart:** line prices were top-aligned against centred names.
- **/my-sales:** the table header and rows were misaligned by up to 36px.
- **/my-requests:** "Take it back" was 40px tall.
- **/pos/complete:** the title row sat 6px off the action buttons.
- **Add-on stock:** "42 bottle left" now reads "42 bottles left" (plural rule).
- **Classic till:**
  - times were double-formatted ("Next 2:45 AM") and a raw ISO date showed;
  - unselected payment labels were 3.9:1, now 6:1.

**Storefront and auth**
- The footer's Counterfoil mark vanished on light venue pages when the app was in dark mode.
- Onboarding now matches the other auth screens: centred heading, field labels and control height.
- **Done page:**
  - on phones the two actions are equal full-width buttons;
  - a single ticket is centred instead of sitting in the left column of a two-column grid.
- Product page section tabs take their corner radius from the page style instead of a raw 10px.

## Decided, not changed

- **White on brand orange (#F94A00) is 3.5:1.** That is below 4.5:1 for small text on primary
  buttons, selected segments and chips, and badges. The owner kept the colour (19 Nov 2026). The
  accessible alternative, for the record, is brand-600 #D63D00 for solid fills (4.64:1), with
  #F94A00 kept for marks and accents.

## Noted for later

- The classic till's prices differ from the GO wall (base versus resolved price). Not investigated.
- On a 900px-tall desktop, /sell's sale panel scrolls internally and is tight.
- /settings/loyalty is missing from the settings registry, so its phone bar title reads "Settings".
  The page is feature-flagged out of the nav.
- Bangla strings added in this pass need a native review.
