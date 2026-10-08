"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SETTINGS_GROUPS, useResourceNoun } from "./_lib/nav";
import { BarBack, useBackInBar } from "@/components/ui/PageShell";
import { BackToList } from "./_components/SettingsNav";

/**
 * The settings frame — which is now only a width.
 *
 * Settings works the way Shopify admin's does: the main rail folds to its icon
 * column and a second column of settings sections stands beside it, ON THE
 * CHROME, outside the page. That column is drawn by the shell (`SettingsColumn`
 * in the OS shell), because it belongs to the window and not to the page — it
 * keeps its place while the page scrolls, and it is white like the rail. So this
 * layout no longer carries a rail beside the page, nor the "Settings" menu
 * button that opened the same list below xl. On a phone the top bar's back
 * chevron opens the list as a sheet.
 *
 * What is left is the page itself, centred in the frame at a reading width. The
 * forms inside cap themselves at 3xl or 4xl and used to sit against the rail's
 * edge; centred in a wider box that would leave them off-centre, so those two
 * caps are lifted inside this box — the box is the cap now.
 *
 * A record (/settings/team/stf_nadia, /settings/roles/new) still carries a way
 * back to its list, at every width: the list is where someone who opened the
 * record came from, and a link in the page is closer than the column.
 *
 * The storefront editor is the one page that needs the whole frame: its live
 * preview sits beside the form from 1536px.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("settings");
  const noun = useResourceNoun();

  const parent = SETTINGS_GROUPS.flatMap((g) => g.items).find((item) => pathname.startsWith(`${item.href}/`));
  const back = parent && { href: parent.href, label: parent.key === "resources" && noun ? noun : t(`nav.items.${parent.key}.title`) };
  const wide = /^\/settings\/storefront\/[^/]+/.test(pathname);
  /* On a phone the way back is the top bar's arrow, to the same list; the link
     in the page is for md and up, where the bar has no arrow. */
  const backInBar = useBackInBar();

  return (
    <div
      data-settings-page
      className={
        wide
          ? "min-w-0"
          : "mx-auto w-full min-w-0 max-w-[880px] [&_.max-w-3xl]:max-w-none [&_.max-w-4xl]:max-w-none"
      }
    >
      {back && <BarBack href={back.href} label={back.label} />}
      {back && !backInBar && (
        <div className="px-gutter pt-gutter">
          <BackToList href={back.href} label={back.label} />
        </div>
      )}
      {children}
    </div>
  );
}
