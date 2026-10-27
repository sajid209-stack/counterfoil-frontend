# A new account's first dashboard

The owner, 2026-10-27: after creating an account, the dashboard should be different. It should be a
guided list for getting set up (counter, staff, catalog, device and the rest), researched, planned and
built properly.

## What happens today (the problem)

- Sign-up → code → `/onboarding` → `/dashboard`. Nothing empties the demo data, so a brand-new account
  lands on Lalbagh's sales, charts and activity, as if it were someone else's business.
- The dashboard has a six-step "Finish setting up" card (`steps` in `dashboard/page.tsx`). It only replaces
  the four figure tiles; the charts, activity and orders cards still draw underneath, empty or full of demo
  numbers.

## What the research settles

| Source | Pattern | What we take |
|---|---|---|
| Shopify admin "Setup guide" | One card, a progress count, steps as an accordion; one step open at a time with a sentence, an illustration and one primary button; steps tick themselves when done; the guide can be hidden | One setup guide, one step open, auto-ticking from real data, "Hide guide" |
| Stripe dashboard onboarding | Tasks ordered by what unlocks money; a clear "Next" | Order by dependency: venue → what you sell → payments → counter → team → device |
| Square "Get started" | Shows what the business will look like once live; quick links to try the till | A preview of the dashboard to come, and a "Try the till" link |
| Linear / Notion empty states | Empty pages explain themselves and offer one action | No empty charts: the live dashboard appears only after the first sale |

Theory: goal-gradient (progress already started, "1 of 7 done" because the business name exists),
Zeigarnik (an unfinished list pulls people back), Hick's law (one open step, one primary button),
progressive disclosure (later steps closed until reached).

## The design

1. **A fresh account really is fresh.** Confirming the sign-up code calls `startFreshBusiness()` and
   remembers it (`cf_fresh` in localStorage with the business name the person typed), so a reload keeps the
   new, empty business instead of reverting to the demo. Opening a demo business from the landing page
   clears the flag. Onboarding pre-fills the business name from sign-up.
2. **The dashboard is in setup mode until the guide is finished or hidden.** It shows, and nothing else:
   - **A welcome header**: "Welcome, {first name}" and "Let's get {business} ready to sell."
   - **The setup guide** (one card): a progress bar and "N of 7 done", and seven steps in order:
     1. Business details (done after onboarding) → Settings → Business
     2. Add your venue (address and opening hours) → `/settings/locations/new`
     3. Add what you sell (first booking) → `/catalog/new`
     4. Choose how you take payment → `/settings/payments`
     5. Set up a counter → `/settings/counters/new` (needs a venue: says so and links to step 2 if missing)
     6. Invite your team → `/settings/team/new`
     7. Pair a till device → `/settings/devices/new` (needs a counter)
     Each row: a status circle (number, or a green tick), the title, and when open a one-sentence why, a
     small icon illustration, one orange primary action and a quiet "Skip for now". The first unfinished
     step opens by itself; clicking another row opens it instead. Done steps say "Done" and can be
     reopened. Ticks come from real data, never from clicking.
   - **A side column**: "Try the till" (opens `/pos`), "Your web page" (`/settings/storefront`, optional),
     and "Need a hand?" (help line). A muted preview card: "After your first sale you'll see today's sales,
     places sold and who has arrived here."
   - "Hide setup guide" in the guide's menu: hides it and shows the normal dashboard. It can be shown
     again from the dashboard's menu while steps remain.
3. **When all seven are done or skipped**, the guide becomes a short "You're ready to sell" card with
   "Open the till" and "Go to the dashboard", then the normal dashboard.
4. **Phone**: the same guide as a single column; the side column moves under it.
5. Copy follows `docs/plain-language.md`; English and Bangla.
