"use client";

import { useId } from "react";

/** One numbered section of the Add member page: a card with its step number, a title and a line. */
export function StepCard({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="card-surface p-card">
      <header className="flex items-start gap-comfortable">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-subtle text-sm font-semibold text-fg ring-1 ring-inset ring-line">
          {n}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-md font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-inline text-sm text-muted">{description}</p>}
        </div>
      </header>
      <div className="mt-section">{children}</div>
    </section>
  );
}
