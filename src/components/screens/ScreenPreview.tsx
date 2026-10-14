"use client";

import { setScreenState, type ScreenState } from "@/lib/screenState";
import { EmptyScreen } from "./EmptyScreen";
import { PageSkeleton } from "./PageSkeleton";
import { errorReference } from "./reference";
import { resolveScreen } from "./registry";
import { StatusScreen } from "./StatusScreen";

/**
 * The face a page wears in a given state — what both shells draw in place of
 * the page when the developer picks a state from the top bar.
 *
 * A page never knows it is being previewed: this is the same skeleton, empty
 * page and status pages the real states use, picked by the same registry, so
 * what a designer approves here is what a customer eventually sees.
 *
 *   loading        the page's skeleton shape
 *   empty          the page's own empty state (specific copy, one action)
 *   error          the error page, with a sample reference code
 *   notFound       the not-found page
 *   sessionExpired the signed-out page
 *
 * Returns null for `live`, so a shell can write `{face ?? children}`.
 * "Try again" and any action that means "this page, live" put the preview
 * back to live, which is what a developer pressing them expects.
 */
export function ScreenPreview({ state, pathname }: { state: ScreenState; pathname: string }) {
  if (state === "live") return null;
  const entry = resolveScreen(pathname);
  const live = () => setScreenState("live");

  switch (state) {
    case "loading":
      return <PageSkeleton shape={entry.shape} />;
    case "empty":
      return <EmptyScreen spec={entry.empty} onSelf={live} />;
    case "error":
      return <StatusScreen variant="error" framed surface={entry.surface} reference={errorReference({ message: "preview" })} onRetry={live} />;
    case "notFound":
      return <StatusScreen variant="notFound" framed surface={entry.surface} onSearch={entry.surface === "os" ? openPalette : undefined} />;
    case "sessionExpired":
      return <StatusScreen variant="sessionExpired" framed surface={entry.surface} />;
  }
}

/** The admin's command palette listens for Ctrl/⌘ K on the document; pressing
 *  "Search pages" sends it exactly that, so there is one way in. */
export function openPalette() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}
