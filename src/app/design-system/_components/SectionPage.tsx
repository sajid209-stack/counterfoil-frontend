import { PrevNext } from "./DsShell";

/** Every section's page: its content, then previous and next. */
export function SectionPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col gap-wide">
      {children}
      <PrevNext slug={slug} />
    </article>
  );
}
