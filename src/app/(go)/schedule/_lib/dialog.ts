/**
 * The desktop dialog standard (docs/pos-desktop.md §8.3) for the kit Sheet,
 * applied from the outside so the phone's bottom sheet is untouched. At `rail:`
 * the sheet is a centred dialog: head with a 16px title and a 36px close
 * (the drag handle is hidden by the kit Sheet itself), body padding 20px,
 * foot right-aligned (the buttons carry their own `rail:` height).
 *
 * The Sheet's children are, in order: handle, head, body, foot. The head's
 * first child holds the title paragraph (the one with an id), its button is
 * the close.
 */
const HEAD = "rail:[&>div:nth-child(2)]:items-center rail:[&>div:nth-child(2)]:py-3 rail:[&>div:nth-child(2)]:pb-3";
const TITLE = "rail:[&>div:nth-child(2)_p[id]]:text-md rail:[&>div:nth-child(2)_p[id]]:leading-6";
const CLOSE = "rail:[&>div:nth-child(2)>button]:mt-0 rail:[&>div:nth-child(2)>button]:size-9";
const FOOT = "rail:[&>div:last-child]:justify-end";
const CENTRED = "rail:inset-y-0 rail:h-fit rail:max-h-[min(88vh,44rem)] rail:my-auto rail:rounded-sheet";

/** Medium: 560px. */
export const DIALOG_MD = `mx-auto max-w-xl rail:max-w-[35rem] ${CENTRED} ${HEAD} ${TITLE} ${CLOSE} ${FOOT}`;
/** Small: 440px. */
export const DIALOG_SM = `mx-auto max-w-xl rail:max-w-[27.5rem] ${CENTRED} ${HEAD} ${TITLE} ${CLOSE} ${FOOT}`;
