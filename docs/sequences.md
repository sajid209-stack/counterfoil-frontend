# Sequences

A sequence is a short list of steps Counterfoil does by itself when something
happens: a customer books, a visit is tomorrow, someone did not turn up, stock
runs low. It is the Zapier idea, cut down to what a venue needs and written in
the venue's words.

Contract: `src/lib/api/sequences.ts` (records, runs, ideas) and
`src/lib/sequences.ts` (pure helpers: sentences, checks, the try-it timeline).
Screens: `/sequences`, `/sequences/new`, `/sequences/[id]`.

## 1. What the research says

| Product | What we take | What we leave |
|---|---|---|
| Zapier | One page, top to bottom: what starts it, then the steps. A step is set up in a side panel, and can be tested where it stands. Branches are readable only when each path is visible and named. | The app directory, field mapping, "Zap", "trigger", "action". A venue has one app. |
| Shopify Flow, HubSpot, Klaviyo | Start from a ready-made idea, not an empty page. A live count of who is inside a flow. | A free canvas. It allows orphaned steps and gets cluttered past seven. |
| Customer.io | Their first builder was a flat list and people had to sketch on paper first. So a linear builder must still *look* like the diagram: a spine, connectors, branches side by side. | |
| Xola, FareHarbor, Peek Pro | Confirmation, reminder and review messages are the baseline every venue expects. | They are fixed settings, not steps. None follows up a no-show or fills a cancelled place. A Peek reviewer: "no outbox". |
| Linear, Stripe | Status is one word, history is a plain list, and every row answers "what happened and when". | |

Three things nobody in ticketing does, and we do:

1. **Try it before it runs.** Pick a real booking and see every step with the
   real date, time and words. No message is sent.
2. **An outbox.** Every run is a row: who, which step it is on, what was sent,
   what was skipped and why.
3. **It cannot annoy a customer by accident.** Quiet hours and "stop if the
   booking is cancelled" are part of the model, not options buried in a step.
   And the model knows a **message about your own booking** (a reminder, a
   balance, a cancellation) from an **invitation** ("come back and see us"):
   the first goes to anyone with a phone, the second only to customers who
   said yes to messages. The screen says which, under every message.

## 2. Why it belongs in OS

Today a manager does these by hand, or not at all: texting tomorrow's customers,
chasing a balance, phoning the waitlist when a place frees up, asking for a
review, noticing that water is nearly out. Each is a rule a person repeats.
Sequences turns the rule into a row that can be read, switched off and audited.

It also gives the rest of OS somewhere to point. A no-show on the calendar, a
low-stock line in Inventory and a waitlist on a full slot can each say "a
sequence handles this", with a link.

## 3. Words

Plain-language rules apply (`docs/plain-language.md`). The glossary for this
feature:

| Don't write | Write |
|---|---|
| workflow, automation, zap, flow | sequence |
| trigger, event | starts when |
| condition, filter, rule | only if |
| action, node | step |
| delay | wait |
| branch, path, split | if / otherwise |
| run, execution, enrolment | run (noun only): "3 runs today" |
| enabled, active, published | on · off |
| draft | not finished |
| template, recipe | idea |
| webhook | send to another app |
| merge tag, variable, placeholder | detail (as in "Add a detail") |
| recipient | who gets it |
| opt-in, consent | said yes to messages |

A sequence always reads as one sentence, and that sentence is shown in the list:
**"1 day before a visit, text the customer."**

## 4. The model

```
Sequence
  name
  status        on | off          (off + never switched on = "Not finished" while it has problems)
  start         what starts it    (one)
  onlyIf        conditions        (all must be true; 0–4)
  steps         the list          (1–8, one level of if/otherwise)
  stopIf        cancelled | checkedIn | paid   (any; shown under the start)
  quietHours    hold customer messages between 9 PM and 9 AM until 9 AM
```

### What can start a sequence

Grouped by who it is about. The group decides which steps are offered.

| Group | Starts when | Extra setting |
|---|---|---|
| Customers | A booking is made | which bookings |
| | Before a visit | how long before · which bookings |
| | After a visit | how long after · which bookings |
| | A booking is cancelled | which bookings |
| | A customer does not turn up | which bookings |
| | A balance is still owed | how long before the visit |
| | A place opens on a full slot | which bookings |
| | A customer has not come back (an invitation: needs their yes) | after how many days |
| Your team | A refund is asked for | |
| | Something runs low in stock | |
| | Cash is short at close | by how much |

"Which bookings" is **Every booking** or a chosen few from the catalog.

### Only if

