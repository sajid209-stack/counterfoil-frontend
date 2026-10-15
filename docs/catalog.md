# Catalog: one booking system, one page per item, three ways to sell

Status: built 2026-10-14 (see PROJECT_LOG); the phases are listed at the end.
Audience: Counterfoil product and engineering (frontend and backend lanes).

## 1. The decision

Engineering decided that **every kind of catalogue item and every event is one booking system.**
Until now Counterfoil had two:

| | Bookings | Events |
|---|---|---|
| Record | `Product` (`lib/api/types.ts`) | `EventRecord` (`lib/api/events.ts`) |
| Created in | `/catalog/new/booking` (6-step wizard) | `/catalog/new/event` (2-pane designer) |
| Record page | `/catalog/bookings/[id]` (form tabs) | `/catalog/events/[id]` (sales record) + `/edit` |
| Public page | `/s/<venue>/<product>` (fixed design) | `/e/<slug>` (6 designed templates) |
| At the till | the sell wall, booking sheets | a separate "Event tickets" chip and `EventSheet` |
| Order lines | `productId` | `evt_<id>` |

An operator selling a sunset boat trip had to decide which half of the product it belonged
to before they could start. A venue with a weekly comedy night and a one-off festival kept
them in two places that worked differently. That ends.

**After:** an event is a kind of booking (`BT-15`, "on a date"). It is created, edited,
sold, reported and published exactly like every other item. What used to make events
special — a designed page, several days, tickets with their own capacity — becomes
available to every item, or stays specific to dated items where that is the only place it
means anything.

## 2. Three ideas the operator has to hold

Everything below follows from three ideas. The screens should teach them without a manual.

1. **What you sell.** One list: the Catalog. Each item has a kind (entry ticket, time slots,
   space to rent, appointment, course, pass, combo, guided tour, **event**).
2. **What its page looks like.** Every item has one product page — the page a customer
   reads before booking. It is designed **from the item**, in the Catalog. The Storefront
   settings design only the venue's front page (its headline, intro, colour and which
   items it lists). This is the Shopify split: the theme's home page versus each product's
   own template.
3. **Where it can be bought.** Two independent channels:
   - **At the counter** — on or off, and at which venues.
   - **Online** — one of three answers:
     - **On your storefront** — listed on the venue page, searchable, and at its own link.
     - **Only by its link** — not listed anywhere; anyone with the link can book. For
       private events, school groups, partner sales, a QR code on a poster.
     - **Not online.**

   This mirrors Shopify's *Active / Unlisted* status crossed with its *sales channels*: being
   listed and being sellable are different questions. A counter-only item is "Not online".

## 3. User stories

- **As a venue manager adding a weekly planetarium show,** I pick "Time slot tickets",
  answer when it runs and what it costs, choose to sell it at the counter and on my
  storefront, glance at its page (already good by default), and put it on sale in under
  three minutes.
- **As an events manager adding a two-day tech summit,** I pick "Conference" under
  *Events*, set the two days and the venue, add day passes and a both-days pass with
  their own numbers, choose a look for its page, write the programme, and publish — from
  the same screens a booking uses.
- **As a manager selling a private corporate night,** I choose *Online: Only by its link*,
  copy the link, and send it to the client. It never appears on our storefront.
- **As a manager with a counter-only parking pass,** I turn Online off. Nothing about a
  page is asked, because no customer will see one.
- **As a cashier,** events are tiles on the sell wall like everything else, and a sale of
  one is an ordinary order line.
- **As an accountant,** an event's takings appear in the same reports, by the same
  product, as everything else.
- **As a customer,** the link I was sent opens a page that looks like the venue's, lets me
  pick a day and tickets, and pays — whether or not the item is on the storefront.

## 4. Information architecture

```
Catalog (/catalog)                       one list, all kinds; filter by kind, state, where sold
├── Add (/catalog/new)                   one chooser: "Repeats on a schedule" · "Happens on a date"
│   └── /catalog/new/[kind]              one wizard for every kind
└── Item (/catalog/[id])                 one record page for every kind
      tabs: Overview · Details · When · Tickets & prices · Where it's sold · Page · Rules

Settings → Storefront                    the venue front page only (headline, intro, colour,
                                         which listed items appear, cover)

Public
├── /s/<venue>                           storefront: lists items whose online answer is "listed"
├── /s/<venue>/<item>                    the item's designed page, inside the storefront
└── /b/<item-slug>                       the item's own link: same page, no storefront chrome
```

