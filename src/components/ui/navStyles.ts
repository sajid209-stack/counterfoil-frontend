/**
 * The one "you are here" treatment, for every menu in OS and in the till: the
 * rail, its nested rows, the phone's menu sheet, the Settings column and the
 * till's tab bar and rail.
 *
 * Shopify's quiet recipe, all neutral: a grey fill one step darker than the
 * hover wash (`secondary-hover`), the label in full ink at 600 and the icon in
 * full ink. No brand colour and no edge — the weight and the darker fill say
 * "here" without pulling the eye off the page.
 */
export const NAV_SELECTED = "bg-secondary-hover text-fg font-semibold";

/**
 * The same recipe in two halves, for a tab that draws its fill on the icon
 * alone (the till's tab bar and rail — Material 3's "active indicator": a pill
 * around the icon, the label under it in full ink at 600). A tab is a 64px
 * target; a fill round the whole of it makes the indicator bigger than the
 * thing it points at. Spelled out rather than built from NAV_SELECTED so
 * Tailwind can see each class whole.
 */
export const NAV_SELECTED_FILL = "bg-secondary-hover";
export const NAV_SELECTED_TEXT = "text-fg font-semibold";

/** The icon on the selected row. */
export const NAV_SELECTED_ICON = "text-fg";

/** A row that is not the page you are on. */
export const NAV_IDLE = "text-muted hover:bg-muted-wash hover:text-fg";

/**
 * The parent of the page you are on, when that page is one of its children
 * (Shopify: Customers stays bold while Segments is the highlighted row). No fill
 * — exactly one row on the screen carries the selected surface — but full ink
 * and 600, so the group the page belongs to is still obvious.
 */
export const NAV_PARENT_OF_SELECTED = "text-fg font-semibold hover:bg-muted-wash";
