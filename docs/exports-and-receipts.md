# Receipts, prints and exports

What the product hands people on paper or as a file, and the one structure all of
it follows. Written 2026-11-22.

## 1. Inventory

| Where | What it produced before | What it produces now |
|---|---|---|
| POS / Orders → Print receipt | narrow card, name + lines + footer | thermal receipt (80 / 58 mm) or A4 tax invoice, **logo at the top** |
| POS → Print all / tickets | receipt strip + ticket stubs | same strip, same logo header |
| Orders → Export | one CSV with a summary appended under the rows | **Excel workbook** (Summary · Orders · Items · About) or a clean CSV |
| Orders → Print | A4 list / summary | A4 on the shared letterhead (logo, page X of Y) |
| Orders → Summary → Download | CSV | Excel Summary report |
| POS My sales → Export / Print | CSV / page print | Excel (Summary · Sales · Items) or CSV; print with letterhead |
| Customers, Issued tickets, Expenses, Finances, Activity | CSV each, each built differently | Excel or CSV through one menu |
| Analytics → Export, VAT → Export | CSV | Excel with a Summary and a sheet per breakdown; VAT as a return working paper |
| Catalog booking → Settlement | CSV | Excel or CSV |

## 2. Receipt

Anatomy, top to bottom (the order a customer reads it, and the order the
Bangladesh VAT rules and every major POS print it):

1. **Logo** — from Settings → Business profile. Printed in black, centred,
   24 / 36 / 48 mm wide (small / medium / large), never wider than the roll.
2. Business name · venue and address · phone and website · VAT registration.
3. **RECEIPT**, or **TAX INVOICE** when the VAT registration prints.
   Receipt number, date and time, counter and who served, customer.
4. Items — name, then what it is for (tier, date, time, seat or lane), then
   `qty × unit ……… amount`. Add-ons indented; discounts under their line.
5. Subtotal · discounts · VAT **per rate** · **TOTAL**.
6. Payments — each method; cash shows tendered and change; balance due if any.
7. Look-up QR of the receipt number (returns, questions).
8. The business's own footer line · Powered by Counterfoil.

Thermal printers are 1-bit: no fills, dashed rules between sections, tabular
figures, dark ink on white in either theme.

**Settings → Business profile → Receipts** holds the logo (upload, replace,
remove), *Print logo on receipts*, logo size, paper (80 mm roll, 58 mm roll,
A4), *Show who served*, *Show customer*, *Look-up QR*, and the footer. The
preview beside them is the real receipt component, so it is what prints.

**The print screen** has its own Logo switch and Paper choice for *this print
only* — defaulting to the settings, never saving them. With no logo uploaded the
switch is off and says where to add one.

## 3. Excel reports — one structure

Every export goes through `src/lib/report.ts`, so every file has the same shape:

1. **Summary** — report title, business, then the context block (Venue,
   Period, Filters, Prepared by, Generated), the **key figures** as cards, then
   each breakdown as a small table sorted by amount with a share column and a
   total. This is the sheet a manager reads and the one that answers "how did
   we do".
2. **Data sheets** — one row per record. Typed columns: money is a number in
   the business's currency format (it adds up), dates are dates (they sort and
   filter), references are monospaced. The header is frozen, every column has a
   filter, and the totals row uses `SUBTOTAL`, so **filtering the sheet updates
   the totals**. Set up to print: landscape when wide, fit to width, the
   header repeated on every page, "Page X of Y" in the footer.
3. **About** — what every figure means (Gross, Discounts, Net, VAT, Total,
   Paid, Refunded, Owed, Written off, Average order value), for the accountant
   who was not in the room.

Column order is the same everywhere: identity → when → who → where/how →
money → status.

**CSV** stays, for other software: the first data sheet only, one header row,
money as plain decimals, ISO dates, no preamble or totals to break an import,
formula-looking text defused, UTF-8 with a byte-order mark so Excel reads
Bangla and ৳.

The writer (`src/lib/xlsx.ts`) has no dependency: it writes the SpreadsheetML
parts and a stored zip in the browser.

## 4. Export control

One control on every screen: **Export ▾** → *Excel workbook (.xlsx)* ·
*CSV (.csv)* · *Print or save as PDF* (where a printed version exists).
Excel first, because it is what people open. `src/components/ExportMenu.tsx`.

## 5. A4 documents

`src/app/print/_components/PrintDocument.tsx` is the frame: the logo and
business on the left, the document's title, period and filters on the right, a
heavy rule, then the document. Footer in the page margin on every sheet:
business — title · generated time, and Page X / Y.

## 6. Data

`Operator.logo` (data URL or path) and `Operator.receipt` (`ReceiptSettings`)
are new on the contract — hand them to the backend lane. Business-profile
changes are now kept per demo in this browser (`cf_operator_v1`), so a logo
survives a reload.