`people` (party size), `total` (sale total), `visits` (how many times they
came), `where` (counter / online), `day` (day of the week), `owes` (yes / no).
Each is a sentence: "Only if the group is 6 or more."

### Steps

| Step | For | Settings |
|---|---|---|
| Wait | both | how long (15 min to 30 days) |
| Send a text | customer | words, with details |
| Send an email | customer | subject, words |
| Tell the team | both | who (a role or everyone on shift), words |
| Add a note to the customer | customer | words |
| Offer the place | "place opens" only | to the next on the waitlist, how long they have |
| Send to another app | both | web address |
| If / otherwise | both | one "only if" line; steps on each side (no nesting) |

Details that can go into words: customer first name, booking name, date, time,
people, amount owed, venue name, ticket link. They are chips in the text, never
`{braces}`.

### Runs

A run is one sequence working for one customer or one thing. Status:
`working` (waiting on a step), `done`, `stopped` (a stop rule or switched off),
`problem` (a step failed). Each step in a run is `done`, `waiting until …`,
`skipped` (with the reason: "did not say yes to messages", "quiet hours",
"booking was cancelled") or `failed`.

## 5. Screens

### 5.1 `/sequences` — the list

- Header: title, one line ("Steps Counterfoil does for you"), **New sequence**.
- Figure band: **On now**, **Runs this week**, **Messages sent**, **Need a look**
  (runs with a problem; the only figure that can be amber).
- Tabs: **Sequences** · **Sent and waiting** (the outbox).
- Sequences table: Name + its sentence underneath, Runs (30 days), Last run,
  On/Off switch in the row. Row opens the builder. Row menu: Copy, Delete.
  A sequence with a problem shows a small warning with the reason.
- Empty state: three ideas as cards, not a blank page.
- Outbox table: When, Who (customer and booking), Sequence, Step it is on,
  Status. Filter by status. A row opens the run (a sheet with the step-by-step
  record).
- Phone: the table becomes cards (name, sentence, switch). The figure band is
  the phone `FigureBand`.

### 5.2 `/sequences/new` — start from an idea

- A search box and groups: **Before the visit**, **After the visit**, **When
  plans change**, **Your team**.
- Each idea is a card: icon, name, the sentence, and how many steps. Choosing
  one opens the builder already filled in, named, and **off**.
- **Start with nothing** is a quiet card at the end, not the default.

### 5.3 `/sequences/[id]` — the builder

Desktop: two columns. The flow on the left, the panel on the right (360px).
Phone: the flow is the page; a step opens as a bottom sheet.

**Top bar** (in the page header): name (click to rename), status pill,
**Try it**, On/Off switch, **Save**.

**The flow** is a single spine, top to bottom:

```
 ┌───────────────────────────────┐
 │ ◎ Starts when                 │   start card (ember ring when chosen)
 │   Before a visit · 1 day      │
 │   Every booking               │
 └───────────────────────────────┘
        │  Only if the group is 6 or more          ← quiet line on the spine
        │  Stops if the booking is cancelled
        ●  +                                        ← add a step here
 ┌───────────────────────────────┐
 │ 1  Send a text                │
 │    "Hi Farhana, see you…"     │
 └───────────────────────────────┘
        ●  +
 ┌───────────────────────────────┐
 │ 2  Wait · 2 hr                │   waits are slim, clock on the spine
 └───────────────────────────────┘
        ●  +
 ┌──────────── If the customer still owes money ───────────┐
 │  Yes                          │  Otherwise               │
 │  3  Send a text               │  (nothing)               │
 └───────────────────────────────┴──────────────────────────┘
        ◼  Ends
```

Rules of the flow:

- One card is selected at a time; the panel shows that card. Nothing selected:
  the panel shows the sequence summary and its problems.
- Every card states its content in words. An unfinished card says what is
  missing in the danger colour ("Write the text") and carries a dot.
- **+** opens a small menu of the steps that make sense at that point.
- Steps move with up/down buttons in the panel and by keyboard (no drag needed;
  drag is extra). Delete has Undo (toast).
- Numbers count real steps; waits are not numbered.
- The spine shows elapsed time at the side of each step ("after 1 day 2 hr").

