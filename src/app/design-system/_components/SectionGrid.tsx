"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GROUPS, SECTIONS, sectionPath } from "../_sections/registry";
import { useDsConfig } from "./DsConfig";

/** Every section as a card, grouped, carrying the current configuration. */
export function SectionGrid() {
  const cfg = useDsConfig();
  return (
    <div className="flex flex-col gap-major">
      {GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-tight">
          <h3 className="text-md font-semibold text-fg">{group}</h3>
          <ul className="grid gap-section sm:grid-cols-2">
            {SECTIONS.filter((s) => s.group === group).map((s) => (
              <li key={s.slug}>
                <Link
                  href={cfg.href(sectionPath(s.slug))}
                  className="card-surface card-interactive flex h-full min-h-11 flex-col gap-inline p-card"
                >
                  <span className="flex items-center gap-tight text-md font-semibold text-fg">
                    <span className="text-sm tabular-nums text-muted">{String(s.number).padStart(2, "0")}</span>
                    {s.title}
                    {s.status !== "done" && (
                      <span className="rounded-full bg-subtle px-tight text-xs font-medium text-muted">{s.status === "partial" ? "Part live" : "Coming"}</span>
                    )}
                    <ArrowRight size={14} strokeWidth={1.5} aria-hidden className="ml-auto text-muted" />
                  </span>
                  <span className="text-sm text-muted">{s.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
