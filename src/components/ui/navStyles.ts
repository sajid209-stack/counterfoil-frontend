/**
 * The one "you are here" treatment, for every menu in OS and in the till: the
 * rail, its nested rows, the phone's menu sheet, the Settings column and the
 * till's tab bar and rail.
 *
 * The accent surface alone (brand-50 on a white rail) is about 1.03:1 against
 * the rail — a tint you have to look for, which is the complaint it answers. So
 * the current page is said three ways at once, every one of them a token:
 *  - the accent surface (`ember-wash`) with a 1px `ember-line` edge, so the row
 *    has a shape even where the fill is faint;
 *  - its label in `brand-foreground` at 600, so it reads by weight as well as
 *    colour (6.2:1 light, 9.6:1 dark);
 *  - its icon in the brand orange itself.
 * Hover stays a neutral fill, so hovering a row never looks like choosing it.
 */
export const NAV_SELECTED = "bg-ember-wash text-brand-foreground font-semibold ring-1 ring-inset ring-ember-line";

/** The icon on the selected row. */
export const NAV_SELECTED_ICON = "text-ember";

/** A row that is not the page you are on. */
export const NAV_IDLE = "text-muted hover:bg-muted-wash hover:text-fg";

/**
 * The parent of the page you are on, when that page is one of its children
 * (Shopify: Customers stays bold while Segments is the highlighted row). No fill
 * — exactly one row on the screen carries the selected surface — but full ink
 * and 600, so the group the page belongs to is still obvious.
 */
export const NAV_PARENT_OF_SELECTED = "text-fg font-semibold hover:bg-muted-wash";
