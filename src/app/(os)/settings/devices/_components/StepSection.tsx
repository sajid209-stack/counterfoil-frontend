import { useId } from "react";

/**
 * A card for one numbered step of a short job. Same card as a settings section;
 * the number in front of the title is what says "this is step 2 of 3".
 */
export function StepSection({
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
    <section aria-labelledby={id} data-step={n} className="card-surface overflow-hidden">
      <header className="flex items-start gap-comfortable px-card pb-section pt-card">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-[13px] font-semibold text-fg ring-1 ring-inset ring-hairline"
        >
          {n}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="pt-[3px] text-base font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-inline max-w-prose text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
      </header>
      <div className="divide-y divide-hairline border-t border-hairline">{children}</div>
    </section>
  );
}
