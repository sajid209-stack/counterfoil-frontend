# Page design v4: fewer choices, every one visible

Supersedes the look picker in `docs/product-page.md` §3 and the option lists in `docs/page-style.md`. The owner asked for a customiser that is friendlier, less complex and has fewer options.

**Rule:** an operator with no design training can make a good page in two minutes. If a choice needs explaining, or can only make the page worse, it is not a choice.

## The panel

Two tabs beside the live preview: **Design** and **Sections**.

### Design tab, top to bottom

1. **Layout**: three cards, each a small drawing of the page shape. Nothing else picks a layout.
   | Card | `style.hero` | Page |
   |---|---|---|
   | Cover image | `cover` | Title over a full-width photo |
   | Classic | `split` | Title and details beside the photo |
   | Title first | `editorial` | Title, then details, then the photo below |
2. **Cover photo**: one preview with Upload or Replace, and Remove. Lives here because it belongs with the layout.
3. **Colours**:
   - Background: Light, Warm or Dark, as three swatches (`#ffffff`, `#faf6f0`, `#0d0d10`).
   - Accent: eight swatches and a custom colour well. The resolver already keeps text readable.
4. **Font**: one dropdown of six named styles, each option drawn in its own face. The operator never sees a font name or a pairing.
   | Name | Heading / body | Heading case |
   |---|---|---|
   | Modern | Plus Jakarta Sans / Plus Jakarta Sans | normal |
   | Clean | Sora / Inter | normal |
   | Classic | Playfair Display / Work Sans | normal |
   | Elegant | Cormorant Garamond / Lora | normal |
   | Bold | Archivo Black / IBM Plex Sans | normal |
   | Poster | Bebas Neue / Figtree | upper |
5. **More options**, closed by default, each a segmented control with plain words:
   - Corners: Square, Soft, Round.
   - Tickets panel: Beside the page, Inside the page.
   - Photos: Mosaic, Grid, Strip.

At the foot: "Use my venue page's style" as a quiet link, shown only when a storefront style exists. Any change on this tab sets `styleSource: "custom"`, so there is no Use/Customise switch to understand.

**Gone from the UI:** look cards, starting points, palettes, the font chips, separate heading and body selects, heading weight, type scale, heading case, button style, card style, hero height, page width, spacing, dividers, texture, photo tone, icon weight, overlay, CTA and price wording, badge.

### Sections tab

**On your page** is the list of shown sections: a drag handle, an icon, a name and a one-line state. The whole row opens its editor. Inside the open editor are Move up, Move down and Remove from page. There are no eye icons and no arrows on rows.

**Add to your page** is a wrap of chips for the rest. Pressing one adds the section and opens it. A section can no longer be filled in while hidden.

Sections: Top of the page, Countdown, Highlights, About, Tickets, What's included, Good to know, Programme, Photos, Video, Venue, Questions, Sponsors, Host.

**Removed everywhere** (editor and page): Numbers (`stats`), How it works (`steps`), Extra text (`text`), Quote (`quote`), Call to action (`cta`). Their data may stay on old records and is simply not drawn.

## Old pages

They must keep working and must not need migrating:

- `resolve.ts` maps `hero: "collage"` to `split` and `hero: "text"` to `editorial`.
- For product pages it ignores the retired fields, so a page saved with lines texture or a warm photo tone draws clean. Nobody could turn those off any more.
- `page.look` stays as the default ground, face and hero for a page with no style of its own. Nothing offers it.

## Programme

- **Days:** with more than one day, the editor has a tab per day. Each day has its own name, start and end time, and its own sessions. The page shows day tabs with the date and that day's hours.
- **Times:** a time typed without AM/PM belongs to the event, so "6:00" on a 6 PM event means 6 PM, not 6 AM. A bare hour that falls before the event's start on a 12-hour reading moves to PM. The field echoes what it understood ("6:00 PM"), and an explicit "6:00 am" is obeyed.

## Public page fixes from the audit

- The site header and footer follow the page's own colours. They were white around dark pages.
- On desktop the ticket cards and the booking panel showed the same choice twice. With the panel beside the page, the Tickets section stays because it carries what each ticket includes, but it must not repeat a picker control.
- The venue card's drawn map is fake: replace it with a real embedded map, or none in preview.
- Fixture rows keep both sides on one baseline and wrap gracefully on phones.
- Sponsor cards show logo and name together: a logo in a fixed plate, the name beneath, the tier as a group label.
- Section headings use one weight and size per page.

## Round two (owner review)

- **Title first** follows Stripe Sessions and Figma Config: the title block and the details start level at the top, the details sit flush with the photo's right edge, and the photo runs the full width beneath. No empty space above the title, no gap at the right.
- **More options** holds only what an operator needs: Corners, Cover height, Button words. Cover position (Top, Middle, Bottom) sits with the cover photo. The tickets panel is always beside the page. The Photos choice is gone: it was never connected to the gallery, and the gallery now arranges itself by how many photos there are.
- **Cards follow their count**: one card fills the row, two share it, more than that form a bento pattern (`bento.ts`).
- **Highlights**: words alone are a text list under hairlines, equal rank, by count; no boxes, no icons. A highlight with a photo shows the photo with its words beneath, in a bento by count. Photos come first.
- **Sponsors** are a logo wall on the page itself: no boxes, tier as a small label. Logos are flattened on white, so on a light page they blend into it, and on a dark page they sit on a small white plate. The name stays beneath, small, because the owner asked to see it.

## Round three (owner review)

- **More options is gone.** Corners and Button words sit in the panel like everything else. This replaces the More options lines above.
- **The cover has one height** on every page: Medium. No control.
- **Keep in view** replaces Top, Middle and Bottom: tap the part of the photo that must always show. A single point works for every crop on every device.
- **Sponsors are centred**: logo, name, tier label and each row.