Old addresses redirect: `/catalog/bookings/[id]` and `/catalog/events/[id]` → `/catalog/[id]`,
`/catalog/events/[id]/edit` → `/catalog/[id]?tab=details`, `/catalog/new/booking` and
`/catalog/new/event` → `/catalog/new/[kind]`, `/e/<slug>` → `/b/<slug>`.

## 5. The add flow (one wizard)

The rail beside every step is the item as it stands and **Ready to sell**, a checklist that
ticks off as each step is answered. Continue and Publish are never greyed out; pressed
early, they say what is missing and take the cursor there.

| # | Step | Asks | Shown for |
|---|---|---|---|
| 0 | **What are you adding?** | the chooser card (kind; for events, the kind of event) | all |
| 1 | **How it's booked** | the existing booking questions, pre-answered by the card | bookings (skipped for events and where the card answered it) |
| 2 | **Name** | name, one-line summary, photos | all |
| 3 | **When** | schedule (bookings) · dates, days and venue (events) | items that have a when |
| 4 | **Tickets & prices** | ticket types; for events each with a quantity, the days it admits and when sales stop | all |
| 5 | **Where it's sold** | counter (venues) · online: storefront / only by link / not online · the link | all |
| 6 | **Page** | look, colour, cover, sections and their words — with a live preview, phone and desktop | items sold online (skipped when "Not online") |
| 7 | **Check** | every answer as a row with Edit; Put on sale · Save, don't sell yet | all |

Design rules for the Page step:
- **It opens finished.** Every item gets a good default page from what is already known
  (name, photos, description, prices, policies, venue). The step is for improving it, never
  for filling it in. "Use this page" is the primary action.
- **Sample text is marked and never published unknowingly** (carried over from the event
  designer): a seeded section shows a *Sample* tag until edited, hidden or kept.
- **Looks are honest about the kind.** Events get the six designed looks (poster, floodlit,
  structured, editorial, chart, neon). Other bookings get *Standard* and *Showcase*.
- **The preview is the real renderer**, at a real device width, not a sketch of it.

## 6. The record page

