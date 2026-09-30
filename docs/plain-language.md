# Counterfoil — plain-language rules

Counterfoil is used by venue owners, managers and counter staff in Bangladesh
and elsewhere, many of whom did not finish school and read English as a second
language — or read only Bangla. **Every word on screen must be understood on
the first read by someone with basic reading skills.** If a sentence needs to
be read twice, it is wrong.

These rules apply to every title, question, label, help line, button,
placeholder, empty state, error and toast, in **both English and Bangla**.

## 1. The ten rules

1. **Short.** Labels: 1–4 words. Help lines: one sentence, ideally under 12
   words, never over 20. One idea per sentence.
2. **Everyday words.** Write the word a shopkeeper uses, not the word a
   software engineer uses. See the glossary — it is not optional.
3. **Say what happens, not what it is called.** "Sales stop 15 min before the
   time slot starts" beats "Sales cut-off before start".
4. **Help text changes with the value.** When a setting has a value, the line
   under it says what that value means *right now* ("Tickets can be bought
   until the slot starts." at 0 min; "Sales stop 1 hr before the slot
   starts." at 1 hr). Never show a letter as a placeholder for a number
   ("N hours", "X days") — say the real number or say "hours" in words.
5. **Questions for choices, nouns for fields.** A section that asks the owner
   to decide something may be a question ("Can people cancel?"). A field label
   is a plain noun phrase ("Max people per slot"). Don't ask a question and
   then label the answer with a different word than the question used.
6. **Options read as answers.** Each option in a choice must be a complete,
   plain answer ("Yes, free until 24 hr before", "No refunds"), and the summary
   shown after choosing must use the *same words* as the option chosen.
7. **No jargon, no idioms, no British-isms.** No "till", "tier", "band",
   "override", "cut-off", "config", "instance", "lifecycle", "channel",
   "SKU", "tender", "float", "void", "waiver" without the plain word first,
   "ring up", "on the house", "as and when". See the glossary.
8. **Explain the consequence, not the mechanism.** "The first band that
   matches wins" is mechanism. "If two times overlap, the higher one in the
   list is used" is consequence.
9. **Examples beat explanations.** Where a field is unusual, show a real
   example in the placeholder or help line ("e.g. Adult, Child, Family").
10. **Icons never stand alone.** Every icon-only button has a visible label or,
    where there is truly no room, a tooltip and an `aria-label` that says the
    action in words ("More options for Adult", "Move Adult down").

Also:

- **Sentence case** everywhere. No Title Case, no ALL CAPS in the text itself
  (a style may uppercase a small label; the string stays sentence case).
- **"You" is the operator. "Customers" are the people who buy.** Don't mix in
  "visitors", "guests", "patrons", "buyers" — use "customers" (or "people"
  where it is about a count: "Max people per slot").
- **Numbers as digits**, with units in short form the app already uses:
  `15 min`, `1 hr`, `3 days`, `৳500`.
- **Em-dashes sparingly.** One per sentence at most; prefer two short
  sentences.
- **Errors say what to do.** "Enter a price" not "Price is invalid".
- **Buttons are verbs.** "Save", "Add ticket type", "Stop selling".
- **Don't explain the obvious.** A field called "Phone" needs no help line.
  Remove help lines that add nothing.

## 2. Glossary — use these words and no others

| Don't write | Write (English) | Write (Bangla) |
|---|---|---|
| till, POS (in a sentence) | counter / counter sales | কাউন্টার / কাউন্টারে বিক্রি |
| Point of Sale (app name, nav) | Point of Sale (keep as a name) | পয়েন্ট অফ সেল |
| tier, variant | ticket type | টিকিটের ধরন |
| admits | people per ticket | প্রতি টিকিটে কতজন |
| band, price band, time band | time price / price for certain times | সময়ভেদে দাম |
| session (for timed entry) | time slot (short: slot) | সময়ের স্লট / স্লট |
| session (a named show, e.g. "Morning show") | show | শো |
| capacity, holds | max people / spaces | সর্বোচ্চ কতজন / জায়গা |
| cut-off, sales window | stop selling / booking closes | বিক্রি বন্ধ / বুকিং বন্ধ |
| bookable up to N days ahead | how far ahead people can book | কত দিন আগে বুক করা যাবে |
| override, exception | different hours on a day / special day | বিশেষ দিন / আলাদা সময় |
| re-entry | can leave and come back | বের হয়ে আবার ঢুকতে পারবে |
| waiver | signed safety form | সই করা নিরাপত্তা ফর্ম |
| channel | where it's sold (counter / online) | কোথায় বিক্রি হয় |
| SKU | product code | পণ্য কোড |
| tender, amount tendered | cash received | গ্রাহক দিয়েছে |
| float | starting cash | শুরুর নগদ |
| count tolerance | allowed difference | অনুমোদিত পার্থক্য |
| void | cancel (a ticket/sale) | বাতিল |
| write off | forgive the balance (write off) | বাকি মাফ |
| redeem, redeemed | used / checked in | ব্যবহৃত / ঢুকেছে |
| resource | room, lane, guide… (name the thing); generic: "what gets booked" | যা বুক হয় |
| venue, location | venue (be consistent within a screen) | ভেন্যু |
| deposit, advance | advance payment | অগ্রিম |
| partial payment | pay part now, rest later | কিছু এখন, বাকি পরে |
| inventory | stock | স্টক |
| payout | payout (money we send you) | পেআউট |
| lead time | notice needed | কত আগে জানাতে হবে |
| walk-in | walk-in (customer with no booking) | ওয়াক-ইন |
| no-show | didn't come | আসেনি |
| check in | check in | চেক ইন |
| party size | group size | দলের আকার |
| customer, visitor, guest | customer | গ্রাহক (not কাস্টমার) |
| Save (button), সংরক্ষণ | Save | সেভ করুন |
| Edit (button), সম্পাদনা | Edit | বদলান |

## 3. Bangla

- Everyday spoken standard Bangla (চলিত ভাষা), the way a shop owner in Dhaka
  talks. No সাধু forms, no heavy Sanskrit words where a common word exists.
- Common English business words used in Bangladesh stay in English sound,
  written in Bangla: টিকিট, বুকিং, অনলাইন, কাউন্টার, স্লট, পেমেন্ট, রিফান্ড.
- Bangla must say the same thing as the English — not a word-for-word
  translation, but the same meaning at the same reading level.
- Digits may stay as the app already renders them; do not mix scripts in one
  number.

## 4. Where copy lives

- `src/messages/<en|bn>/<namespace>.json` — every visible string. English and
  Bangla must have the **same keys** (`0 missing / 0 extra`).
- Some components still hard-code English. When you touch one, move its words
  into the messages so Bangla gets them too.
