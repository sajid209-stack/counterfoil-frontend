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

/** The selected label on its own, for a tab that marks its icon separately. */
export const NAV_SELECTED_TEXT = "text-fg font-semibold";

/**
 * The till's tab bar and rail: the indicator is solid ink with the icon
 * knocked out of it (the light pill in dark mode). A touch screen used at arm's
 * length, by staff who often go by the picture rather than the word, needs the
 * current tab to read at a glance; the quiet grey of the OS rail does not on a
 * white bar.
 */
export const NAV_TAB_ACTIVE = "bg-inverse text-inverse-fg";

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