One page for every item, opening on **Overview**: state, the next dates, what has sold and
what it took, the link and where it is listed, and the one primary action that applies
(Put on sale / Take off sale). Then the same answers as the wizard, editable, each tab with
the settings save bar. An event's Overview keeps today's sales record (ticket types with
sold bars, each day's grouped capacity, where it was bought).

## 7. The contract (frontend → backend)

Additive; every existing record stays valid with no migration.

```ts
type BookingTypeCode = … | "BT-15";          // on a date: one date or a run of days

interface PriceTier {                         // gains, all optional
  capacity?: number;        // BT-15: how many of this ticket exist
  openingSold?: number;     // sold before Counterfoil recorded sales
  dayIds?: ID[];            // BT-15: which days it admits (absent = all)
  salesEndsAt?: ISODateTime;
  perks?: string[];         // what it includes, listed
}

interface ProductDay { id: ID; date: ISODate; label?: string; opensAt: string; closesAt?: string }

interface Product {                           // gains, all optional
  days?: ProductDay[];      // BT-15, in order
  venueName?: string;       // BT-15: where it happens, in the operator's words
  venueAddress?: string;
  online?: "listed" | "link";   // when channels include "online"; absent = listed
  slug?: string;            // the item's own link /b/<slug>; unique per business
  page?: ProductPage;       // the designed page; absent = the default page
}

interface ProductPage {
  look: PageLook;           // "standard" | "showcase" | the six event looks
  accent?: string;          // hex; absent = the look's own
  coverImage?: string;      // absent = the first photo, then designed art
  tagline?: string;
  sections: PageSectionId[];    // shown, in order
  highlights, info, faq, lineup, stats, videoUrl, organiser, sponsors   // the content
  samples?: PageSectionId[];    // sections still showing seeded text
}
```

`EventRecord` and its resource are retired. Order lines for events become ordinary product
lines; the `evt_` prefix goes. The grouped day capacity, bundle saving and day helpers in
`lib/events/days` move to operate on a `Product`.

## 8. Phases

1. **Contract and data** — the types above; seed events become BT-15 products; the api,
   capacity and day helpers read products; reports and settlement by product.
2. **One catalogue in OS** — one list, one chooser, one wizard with the Page and Where-it's-sold
   steps, one record page; the event screens deleted; redirects.
3. **Public pages** — the designed page renderer for every item; `/s/<venue>/<item>` and
   `/b/<slug>`; the storefront lists only "listed" items; Storefront settings design only the
   front page.
4. **The till** — events as ordinary tiles; the event sheet reads a product.
5. **Review and verify** — screenshots and harnesses at phone and desktop, light and dark,
   English and Bangla; rounds of design review until nothing is left to fix; the full
   regression; the log.

## 9. Screen specs

These are the design decisions for each screen, made once here so every phase builds the same
product. Shared rules: the design system (`docs/design-system.md`); plain words
(`docs/plain-language.md`); 44px targets on a phone; nothing under 12px in OS; one primary
action per screen; nothing greyed out without saying why.

### 9.1 The list — `/catalog`

- **No Bookings / Events tabs.** They taught the split the decision removes. In their
  place, a **Type** filter inline beside search (All types · Entry tickets · Time slots ·
  Guided tours · Spaces · Appointments · Courses · Passes · Combos · Events), and in
  Filters: state (On sale · Needs attention · Off sale · Archived) and **Where it's sold**
  (Storefront · Link only · Counter · Not online).
- **A "Where it's sold" column** replaces nothing and earns its place: three small marks
  in a fixed order — storefront, link, counter — each with its word in the tooltip and
  accessible name, absent marks drawn as empty space so the column lines up. This is the
  new idea the operator most needs to see at a glance.
- Rows keep: thumbnail, name with the line under it, type, when, price from, selling
  (events: sold of capacity), state, row menu (Edit · Copy link · Duplicate · Put on sale /
  Take off sale · Archive).

### 9.2 The chooser — `/catalog/new`

One page, two groups, the same card style for both (the dark poster cards for events
looked like a different product):

- **Repeats on a schedule** — the eight booking kinds.
- **Happens on a date** — Concert or show · Sports or tournament · Conference or talk ·
  Exhibition · Trip or tour · Club night. Each card carries a small swatch of its page
  look, nothing more.

Search across both, "Not sure?" and "Copy something you already sell" stay. A card goes
to `/catalog/new/<kind>` (`/catalog/new/event?kind=sports` for events).

### 9.3 The wizard — `/catalog/new/<kind>`

One wizard for every kind (§5). Two steps are new for bookings and changed for events:

**Where it's sold** (`SellChannels`):

```
At the counter                      [switch]
  Sold at the counters of  ☑ Lalbagh Fort  ☐ Ahsan Manzil

Online
  ( ) On your storefront      Listed on your venue page, and at its own link.
  ( ) Only by its link        Not listed anywhere. Anyone with the link can book.
  ( ) Not online              Sold at the counter only.

  Its link   counterfoil.app/b/[ planetarium-show ]   Copy · Open
             Listed on: Lalbagh Fort's page        (when "On your storefront")
```

- The three online answers are radio cards: a choice of three meanings, not three
  switches. "Not online" with the counter off is refused in words.
- The link is shown whenever online is on, editable, checked for uniqueness as you type.
- Venues answer both "whose counters sell it" and "whose storefront lists it".

**Page** (`PageDesigner`) — the item's page, with the real page beside it:

```
┌ controls (360px) ───────────┐ ┌ preview ─────────────── [Phone | Desktop] ┐
│ Look      [Standard] …      │ │                                           │
│ Colour    ● ● ● ● ●         │ │      the real page, at a real width       │
│ Cover     [Use first photo] │ │                                           │
│ Line under the name [____]  │ │                                           │
│ Sections                    │ │                                           │
│  ≡ About            👁  ›   │ │                                           │
│  ≡ Highlights  Sample 👁 ›  │ │                                           │
│  ≡ Good to know     👁  ›   │ │                                           │
│  …                          │ │                                           │
└─────────────────────────────┘ └───────────────────────────────────────────┘
```

- It opens on a finished default page. The step's primary action is **Use this page**.
- Sections expand in place to edit their words; reorder with handles **and** Move up/down
  buttons (dragging is never the only way); the eye hides one. Hero and the booking panel
  are fixed.
- Standard page sections: About · Highlights · What's included (from ticket notes and
  perks) · Good to know (from policies, plus lines of your own) · Gallery · Video · FAQ ·
  Where (venue and map link). Event looks keep their own section sets (lineup, schedule,
  stats, sponsors…).
- On a phone the preview is a button that opens it full screen.

### 9.4 The record page — `/catalog/[id]`

Header: back to Catalog, name, state pill, the type, and one primary action (Put on sale /
Take off sale), with Copy link · View page · Duplicate · Archive under "⋯".

Tabs: **Overview** · Details · When · Tickets & prices · Where it's sold · Page · Rules
(and For support). Overview: what has sold and what it took, the next dates, the link and
where it is listed; for an event, today's sales record (ticket types with sold bars, each
day's grouped capacity, where it was bought). Every other tab edits its answers with the
settings save bar, using the same components as the wizard.

### 9.5 Public pages

