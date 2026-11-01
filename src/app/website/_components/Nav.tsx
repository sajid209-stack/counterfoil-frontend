"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import logoOnInk from "@/app/deck/_media/logo-counterfoil-dark.png";
import { LinkButton } from "./ui";

export const NAV_LINKS = [
  { href: "#system", label: "Product" },
  { href: "#day", label: "How it works" },
  { href: "#types", label: "What you can sell" },
  { href: "#bangladesh", label: "Payments" },
  { href: "#pricing", label: "Pricing" },
] as const;

/**
 * One dark glass bar for the whole page, the Linear way: chapters alternate
 * paper and ink underneath, and a bar that changed colour with them would
 * flicker on every boundary. It starts clear over the ink hero and frosts once
 * the page moves.
 */
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
        "fixed inset-x-0 top-0 z-50 text-[var(--w-fg-ink)] transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled || open
          ? "bg-[rgb(20_20_19/0.9)] shadow-[0_1px_0_rgb(255_255_255/0.07)] backdrop-blur-xl backdrop-saturate-150"
          : "bg-transparent",
      )}
    >
      <nav aria-label="Website" className="mx-auto flex h-16 max-w-[1360px] items-center gap-6 px-5 md:px-8">
        <Link href="/website" aria-label="Counterfoil home" className="flex min-h-11 shrink-0 items-center rounded-md">
          <Image src={logoOnInk} alt="Counterfoil" priority sizes="140px" className="h-[22px] w-auto" />
        </Link>
        <ul className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-3 py-2 text-[14px] text-[var(--w-muted-ink)] transition-colors hover:text-[var(--w-fg-ink)]">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Link href="/sign-in" className="rounded-full px-3 py-2 text-[14px] text-[var(--w-muted-ink)] transition-colors hover:text-[var(--w-fg-ink)]">
            Sign in
          </Link>
          <LinkButton href="/" arrow className="min-h-10 px-4 text-[14px]">
            Try the live demo
          </LinkButton>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid h-11 w-11 place-items-center rounded-full text-[var(--w-fg-ink)] sm:ml-0 lg:hidden"
        >
          {open ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
        </button>
      </nav>

      {/* Phone and tablet: the same links as a full sheet under the bar. */}
      <div id="site-menu" hidden={!open} className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/[0.07] px-5 pb-10 pt-4 lg:hidden">
        <ul className="flex flex-col">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center border-b border-white/[0.07] text-[22px] font-medium tracking-[-0.02em]">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3">
          <LinkButton href="/" arrow className="w-full">
            Try the live demo
          </LinkButton>
          <LinkButton href="/sign-in" variant="ghost" onInk className="w-full">
            Sign in
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
