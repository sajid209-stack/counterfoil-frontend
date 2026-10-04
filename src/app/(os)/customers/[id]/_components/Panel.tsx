"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * One card on the customer page: a small label, an optional action on the
 * right, then the content. The order page's card anatomy, so the two records
 * read as the same family — and one definition, so the eight cards here cannot
 * drift into eight paddings.
 */
export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  /** One control at the right of the heading — Edit, a count. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("card-surface p-card", className)}>
      <div className="mb-comfortable flex items-center justify-between gap-tight">
        <h2 id={id} className="min-w-0 text-[1rem] font-semibold tracking-[-0.4px] text-fg">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
