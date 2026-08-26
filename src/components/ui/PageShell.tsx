"use client";

import { usePathname } from "next/navigation";

// Standard page frame for OS screens: DM Mono breadcrumb (derived from the
// path), title, optional description, actions slot.
export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = pathname
    .split("/")
    .filter((s) => s && /^[a-z-]+$/.test(s)) // words only — ids stay out
    .map((s) => s.replace(/-/g, " "));

  return (
    <div className="px-section py-section sm:px-major sm:py-major">
      <div className="flex flex-col gap-tight sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {crumbs.length > 0 && (
            <p className="mb-inline font-mono text-[12px] uppercase tracking-wide text-faint">
              {["os", ...crumbs].join(" / ")}
            </p>
          )}
          {/* References and long names must wrap, never bleed out of the header. */}
          <h1 className="type-h1 break-words text-2xl">{title}</h1>
          {description && (
            <p className="type-body mt-inline max-w-2xl text-[13px] text-muted">
              {description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-tight">
          {actions}
        </div>
      </div>
      <div className="mt-major">{children}</div>
    </div>
  );
}
