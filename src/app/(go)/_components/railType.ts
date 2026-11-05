/**
 * The till's text roles (type.ts `T`) as desktop-only overrides, for a text
 * that is already styled for the phone and must stay so: add `R.item` next to
 * the phone's classes and from `rail:` up the text takes the role. Written out
 * in full because Tailwind reads class names from source, so they cannot be
 * built by prefixing `T` at run time. Keep in step with type.ts.
 */
export const R = {
  page: "rail:text-xl rail:font-semibold rail:text-fg",
  card: "rail:text-md rail:font-semibold rail:text-fg",
  item: "rail:text-base rail:font-semibold rail:text-fg",
  body: "rail:text-base rail:font-normal rail:text-fg",
  meta: "rail:text-sm rail:font-normal rail:text-muted",
  label: "rail:text-sm rail:font-medium rail:text-fg-secondary",
  caption: "rail:text-xs rail:font-normal rail:text-muted",
  button: "rail:text-base rail:font-medium",
  price: "rail:text-base rail:font-semibold rail:tabular-nums rail:text-fg",
  total: "rail:text-lg rail:font-bold rail:tabular-nums rail:text-fg",
  stat: "rail:text-2xl rail:font-semibold rail:tabular-nums rail:text-fg",
  status: "rail:text-sm rail:font-medium",
} as const;

/**
 * The kit's SegmentedControl marks its chosen option with solid orange and
 * white text (3.5:1). On a desktop the chosen option is the till's own
 * TILE_CHOSEN look instead: a brand tint, a 2px orange ring, brand text. Pass
 * as the control's `className`; it reaches the radio buttons from outside, so
 * the kit is untouched and the phone keeps the solid fill.
 */
export const RAIL_SEGMENT =
  "rail:[&_[aria-checked=true]]:bg-ember-wash rail:[&_[aria-checked=true]]:text-brand-foreground rail:[&_[aria-checked=true]]:shadow-none rail:[&_[aria-checked=true]]:ring-2 rail:[&_[aria-checked=true]]:ring-inset rail:[&_[aria-checked=true]]:ring-ember rail:[&_[role=radio]]:min-h-10";
