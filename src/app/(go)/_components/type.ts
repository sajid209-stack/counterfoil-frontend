/**
 * The till's text roles on a desktop (docs/pos-desktop.md §9). Every piece of
 * text on a POS screen is one of these; a screen does not invent its own mix of
 * size, weight and colour.
 *
 * Why roles and not sizes: hierarchy comes from size, weight AND colour
 * together. Two adjacent lines at the same size and weight read as one flat
 * block (the schedule's "5:00 PM / 15 seats left"), so the thing a person is
 * looking for (a name, an amount, seats left) is the strong one, and what
 * describes it (a time, a label, a code) steps down in weight and colour, not
 * only in size. Labels are quieter than the values they name. Text is coloured
 * with tokens (fg, fg-secondary, muted), never with opacity.
 *
 *   size   12  caption   13  meta/label   14  body/item/button   16  card title
 *          18  total     20  page title    24  stat              28–36 the hero amount
 *   weight 400 reading   500 controls and labels   600 names, titles, values   700 money totals
 */
export const T = {
  /** The page's own name, in the page header. */
  page: "text-xl font-semibold text-fg",
  /** A card or a dialog's title. */
  card: "text-md font-semibold text-fg",
  /** A name in a list or on a tile: what the row IS. */
  item: "text-base font-semibold text-fg",
  /** Reading text. */
  body: "text-base text-fg",
  /** What describes the item: a time, a place, a code, a count. */
  meta: "text-sm text-muted",
  /** A field or group label, or the name of a value in a summary. */
  label: "text-sm font-medium text-fg-secondary",
  /** Legends, axis hours, timestamps. The floor: nothing smaller. */
  caption: "text-xs text-muted",
  /** A button's words; the button sets its own colour. */
  button: "text-base font-medium",
  /** A price on a line. */
  price: "text-base font-semibold tabular-nums text-fg",
  /** A total. */
  total: "text-lg font-bold tabular-nums text-fg",
  /** A figure in a summary strip (with a `label` under or over it). */
  stat: "text-2xl font-semibold tabular-nums text-fg",
  /** A state in words, coloured by the caller (success, warning, danger). */
  status: "text-sm font-medium",
} as const;
