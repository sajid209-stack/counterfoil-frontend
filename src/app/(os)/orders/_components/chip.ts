import { cn } from "@/lib/cn";

export interface ChipOption {
  value: string;
  label: string;
}

/**
 * The look every chip on a list's toolbar shares — the date, the Filters button,
 * and each applied filter — so the row reads as one.
 *
 * A set filter is a quiet grey tint, not the brand colour: orange is the page's
 * one primary action, and a toolbar full of orange-edged chips says "something
 * is wrong" about a person who simply chose a date. 46px outside is 44px inside
 * the border on a phone, where the trigger is the touch target.
 */
export const chipBox = (active: boolean, open: boolean) =>
  cn(
    "flex h-[46px] min-w-0 max-w-full items-stretch rounded-sm border bg-card text-[0.8125rem] transition-colors duration-quick md:h-9",
    active ? "border-line bg-muted-wash" : open ? "border-strong" : "border-line hover:border-strong",
  );
