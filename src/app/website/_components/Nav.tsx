"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import logo from "@/app/deck/_media/logo-counterfoil.png";
import { LinkButton } from "./ui";

export const NAV_LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#engine", label: "Capacity" },
  { href: "#types", label: "What you can sell" },
  { href: "#payments", label: "Payments" },
  { href: "#pricing", label: "Pricing" },
] as const;

/**
 * A thin announcement line, then a white bar with a hairline under it — the
 * attio.com header. The bar frosts slightly once the page moves; it never
 * changes colour, because the page under it never does.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // A restored scroll position fires a scroll event of its own, so there is
    // no need to read it on mount (and no synchronous setState in the effect).
    const on = () => setScrolled(window.scrollY > 40);
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
    <>
      <a
        href="#payments"
        className="group flex min-h-11 items-center md:min-h-10 justify-center gap-2 border-b border-[var(--cf-line)] bg-[var(--cf-bg-2)] px-5 text-center text-[13px] text-[var(--cf-fg-2)]"
      >
        <span className="rounded-full bg-[var(--cf-fg)] px-2 py-0.5 text-[12px] font-medium text-white">Bangladesh</span>
        <span className="truncate">Sell with bKash and Bangla QR at the till, in Bangla or English</span>
        <ArrowRight aria-hidden size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
      </a>
      <header
        data-site-nav
        className={cn(
          "sticky top-0 z-50 border-b border-[var(--cf-line)] transition-[background-color,backdrop-filter] duration-200",
          scrolled || open ? "bg-white/85 backdrop-blur-md" : "bg-white",
        )}
      >
        <nav aria-label="Website" className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-5 md:px-6">
          <Link href="/website" aria-label="Counterfoil home" className="flex min-h-11 shrink-0 items-center rounded-md">
            <Image src={logo} alt="Counterfoil" priority sizes="130px" className="h-[19px] w-auto" />
          </Link>
          <ul className="hidden items-center gap-0.5 lg:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-lg px-2.5 py-1.5 text-[14px] text-[var(--cf-fg-2)] transition-colors hover:bg-[var(--cf-bg-3)] hover:text-[var(--cf-fg)]">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <LinkButton href="/sign-in" variant="light">
              Sign in
            </LinkButton>
            <LinkButton href="/sign-up">Start for free</LinkButton>
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="ml-auto grid h-11 w-11 place-items-center rounded-lg text-[var(--cf-fg)] sm:ml-0 lg:hidden"
          >
            {open ? <X size={20} strokeWidth={1.8} /> : <Menu size={20} strokeWidth={1.8} />}
          </button>
        </nav>

        <div id="site-menu" hidden={!open} className="h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-[var(--cf-line)] bg-white px-5 pb-10 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center border-b border-[var(--cf-line)] text-[18px] font-medium tracking-[-0.01em]">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2.5">
            <LinkButton href="/sign-up" className="w-full">
              Start for free
            </LinkButton>
            <LinkButton href="/sign-in" variant="light" className="w-full">
              Sign in
            </LinkButton>
          </div>
        </div>
      </header>
    </>
  );
}
