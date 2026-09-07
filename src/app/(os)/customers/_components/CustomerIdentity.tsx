"use client";

import { AlertTriangle, Mail, Phone } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Customer } from "@/lib/api";

/** Initials from a name, at most two — "Mohammad Abdur Rahman Chowdhury"
 *  becomes MC, not MARC. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Who this person is, before anything they have done.
 *
 * The page opened straight onto six figures. The name was the page title and
 * the contact details a subtitle string, so the record had no face and no
 * shape — and the **tags the list shows on every row were nowhere on the
 * record itself**, which is the wrong way round: a list abbreviates, a detail
 * page is where the whole thing lives.
 *
 * The phone and e-mail are links now. Reading a number off a CRM and typing it
 * into a phone by hand is not a workflow anybody should be given twice.
 */
export function CustomerIdentity({
  customer,
  since,
  labels,
}: {
  customer: Customer;
  /** "Customer since March 2024" — tenure, which the record knows and the
   *  page never said. */
  since: string;
  labels: { noContact: string; flagged: string; archived: string };
}) {
  const hasContact = !!(customer.phone || customer.email);
  /* Whether the badge row has anything to say at all — an empty flex row
     still spends a gap. */
  const badges = [customer.flag, customer.status === "archived" ? "archived" : null, ...customer.tags].filter(Boolean);

  return (
    <div className="card-surface flex flex-col gap-comfortable p-comfortable sm:flex-row sm:items-center sm:gap-section">
      <span
        aria-hidden
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold",
          // A flagged customer is the one case where the face itself should
          // carry the warning — it is the first thing on the page.
          customer.flag ? "bg-warning/15 text-warning" : "bg-ember/10 text-brand-foreground",
        )}
      >
        {initialsOf(customer.name)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-tight">
        {/* No name here: the page heading directly above already is the name,
            and printing it twice forty pixels apart is not emphasis. What the
            heading cannot carry is the flag, the lifecycle and the tags. */}
        {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-tight">
          {customer.flag && (
            <StatusPill tone="warning">
              <AlertTriangle size={11} strokeWidth={2.5} aria-hidden className="mr-0.5 inline" />
              {labels.flagged}
            </StatusPill>
          )}
          {customer.status === "archived" && (
            <StatusPill tone="neutral">{labels.archived}</StatusPill>
          )}
          {/* The tags the list has always shown, finally on the record. */}
          {customer.tags.map((tag) => (
            <StatusPill key={tag} tone="neutral">
              {tag}
            </StatusPill>
          ))}
        </div>
        )}

        {hasContact ? (
          <div className="flex flex-wrap items-center gap-x-section gap-y-tight text-[13px]">
            {customer.phone && (
              <a
                href={`tel:${customer.phone.replace(/\s+/g, "")}`}
                className="flex items-center gap-tight font-mono text-fg underline-offset-2 hover:underline"
              >
                <Phone size={13} strokeWidth={1.8} aria-hidden className="text-muted" />
                {customer.phone}
              </a>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="flex min-w-0 items-center gap-tight text-fg underline-offset-2 hover:underline"
              >
                <Mail size={13} strokeWidth={1.8} aria-hidden className="shrink-0 text-muted" />
                <span className="min-w-0 break-all">{customer.email}</span>
              </a>
            )}
            <span className="text-[12px] text-muted">{since}</span>
          </div>
        ) : (
          <p className="text-[13px] text-muted">
            {labels.noContact} · <span className="text-muted">{since}</span>
          </p>
        )}
      </div>
    </div>
  );
}