**The panel** for a message step: who gets it (read-only line), the words with
an **Add a detail** menu, a live preview as the customer sees it (a phone
bubble for a text; a small email card), character count for texts (160 a
part), and a line about consent ("Sent only to customers who said yes to
texts").

**Try it** opens a dialog: choose one of five recent bookings; the right side
lists every step with the real moment ("Fri 13 Nov, 10:00 AM · Text to
Farhana") and the real words, and marks what would be skipped and why.
The footer says "Nothing is sent".

**Runs tab** on a sequence: the same outbox, for this sequence only, with a
small bar of the last 14 days.

**Saving and switching on.** Save keeps it. The switch cannot go on while a
card is unfinished; it says which one. Switching off asks what to do with runs
that are waiting (let them finish · stop them), only when there are any.
Leaving with unsaved changes asks first.

## 6. States

- Loading: skeletons that match the flow (three cards on a spine).
- Empty outbox: "Nothing sent yet. Runs appear here when a sequence is on."
- Problem: a failed step shows the reason and **Try again**.
- Page-state preview (`cf_screen_state`) has entries for the list.

## 7. Seed

Six sequences so every state is on screen: reminder (on), review request (on),
no-show follow-up (on, with an if/otherwise), balance chase (on, one run with a
problem), waitlist offer (off), low stock (not finished: no one chosen to
tell). About forty runs across the last fourteen days, generated by index, not
`rand()`, from real seeded orders and customers.

## 8. As built (2026-11-15)

**Files**

- `src/lib/sequences.ts` — types and pure rules: what may start a sequence
  (`START_META`), which steps fit (`stepKindsFor`), what is missing
  (`sequenceProblems`), the sentences, `walkSequence` (plays a sequence for one
  booking; "Try it" and the seeded runs both use it), the thirteen ideas.
- `src/lib/api/sequences.ts` — the store: six seeded sequences, runs made on
  first read by walking real seeded bookings, `trySamples`, and the writes
  (`createSequence`, `updateSequence`, `setSequenceOn`, `copySequence`,
  `deleteSequence` / `restoreSequence`, `retrySequenceRun`).
- `src/app/(os)/sequences/` — `page.tsx` (list + outbox), `new/page.tsx`
  (ideas), `[id]/page.tsx` (builder). Shared pictures in `_components/kinds.tsx`;
  the builder under `_components/builder/` (flow, panel, `WordsEditor`,
  `TryItDialog`, `RunsTab`); the outbox under `_components/runs/`.
- Messages: `sequences` (shared words and all idea wording), `sequencesList`,
  `sequenceBuilder`; en and bn. `nav.sequences`, three `screens.empty.*` entries.
- Rail: Sequences sits under Customers (`nav.ts`), so the rail has one more
  destination. Harnesses that count rail rows need the new count.

**Decisions made while building**

- **Who gets a message.** A message about the customer's own booking goes to
  anyone with a phone or an email. Only an invitation (`START_META.needsYes`,
  today "has not come back") needs their yes. The first seed run showed why:
  three of twenty-one seeded customers have said yes, so a reminder gated on
  marketing consent would have been skipped for nearly everyone.
- **Words are edited as chips.** `WordsEditor` is an editable box whose details
  are chips; the stored value is still text with `{detail}` tokens. The box is
  rebuilt from the value only when the two disagree, so the caret never jumps.
  Idea wording is read with `t.raw`, because `{firstName}` is ours to fill, not
  the translator's.
- **Lengths of time are a number and a unit** (min, hr, days), not the kit's
  hour field: "2 days before" must not read "48 hr".
- **Add a step is a small dialog**, not a popover: the kit's menu cannot be
  anchored to a custom button.
- **A text with ৳ or Bangla holds 70 letters.** The counter says so, and says
  how many texts each send costs.
- **On a phone, the switch and Try it have a row of their own** above the name;
  "more" keeps Copy and Delete.
- **The run record shows only what happened.** A step still to come has no
  words and no answer; an "if" shows its answer once it is done.
- **People who owe.** The seed's part-paid sales have no time slot, so
  `owingSamples` gives each a visit in the next three days. They are what the
  balance sequence runs for, with the real name and the real amount.

**Checks**

- Contract test: scratchpad `seq/unit.mjs` (280 checks: sentences in en and bn,
  editing helpers, every idea finished and using only details its step may use,
  the walk, quiet hours, runs, every write).
- Browser walk: scratchpad `seq/walk.mjs` (idea → add a step → refused switch →
  words with a detail → save → switch on → Try it), and `seq/shot.mjs` for
  screenshots at 1440 and 393, light, dark and Bangla.
- `tsc`, `eslint` (no new findings), `check-i18n`, `lint:tokens` clean.

**Not built**

- The engine. Nothing is sent; runs are seeded. `SequenceRun` is the contract
  for what the backend's engine must record.
- Drag to reorder (the arrows and the keyboard do it), a real map for "which
  bookings" beyond a checklist, and sequences that start from the calendar,
  inventory or a no-show row linking here.
- Bangla wording was written with care but not read by a native speaker.
