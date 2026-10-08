"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";

/**
 * Secondary sections that fold behind one labelled row on a phone.
 *
 * A record page opens on the things you came to change; everything else — the
 * sign-in controls, the paired tablets, the web links — is one tap away rather
 * than a second screenful between you and the Save bar. From md there is room
 * for all of it, so it is drawn open and there is no control at all.
 *
 * The row is not a card around the sections: they are cards already, and a
 * card in a card is the double frame this pass removes. So the row is its own
 * quiet card, and what it reveals follows it as ordinary sections.
 *
 * It is a real button with `aria-expanded`, 44px tall at least, and the
 * sections are mounted only while open — not hidden-but-in-the-DOM copies.
 */
export function FoldOnPhone({
  title,
  summary,
  children,
}: {
  title: string;
  /** One quiet line under the title: a status, a count. */
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const wide = useMediaQuery(MD);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (wide) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="card-surface flex min-h-14 w-full items-center justify-between gap-comfortable p-card text-left transition-colors duration-quick"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-fg">{title}</span>
          {summary ? <span className="mt-inline block text-[13px] text-muted">{summary}</span> : null}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          aria-hidden
          className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-section">
          {children}
        </div>
      ) : null}
    </>
  );
}
