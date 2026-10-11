import { Check, Hourglass, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { sectionBySlug } from "../_sections/registry";
import { CopyButton } from "./CopyButton";

/**
 * The documentation vocabulary every section is written in.
 *
 * The docs eat their own food: a page title is the spec's page-title recipe, a
 * section heading its section-title recipe, body is `text-base`, and supporting
 * text is `text-sm text-muted`. Nothing here is a bespoke size.
 */

/** The h1 and lead of a section. The group and number are the eyebrow. */
export function SectionHeader({ slug }: { slug: string }) {
  const s = sectionBySlug(slug);
  if (!s) return null;
  return (
    <header>
      <p className="text-sm text-muted">
        {s.group} · {String(s.number).padStart(2, "0")}
      </p>
      <h1 className="mt-inline text-2xl font-semibold tracking-title text-fg sm:text-3xl">{s.title}</h1>
      <p className="mt-tight max-w-prose text-md text-muted">{s.summary}</p>
    </header>
  );
}

/** An h2 and what belongs under it. `id` is the anchor and the "On this page" entry. */
export function DocSection({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 scroll-mt-32 flex-col gap-section", className)}>
      <h2 id={id} className="scroll-mt-32 text-xl font-semibold tracking-title text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** An h3 inside a DocSection. */
export function Sub({ title, children, id }: { title: string; children?: React.ReactNode; id?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-tight">
      <h3 id={id} className="text-md font-semibold text-fg">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Body copy. */
export function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("max-w-prose text-base text-fg", className)}>{children}</p>;
}

/** Supporting copy. */
export function Small({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("max-w-prose text-sm text-muted", className)}>{children}</p>;
}

/** An identifier in running text: a token, a class, a prop. DM Mono is for identifiers. */
export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return <code className={cn("rounded-xs bg-subtle px-1 py-0.5 font-mono text-sm text-fg", className)}>{children}</code>;
}

/** A quiet aside — one fact worth stopping on. */
export function Callout({ title, children, tone = "neutral" }: { title?: string; children: React.ReactNode; tone?: "neutral" | "warning" }) {
  return (
    <aside className={cn("rounded-md p-comfortable text-sm", tone === "warning" ? "bg-warning-wash text-fg" : "bg-subtle text-fg")}>
      {title && <p className="mb-inline font-semibold">{title}</p>}
      <div className="max-w-prose">{children}</div>
    </aside>
  );
}

/** Do and don't, side by side. The words carry it; the icons only decorate. */
export function DoDont({ dos, donts }: { dos: React.ReactNode[]; donts: React.ReactNode[] }) {
  return (
    <div className="grid gap-section md:grid-cols-2">
      <div className="card-surface p-card">
        <p className="flex items-center gap-tight text-base font-semibold text-success">
          <Check size={16} strokeWidth={1.75} aria-hidden />
          Do
        </p>
        <ul className="mt-tight flex list-disc flex-col gap-tight pl-section text-sm text-fg marker:text-muted">
          {dos.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>
      <div className="card-surface p-card">
        <p className="flex items-center gap-tight text-base font-semibold text-danger">
          <X size={16} strokeWidth={1.75} aria-hidden />
          Don&rsquo;t
        </p>
        <ul className="mt-tight flex list-disc flex-col gap-tight pl-section text-sm text-fg marker:text-muted">
          {donts.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export interface PropRow {
  prop: string;
  type: string;
  default?: string;
  description: React.ReactNode;
}

/** A compact props table. A wide one scrolls inside its card, never the page;
 *  on a phone each row stacks instead. */
export function PropsTable({ rows, caption = "Props" }: { rows: PropRow[]; caption?: string }) {
  return (
    <div className="card-surface min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="max-md:sr-only">
            <tr className="border-b border-hairline text-muted">
              <th scope="col" className="px-card py-tight font-medium">
                Prop
              </th>
              <th scope="col" className="px-card py-tight font-medium">
                Type
              </th>
              <th scope="col" className="px-card py-tight font-medium">
                Default
              </th>
              <th scope="col" className="px-card py-tight font-medium">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.prop} className="border-b border-hairline last:border-0 max-md:flex max-md:flex-col max-md:gap-inline max-md:px-card max-md:py-comfortable">
                <td className="px-card py-comfortable align-top max-md:p-0">
                  <code className="font-mono text-sm font-medium text-fg">{r.prop}</code>
                </td>
                <td className="px-card py-comfortable align-top max-md:p-0">
                  <code className="break-words font-mono text-xs text-muted">{r.type}</code>
                </td>
                <td className="px-card py-comfortable align-top max-md:p-0">
                  {r.default ? <code className="font-mono text-xs text-muted">{r.default}</code> : <span className="text-muted">—</span>}
                </td>
                <td className="min-w-[14rem] px-card py-comfortable align-top text-fg max-md:min-w-0 max-md:p-0">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The import line, with a copy button. */
export function ImportLine({ code }: { code: string }) {
  return (
    <div className="flex min-w-0 items-center gap-tight rounded-md bg-subtle py-inline pl-comfortable pr-inline">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-tight font-mono text-sm text-fg">{code}</code>
      <CopyButton text={code} label="import line" />
    </div>
  );
}

/** A multi-line snippet, with a copy button. */
export function CodeBlock({ code, label = "snippet" }: { code: string; label?: string }) {
  return (
    <div className="relative min-w-0 rounded-md bg-subtle">
      <pre className="overflow-x-auto p-comfortable pr-12 font-mono text-sm leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
      <div className="absolute right-inline top-inline">
        <CopyButton text={code} label={label} />
      </div>
    </div>
  );
}

/**
 * The section's component write-up in its fixed order: a live demo (children),
 * the import line, the props, then do and don't. A page cannot describe one
 * component in a different order from the next.
 */
export function ComponentDoc({
  id,
  title,
  summary,
  demo,
  importCode,
  props,
  dos,
  donts,
}: {
  id: string;
  title: string;
  summary?: React.ReactNode;
  demo?: React.ReactNode;
  importCode: string;
  props: PropRow[];
  dos: React.ReactNode[];
  donts: React.ReactNode[];
}) {
  return (
    <DocSection id={id} title={title}>
      {summary && <P>{summary}</P>}
      {demo}
      <ImportLine code={importCode} />
      <Sub title="Props">
        <PropsTable rows={props} caption={`${title} props`} />
      </Sub>
      <Sub title="Do and don’t">
        <DoDont dos={dos} donts={donts} />
      </Sub>
    </DocSection>
  );
}

/** What a section shows while the components it documents are still landing. */
export function Placeholder({ title = "Coming in this pass", components, children }: { title?: string; components: string[]; children?: React.ReactNode }) {
  return (
    <div className="card-surface flex flex-col gap-tight p-card">
      <p className="flex items-center gap-tight text-md font-semibold text-fg">
        <Hourglass size={18} strokeWidth={1.5} aria-hidden className="text-muted" />
        {title}
      </p>
      {children && <div className="max-w-prose text-sm text-muted">{children}</div>}
      <ul className="flex flex-wrap gap-tight">
        {components.map((c) => (
          <li key={c} className="rounded-full bg-subtle px-comfortable py-inline text-sm font-medium text-fg">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
