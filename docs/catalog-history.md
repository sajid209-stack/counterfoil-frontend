# Catalog history

The History tab on a booking's record (`/catalog/<id>` → History). It answers three questions an
operator brings to it: **what changed, who changed it, and can I put it back.**

Reference implementation: `src/app/(os)/catalog/_components/history/`. Data contract:
`src/lib/api/catalogHistory.ts`.

---

## 1. What the current screen gets wrong

Reviewed from the production screenshot of `/catalog/configurations/<id>/edit` → History.

| # | Problem | Why it matters |
|---|---|---|
| 1 | **One event per field.** A single save at 12:48 pm appears as seven separate entries, each with its own name and timestamp. | One press of Save reads as seven actions. The list grows by the number of fields changed, not the number of decisions made, so it buries the one change someone is looking for. |
| 2 | **Ids instead of names.** "changed a ticket type `01a1ddc4`". | An operator thinks in "Foreigners", not in a uuid prefix. The id tells them nothing, in a monospace face that shouts. |
| 3 | **Raw enums.** `DRAFT → PUBLISHED`, uppercase. | Database values are not words. Draft/Published are states with meaning, and they should look like the status pill everywhere else. |
| 4 | **Strikethrough for the old value.** | Strikethrough says "wrong" or "deleted". The old value was neither; it was the value until then. It is also harder to read, and old values are exactly what someone comes to read. |
| 5 | **Change and change back shown as two events.** Foreigners → Foreign visitors → Foreigners. | It is noise: nothing is different afterwards. It should be one quiet line, not two entries. |
| 6 | **Every entry has the same weight.** Publishing the booking looks like editing a description. | Going live or off sale is the change people hunt for. It should be findable at a glance. |
| 7 | **No dates to scan by.** Every entry repeats the full date and time. | Twelve repeats of "17 Nov 2026" do not help anyone find "last Tuesday". |
| 8 | **No filtering, no "who".** | "When did the price change?" and "What did Rafi change?" are the two commonest questions. Both mean scrolling the whole list. |
| 9 | **The creation line sits at the top**, while the list runs newest first. | The beginning of the story is printed above its latest chapter. |
| 10 | **"changed the catalog"** with no detail. | An entry that does not say what changed is not history. |
| 11 | **No way back.** | Seeing that a price was wrong and then retyping it from memory is how a second mistake happens. |

## 2. How the best tools solve it

- **Google Docs / Notion version history.** Edits are grouped into **sessions** by person and time,
  and you can **restore** a version. Grouping is what makes a long history readable.
