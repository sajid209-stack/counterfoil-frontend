import Image from "next/image";
import Link from "next/link";
import logoOnInk from "@/app/deck/_media/logo-counterfoil-dark.png";
import { Container } from "./ui";

/* Every link here goes somewhere real in this app. A footer full of "Careers",
   "Press" and "Blog" pointing at nothing teaches the reader to distrust it. */
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Counterfoil OS", href: "#system" },
      { label: "Counterfoil Go", href: "#day" },
      { label: "What you can sell", href: "#types" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "See it",
    links: [
      { label: "Live demo", href: "/" },
      { label: "Point of Sale", href: "/pos" },
      { label: "Company deck", href: "/deck" },
      { label: "Design System", href: "/design-system" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/sign-in" },
      { label: "Create an account", href: "/sign-up" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="w-ink relative overflow-hidden pb-10 pt-20">
      <Container wide>
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Image src={logoOnInk} alt="Counterfoil" sizes="160px" className="h-[24px] w-auto" />
            <p className="mt-5 max-w-[300px] text-[14px] leading-relaxed text-[var(--w-muted-ink)]">
              The system for places that sell time — tickets, sessions, courts and tours.
            </p>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <p className="w-eyebrow text-[12px] text-[var(--w-muted-ink)]">{c.title}</p>
              <ul className="mt-4 flex flex-col gap-1">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("#") ? (
                      <a href={l.href} className="inline-flex min-h-11 items-center text-[14px] md:min-h-9 text-[var(--w-fg-ink)]/85 transition-colors hover:text-[var(--w-ember-soft)]">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="inline-flex min-h-11 items-center text-[14px] md:min-h-9 text-[var(--w-fg-ink)]/85 transition-colors hover:text-[var(--w-ember-soft)]">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.08] pt-6 text-[13px] text-[var(--w-muted-ink)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Counterfoil · Built by Ternary Solutions</p>
          <p className="w-mono text-[12px]">Built in Bangladesh · Ready anywhere</p>
        </div>
      </Container>
      {/* The wordmark set huge and cut off at the foot, as a signature. */}
      <p aria-hidden className="pointer-events-none mt-14 select-none text-center text-[18vw] font-semibold leading-[0.75] tracking-[-0.06em] text-white/[0.04]">
        counterfoil
      </p>
    </footer>
  );
}
