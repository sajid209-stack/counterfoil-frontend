"use client";

import { createContext, useContext } from "react";

/**
 * What the phone's top bar is currently calling this page.
 *
 * The shell pass put the page's name in the bar and took the breadcrumb out,
 * which left every OS page naming itself twice on a phone: once in the sticky
 * bar and again as a 22px heading directly under it — 77px of repetition
 * before any page's own content, on thirty routes.
 *
 * A page cannot just drop its heading, because the bar names the SECTION: on
 * `/catalog/new` the bar says "Catalog" while the page is "Add to your
 * catalog", and hiding that would lose the only thing saying where you are.
 * So the shell publishes what it drew and `PageShell` hides its heading only
 * when the two are the same word.
 *
 * Null outside the OS shell — the till and the print pages have no such bar.
 */
export const BarTitleContext = createContext<string | null>(null);

export const useBarTitle = () => useContext(BarTitleContext);
