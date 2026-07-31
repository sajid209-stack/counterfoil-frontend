"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";

/** OS shell. The aside fills and holds the viewport (h-screen sticky); main
 *  takes min-w-0 + overflow-x-hidden so wide children scroll inside their own
 *  cards, never the page. Collapsible to a 64px icon rail; hamburger sheet
 *  under 768px. */
export function OsShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false); // mobile sheet
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("os_sidebar_collapsed") === "1");
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("os_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen shrink-0 overflow-y-auto md:block">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex items-center gap-tight border-b border-neutral-200 bg-white px-tight py-inline md:hidden">
          <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-sm active:bg-neutral-200">
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <span className="type-h2 text-base">Counterfoil</span>
          <span className="font-mono text-[11px] text-neutral-400">OS</span>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </main>

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
