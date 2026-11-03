"use client";

import { cn } from "@/lib/cn";
import type { PageSectionId } from "@/lib/api/types";
import { sectionAnchor } from "./context";

/**
 * Every body section's frame, so they all start the same way: ONE heading (the
 * page's heading face, size and weight, `.pg-h2`), an optional one-line intro,
 * then the content 20px below. Sections are separated by the page's section
 * gap, never by bands, rules, eyebrows or numbers (docs/product-page.md §3.2).
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
  return (
    <section id={sectionAnchor(id)} aria-labelledby={`${sectionAnchor(id)}-h`} className={cn("pg-section", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id={`${sectionAnchor(id)}-h`} className="pg-h2">
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
