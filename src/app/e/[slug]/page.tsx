"use client";

/**
 * An event's public page — the address the catalogue has been printing as
 * "not live yet" since events were built.
 *
 * What it is for, stated plainly because it decides everything below: it
 * **publishes**, it does not sell. Online checkout is deferred in this project,
 * so a page with a basket on it would be promising a flow that does not exist.
 * It answers what is on, when, where and what it costs, and says where a ticket
 * is actually bought — the same contract the venue storefront follows, and
 * shaped so a basket can be added later without moving any of it.
 *
 * The page itself is `EventTemplate`, the very component the designer previews
 * in the catalogue. One renderer, so what an operator approves is what a
 * visitor gets — the rule the seat plan and the printed receipt already follow.
 */
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EventTemplate } from "@/components/events/EventTemplate";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";
import { useApiQuery } from "@/lib/useApi";
import { getPublicEvent } from "@/lib/api";
import { demoNow } from "@/lib/schedule";
import { MD, useMediaQuery } from "@/lib/useMedia";

export default function PublicEventPage() {
  const params = useParams<{ slug: string }>();
  const t = useTranslations("eventPage");
  const q = useApiQuery(() => getPublicEvent(params.slug), [params.slug]);
  /* The labels are per category — the words a conference page uses are not the
     words a rave uses, which is the whole point of the six templates. */
  const base = useTemplateLabels(q.data?.categoryId ?? null);
  /**
   * The two strings a live page must not inherit from the preview.
   *
   * "Continue to checkout · Secure checkout · Instant e-tickets" is the right
   * mock-up inside the designer — it shows an operator what their page will
   * look like. On a page a visitor is actually reading it is a promise this
   * product cannot keep: there is no online checkout. So the live page says
   * where a ticket is really bought, which is the same contract the venue
   * storefront follows — it publishes, it does not sell.
   */
  const labels = useMemo(
    () => ({
      ...base,
      checkout: t("buyAtVenue"),
      checkoutTrust: q.data ? t("soldAt", { venue: q.data.venueName }) : base.checkoutTrust,
    }),
    [base, q.data, t],
  );
  /* Fixed rather than read from the clock, so the countdown is the same number
     on the server and in the browser — a live `new Date()` hydrates to a
     different second and React rebuilds the page. */
  const now = useMemo(() => demoNow(), []);
  /* The template carries its own two layouts and switches on `device` — the
     prop the designer's preview toggles. On a real page the viewport decides,
     through the same media query the app shell uses. Without this the desktop
     layout renders at 390px and the page scrolls 191px sideways. */
  const wide = useMediaQuery(MD);

  if (q.loading) {
    return (
      <div className="min-h-screen bg-surface px-gutter py-hero" aria-busy="true">
        <div className="mx-auto max-w-5xl animate-pulse space-y-section">
          <div className="h-10 w-2/3 rounded-sm bg-line" />
          <div className="h-4 w-1/2 rounded-sm bg-line" />
          <div className="h-64 rounded-md bg-line/60" />
        </div>
      </div>
    );
  }

  /* A draft and an address nobody has taken are refused identically: telling a
     guesser "not published yet" tells them they are close. */
  if (!q.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-gutter">
        <div className="max-w-md text-center">
          <h1 className="type-h1 text-[1.75rem]">{t("missingTitle")}</h1>
          <p className="mt-tight text-muted">{t("missingBody")}</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <EventTemplate event={q.data} device={wide ? "desktop" : "mobile"} labels={labels} now={now} />
    </main>
  );
}