- `/s/<venue>` lists items that are sold online **and listed**, at that venue. A link-only
  item is never on it, nor in its search.
- `/s/<venue>/<item>` and `/b/<slug>` render the same page through one component,
  `ProductPageView`. `/b/<slug>` has a slim header (the venue's mark, and "More at
  <venue>" only when the item is listed). Both book through the storefront's basket and
  checkout. A link-only page carries `noindex`.
- An event's page books a day and tickets (grouped capacity applies) through the same
  basket. The six event looks render through the existing event template.
- Settings → Storefront designs only the venue front page. Its list of featured items
  shows only listed items, and says so.

## 10. Revision 2 (2026-10-15): everything is a booking

Owner review of the first build: no types, no sales column, no preset gallery when adding,
and one page-design system for every booking, with settings for a countdown. This section
**supersedes** §4–§6 and §9 where they differ.

### 10.1 The rule

**There is one thing in the Catalog: a booking.** A concert, a planetarium show, a court by
the hour and a ten-visit pass are all bookings. They differ only in *how people book them*,
which is an answer inside the booking, not a type on it. Nothing in the Catalog shows,
filters or groups by type. `BT-xx` codes stay in the data as derived values, as they always
have (D6).

### 10.2 The list — `/catalog`

Columns: select · **Name** (photo, name, the line under it) · **When** · **Price from** ·
**Where it's sold** · **Status** · row menu. There is no Type column and no Sales column. Sales
live on each booking's Overview. Filters: status and where it's sold. There is no type filter.

### 10.3 Adding — `/catalog/new`

**Add booking** opens the wizard directly. There is no chooser page and no preset cards. The
steps:

1. **Name**: name, the line under it, description, photos.
2. **When**: first one plain question, *How do people book it?*, as a radio list, with its
   details opening underneath:
   - **Any day it's open**: no time to pick. Can be limited per day, or valid for a number of
     days.
   - **At set times**: start times on a schedule. Can have a guide per group.
   - **On a date**: one day or several days in a row, at a place you name.
   - **By the hour**: rent a field, court, lane or room.
   - **Time with a person**: an appointment with someone on the team.
   - *More ways* (a disclosure): a course of several dates · a pack of visits · several
     bookings sold together.
3. **Tickets & prices**: the same editor for every booking. A ticket can have a quantity, the
   days it is good for (on-a-date bookings) and a date when sales stop.
4. **Where it's sold**: unchanged.
5. **Page**: §10.5. Skipped when the booking is not online.
6. **Check**.

Old `/catalog/new/<kind>` addresses redirect to `/catalog/new`. Copying an existing booking is
the row menu's Duplicate.

### 10.4 The record — `/catalog/<id>`

The same tabs for every booking: Overview · Details · When · Tickets & prices · Where it's
sold · Page · Rules · For support. The header shows no type. The Overview has one layout for
everything: at a glance (price from, sold of the total where tickets have quantities, money
taken from orders), coming up (the next dates or days), its link, and sales by ticket.

### 10.5 The page designer — one system for every booking

- **Look**: seven looks for every booking, named for how they look, not what they are for:
  Classic · Poster · Floodlit · Clean · Gallery · Journey · Neon. Each shows a small preview.
  New bookings start on Classic.
- **Colour**, **cover photo**, **line under the name**.
- **Countdown** (settings):
  - Show a countdown: Off · To the first day (on-a-date bookings) · To a date and time you
    choose.
  - Label (e.g. "Starts in", "Offer ends in").
  - Hide it when it reaches zero (on by default).
  - The countdown is a section that can be placed anywhere in the order.
- **Sections**: one list for every booking, drawn by every look. About · Highlights · Numbers ·
  What's included · Good to know · Programme (people and times) · Photos · Video · Questions ·
  Where · Sponsors · Countdown. The top of the page and the booking panel are fixed. A section
  with nothing written in it is hidden by default. There is no sample text: a page shows only
  what the operator wrote, or what the booking already knows.

### 10.6 Contract changes

- `ProductPage.countdown?: { mode: "off" | "start" | "date"; at?: ISODateTime; label?: string;
  hideAtZero?: boolean }`. Absent means off, or "start" for an on-a-date booking whose page was
  designed before this.
- `ProductEvent.kind` becomes optional. It is no longer asked; it only picks a default look for
  old records.
- `PageLook` keeps its values (`"standard"` and the six look ids). Only the names shown change.
- One renderer contract: every look draws every section in `ALL_PAGE_SECTIONS` for any booking,
  through `pageView(product)`, which works for any booking (dates, venue and "when" are taken
  from the booking itself when it has no `event`).
