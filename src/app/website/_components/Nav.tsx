"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import logo from "@/app/deck/_media/logo-counterfoil.png";
import { LinkButton } from "./ui";

export const NAV_LINKS = [
  { href: "#go", label: "Counterfoil Go" },
  { href: "#os", label: "Counterfoil OS" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

/** A white bar that gains a hairline once the page moves. */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // A restored scroll position fires a scroll event of its own, so there is
    // no need to read it on mount (and no synchronous setState in the effect).
    const on = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      data-site-nav
      className={cn(
        "sticky top-0 z-50 bg-white/90 backdrop-blur-md transition-shadow duration-200",
        (scrolled || open) && "shadow-[0_1px_0_var(--cf-line)]",
      )}
    >
      <nav aria-label="Website" className="mx-auto flex h-16 max-w-[1264px] items-center gap-8 px-5 md:px-8">
        <Link href="/website" aria-label="Counterfoil home" className="flex min-h-11 shrink-0 items-center rounded-md">
          <Image src={logo} alt="Counterfoil" priority sizes="140px" className="h-5 w-auto" />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-lg px-3 py-2 text-[15px] text-[var(--cf-fg)] transition-colors hover:bg-[var(--cf-paper)]">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <LinkButton href="/sign-in" variant="secondary" size="sm">
            Sign in
          </LinkButton>
          <LinkButton href="/sign-up" size="sm">
            Start for free
          </LinkButton>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid h-11 w-11 place-items-center rounded-lg sm:ml-0 lg:hidden"
        >
          {open ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
        </button>
      </nav>
      <div id="site-menu" hidden={!open} className="h-[calc(100dvh-4rem)] overflow-y-auto bg-white px-5 pb-10 pt-2 lg:hidden">
        <ul className="flex flex-col">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center text-[20px] font-medium tracking-[-0.01em]">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3">
          <LinkButton href="/sign-up" className="w-full">
            Start for free
          </LinkButton>
          <LinkButton href="/sign-in" variant="secondary" className="w-full">
            Sign in
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
