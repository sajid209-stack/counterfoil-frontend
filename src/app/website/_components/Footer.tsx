import Image from "next/image";
import Link from "next/link";
import logo from "@/app/deck/_media/logo-counterfoil.png";

/* Every link here goes somewhere real in this app. A footer full of "Careers",
   "Press" and "Blog" pointing at nothing teaches the reader to distrust it. */
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Counterfoil Go", href: "#go" },
      { label: "Counterfoil OS", href: "#os" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
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

const link = "inline-flex min-h-11 min-w-11 items-center text-[14px] text-[var(--cf-muted)] transition-colors hover:text-[var(--cf-fg)] md:min-h-8";

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1264px] px-5 pb-10 pt-16 md:px-8">
      <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Image src={logo} alt="Counterfoil" sizes="130px" className="h-[19px] w-auto" />
          <p className="mt-4 max-w-[280px] text-[14px] leading-relaxed text-[var(--cf-muted)]">
            The system for places that sell time — tickets, sessions, courts and tours.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="text-[13px] font-medium text-[var(--cf-fg)]">{c.title}</p>
            <ul className="mt-3 flex flex-col">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("#") ? (
                    <a href={l.href} className={link}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={link}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-14 flex flex-col gap-2 pt-6 text-[13px] text-[var(--cf-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Counterfoil · Built by Ternary Solutions</p>
        <p>Built in Bangladesh · Ready anywhere</p>
      </div>
    </footer>
  );
}
