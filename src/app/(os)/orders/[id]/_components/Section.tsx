import { cn } from "@/lib/cn";

/**
 * One card on the order page: a small heading, an optional action at its right
 * edge, and the content. The page is a stack of these, so they all share one
 * heading size, one padding and one rhythm.
 *
 * `className` is for the page to place the card — its `order-*` on a phone,
 * where the Money card has to follow the facts directly — not for restyling it.
 */
export function Section({
  title,
  action,
  id,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className={cn("card-surface min-w-0 scroll-mt-24 p-card", className)}>
      <div className="mb-section flex items-center justify-between gap-tight">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Shown where a card has nothing yet — said in a sentence, not left blank. */
export function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-muted">{children}</p>;
}
