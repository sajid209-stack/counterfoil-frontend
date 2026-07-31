"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";

/** OS shell: persistent sidebar on desktop; hamburger slide-over under 768px. */
export function OsShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-full">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-tight border-b border-neutral-200 bg-white px-tight py-inline md:hidden">
          <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-sm active:bg-neutral-200">
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <span className="type-h2 text-base">Counterfoil</span>
          <span className="font-mono text-[11px] text-neutral-400">OS</span>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          {/* any tap inside (a nav link) closes the sheet */}
          <div className="absolute inset-y-0 left-0 overflow-y-auto" onClick={() => setOpen(false)}>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
}