- **Linear and GitHub issue timelines.** Each change is **one sentence** ("changed status from Todo
  to In progress"). **State changes are visually distinct** from field edits, and relative times
  carry the full timestamp on hover.
- **Shopify and Stripe timelines.** Entries are under **day separators**, and a diff shows
  field · before · after. Stripe shows typed values (money as money), never raw JSON.
- **Contentful and Webflow entry versions.** Publishing events are **milestones**, and a version can
  be **compared and restored**, with a confirmation that lists exactly what will change.
- **Figma version history.** Autosaves collapse into sessions. Only meaningful points are shown
  expanded.

The common shape: **a session, written as a sentence, expandable to a typed diff, under a day
heading, with state changes as milestones and an undo that previews itself.**

## 3. Principles

1. **One decision, one entry.** Saves by the same person within 15 minutes are one session, and the
   session shows the **net** change: the value before the first save and after the last.
2. **Say it, then show it.** The header is a sentence in operator words. The diff underneath is for
   checking the detail.
3. **Names, never ids.** Ticket names are snapshotted when the change is made.
4. **Typed values, formatted for the reader.** Money as ৳, times as "48 hours", states as status
   pills, booleans as "On sale" / "Off sale". Long text gets a "Show full text" toggle.
5. **The old value is quiet, not crossed out.** Before is muted, after is full ink, with an arrow
   between them.
6. **Milestones stand out.** Published, moved to draft, archived and created get their own mark on
   the timeline.
7. **Undo is safe.** It previews exactly what it will put back, never removes tickets that took
   money, and is itself recorded.

## 4. Anatomy

### Desktop (md and up)

```
┌ History ───────────────────────────────────────────────┬ At a glance ──────────┐
│ [All] [Going live] [Prices & tickets] [Details]         │ Created 15 Nov 2026    │
│ [Rules] [Where sold] [Payment]       [Everyone ▾]       │  by Nadia Islam        │
│                                                         │ Last change 2 h ago    │
│ TODAY                                                   │  by Shemul Admin       │
│ (SA) Shemul Admin changed the price of Foreigners      │ 14 changes · 3 people  │
│ │    from ৳600 to ৳500                12:48 pm  ⋯       │  (NI)(SA)(RA)          │
│ │    Prices · Rules                                     │ On sale since 14 Nov   │
│ │    ┌ Foreigners · Price    ৳600  →  ৳500  −৳100 ┐      │                        │
│ │    │ Cancellation window   96 hours → 48 hours  │      │                        │
│ │    └ Also renamed Foreigners and changed it back┘      │                        │
│ YESTERDAY                                               │                        │
│ (●)  Rafi Ahmed put it on sale       ● On sale          │                        │
│ …                                                       │                        │
│ 15 NOV 2026                                             │                        │
│ (+)  Created by Nadia Islam                             │                        │
└─────────────────────────────────────────────────────────┴────────────────────────┘
```

- **Toolbar.** Area filter chips with the kit QuickTabs/filter chips: All · Going live ·
  Prices & tickets · Details · Rules · Where sold · Payment. A person filter (kit Select, "Everyone",
  then each person who appears in the history). The chips scroll sideways on a phone.
- **Day headings.** "Today", "Yesterday", then "Mon 17 Nov" (with the year when it is not this
  year). Small, uppercase-free, muted, sticky under the page bar.
- **Session row.**
  - Left gutter: a 32px avatar (initials) on a 1px vertical rail that joins the sessions.
  - Header: the sentence (see §5), then the time on the right ("12:48 pm", full date and time in
    `title` and `<time dateTime>`).
  - Under it, the area tags, plain muted words separated by " · ".
  - Diff (shown expanded for the newest three sessions; collapsed behind "Show 3 changes" for older
    ones): a two-column list with the field label on the left ("Foreigners · Price") and
    `before → after` on the right. Before is muted, after is fg/medium. Money changes get a
    neutral delta chip with a sign (−৳100, +৳50). A price change is neither good nor bad, so it
    carries no success or warning colour.
  - Net-zero note: "Also renamed Foreigners and changed it back." in muted small text, inside the
    diff.
  - Overflow (⋯): "Undo these changes…" and "Open Prices tab" (jumps to the tab that edits the
    first changed area).
- **Milestones** (status changes, archived, created) have a marker instead of an avatar: a
  coloured disc with an icon. On sale is a success tone with a Globe icon. Off sale / draft is
  neutral with an EyeOff icon. Archived is neutral with an Archive icon. Created is the brand wash
  with a Sparkles icon. The header still names the person: "Rafi Ahmed put it on sale". The new
  state is shown as the same status pill the catalog list uses.
- **Creation** is the last item, at the bottom of the rail where the story begins. With no actor
  it reads: "Created on 15 Nov 2026, 11:53 am", followed by the muted note "Who created it wasn't
  recorded. It was made before changes were tracked."
- **At a glance** (right rail, 280px, sticky): created (when, by whom), last change (relative, by
  whom), the count of changes and people (an avatar stack with names on hover), and since when it
  has been in its current state ("On sale since 14 Nov").
- **More.** 20 sessions at first, then a "Show older changes" button.

### Phone (below md)

- No right rail. At a glance becomes one summary line under the title: "14 changes by 3 people ·
  last 2 h ago".
- The filter chips scroll horizontally. The person filter is a compact select on its own row.
- Sessions are full width. The diff stacks: the field label on one line, `before → after` on the
  next. Overflow actions are a ⋯ button (44px target).
- Undo opens a bottom Sheet. On desktop it is a Modal.

## 5. Wording

The session sentence is built from its net changes:

| Net changes | Sentence |
|---|---|
| One price | **Shemul Admin** changed the price of **Foreigners** from ৳600 to ৳500 |
| One rename | **Shemul Admin** renamed **Foreign visitors** to **Foreigners** |
| One field | **Shemul Admin** changed the **cancellation window** |
| Status on | **Rafi Ahmed** put it on sale |
| Status off | **Rafi Ahmed** took it off sale |
| Archived | **Rafi Ahmed** archived it |
| Ticket added / removed | **Nadia Islam** added the **Child** ticket / removed the **Child** ticket |
| Several | **Shemul Admin** made **3 changes** |
| Revert | **Nadia Islam** undid changes from 17 Nov, 12:48 pm |
| Only net-zero edits | **Shemul Admin** made changes and undid them (collapsed, muted) |

"Booking", never "product" or "configuration". Status words follow the catalog list: on sale / off
sale. Draft and Published are the backend's internal names.

## 6. Undo

- Available on any session whose changes can be put back. Price, names, on sale, rules, status,
  payment choices and text can be. Added or removed tickets, photos and locations cannot, and are
  listed as "Not undone" in the preview.
- The preview lists every field with `current → will be`. If a field has changed again since, the
  current value is the newer one, and the row says so ("changed again since").
- Confirming makes one save, which appears as a new session: "undid changes from …".

## 7. Data contract (for the backend)

```ts
CatalogRevision {
  id, productId, at: ISODateTime,
  actor: { id, name, role? } | null,     // null: before tracking began
  kind: "created" | "edited" | "archived" | "reverted",
  changes: CatalogFieldChange[],          // ONE revision per save request
  revertOf?: ISODateTime,
}
CatalogFieldChange {
  field: string,                          // stable key: "tier.price", "policies.cancelHours", "status"…
  area: "status"|"details"|"prices"|"where"|"rules"|"payment",
  subject?: { kind: "tier", id, name },   // name snapshotted at change time
  before: CatalogValue, after: CatalogValue,
}
CatalogValue = { type: "text"|"longText"|"money"|"number"|"bool"|"status"|"list"|"payNow", value, unit? } | null
```

Rules the backend must keep:

- **Write one revision per save request**, with every field change in it.
- **Snapshot the names** of sub-objects (tickets) into the change.
- **Store typed values.** Never pre-rendered sentences, never raw enum strings meant for display.
- Grouping into sessions (same actor, under 15 minutes apart) and net-zero collapsing happen **in
  the client**, so the raw revisions stay a faithful log.

## 8. States

- **Loading:** a skeleton of three session rows.
- **Empty filter:** "No changes to Prices & tickets yet." with a "Show all changes" link.
- **Only the creation:** the creation item, with "Changes will appear here." above it.
- **Error:** the kit's inline error with Retry.

## 9. Acceptance

- One save with N fields shows as one entry.
- A rename taken back within the session never appears as a change.
- No id and no raw enum is visible anywhere on the tab.
- Filters by area and by person; the count in the summary follows the filter.
- Undo previews, applies in one save, and appears as a revert entry.
- Phone at 393px: no sideways scroll, all targets at least 44px, light and dark.

## 10. Density revision (2026-11-19)

Owner review: the first build wasted space. Each entry's sentence hugged the left of a full-width
column, its time sat 1,000px away at the far right, the diff boxes stretched the whole width with
their values on the left, and three of an entry's five rows repeated the sentence. Revised
following GitHub's PR timeline and Linear's activity feed, where a simple event is one line plus a
meta line:

- **Reading width.** The timeline column is capped at 46rem with the At a glance rail beside it, so
  the time and ⋯ sit next to what they belong to. Extra space on very wide screens falls outside
  the content, not inside it.
- **Two lines per simple entry.** Line 1 is the sentence; a status change carries its pill inline.
  Line 2 is the meta: `time · area · price delta · note`. The separate area row, the time column
  and the "Hide changes" row are gone.
- **A diff only where the sentence is a summary.** "changed the price of X from ৳9,600 to ৳8,000"
  already says everything, so it gets no diff. "made 2 changes" and "changed the cancellation
  window" get their rows inline, with no toggle. More than 4 rows show 3 and "Show N more".
- **A compact diff.** No box: a `label | before → after` list as wide as its content, set off by a
  1px rule. Long text sits on the same row, each side clamped to one line, behind "Show full text".
- **A smaller rail.** 28px avatars and markers (24px made the initials about 8px, under the 12px
  floor), and a tighter gap between entries than between days.
- **Creation in two lines.** "Created" over "8 May 2026, 10:00 AM · creator not recorded…". The date
  appears once, not in the sentence and again in a time column.

The result: the same history takes about half the height, and a whole booking's history fits on
one 900px screen.
