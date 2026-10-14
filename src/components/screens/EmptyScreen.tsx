"use client";

import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ScreenArt } from "./ScreenArt";
import type { EmptySpec } from "./types";

/**
 * A whole page with nothing on it yet.
 *
 * Shopify's Polaris EmptyState, Linear and Stripe agree on the anatomy and it
 * is kept to the letter: a small illustration, ONE headline that says what is
 * missing, ONE line saying why it matters or what will appear, and ONE primary
 * action. A quiet second link is allowed; a third thing is not.
 *
 * Not `EmptyState` from the kit: that one is a stack inside a card or a table
 * ("No results for this filter"). This is the page itself, so it gets the
 * ticket drawing and the room to breathe — and it reads its copy from the
 * screen registry (`screens.empty.<id>.*`), so every page's empty state is
 * specific to the page rather than a shared "No data".
 *
 * `onSelf` is what "this page, live" does. In the page-state preview it
 * returns to the real page; it is omitted where an action of that kind has no
 * meaning, and the button is then not drawn.
 */
export function EmptyScreen({
  spec,
  onSelf,
  className,
}: {
  spec: EmptySpec;
  onSelf?: () => void;
  className?: string;
}) {
  const t = useTranslations("screens");
  /* A page with no copy yet reads as the generic empty page rather than as
     six raw keys. */
  const id = t.has(`empty.${spec.id}.title`) ? spec.id : "generic";
  const Icon = spec.icon;
  const action = spec.action;
  const secondary = spec.secondary && t.has(`empty.${id}.secondary`) ? spec.secondary : undefined;

  return (
    <div className={cn("flex h-full min-h-96 items-center justify-center px-gutter py-hero", className)}>
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <ScreenArt icon={<Icon size={32} strokeWidth={1.5} />} />
        <h2 className="mt-major text-xl font-semibold tracking-title text-fg">{t(`empty.${id}.title`)}</h2>
        <p className="mt-tight max-w-sm text-base text-muted">{t(`empty.${id}.body`)}</p>
        {action && t.has(`empty.${id}.action`) && (
          <div className="mt-major flex flex-col items-center gap-tight sm:flex-row">
            {action === "self" ? (
              onSelf && <Button onClick={onSelf}>{t(`empty.${id}.action`)}</Button>
            ) : (
              <ButtonLink href={action} variant="primary">
                {t(`empty.${id}.action`)}
              </ButtonLink>
            )}
            {secondary && (
              <ButtonLink href={secondary} variant="tertiary">
                {t(`empty.${id}.secondary`)}
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
