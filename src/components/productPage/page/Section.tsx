"use client";

import { cn } from "@/lib/cn";
import type { PageSectionId } from "@/lib/api/types";
import { sectionAnchor, usePage } from "./context";

/**
 * Every body section's frame, so they all start the same way: a 24/32
 * semibold heading (the display face in an editorial look), an optional one-line
 * intro, then the content 20px below. Sections are separated by space, never by
 * bands, rules, eyebrows or numbers (docs/product-page.md §3.2).
 */
export function Section({
  id,
  title,
  intro,
  aside,
  className,
  children,
}: {
  id: PageSectionId;
  title: string;
  intro?: string;
  /** Right of the heading: a "See all", tabs. */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const { look } = usePage();
  const editorial = look.personality === "editorial";
  return (
    <section id={sectionAnchor(id)} aria-labelledby={`${sectionAnchor(id)}-h`} className={cn("pg-section", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2
            id={`${sectionAnchor(id)}-h`}
            className="pg-h2"
            style={editorial ? { fontFamily: "var(--pg-display)", fontWeight: 500 } : undefined}
          >
            {title}
          </h2>
          {intro && <p className="pg-intro">{intro}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
