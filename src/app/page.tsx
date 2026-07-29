import Link from "next/link";

// Root launcher — a surface picker. Not a product screen; just a way into the
// two surfaces (and auth) so the demo is clickable from "/".
const SURFACES = [
  {
    href: "/dashboard",
    code: "OS",
    title: "Operator admin",
    desc: "Configuration, management, reporting. Desktop, dense.",
  },
  {
    href: "/pos",
    code: "Go",
    title: "Front of house",
    desc: "Point of sale, scanning, shifts. Tablet, touch.",
  },
  {
    href: "/sign-in",
    code: "Auth",
    title: "Sign in",
    desc: "Sign in, sign up, invitation accept.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-section py-hero">
      <p className="type-label text-[13px] text-ember">Counterfoil</p>
      <h1 className="type-display mt-tight text-5xl">Two surfaces, one system.</h1>
      <p className="type-body mt-section max-w-xl text-neutral-600">
        Operator-owned platform for venues, tours, and attractions. Pick a
        surface.
      </p>

      <div className="mt-major grid gap-tight sm:grid-cols-3">
        {SURFACES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-md border border-neutral-200 bg-white p-section transition-colors duration-quick ease-counterfoil hover:border-ink"
          >
            <span className="font-mono text-xs text-neutral-400">{s.code}</span>
            <h2 className="type-h2 mt-tight text-lg">{s.title}</h2>
            <p className="type-body mt-inline text-[13px] text-neutral-600">
              {s.desc}
            </p>
          </Link>
        ))}
      </div>

      <Link
        href="/tokens"
        className="mt-major font-mono text-xs text-neutral-400 hover:text-ember"
      >
        /tokens · design reference
      </Link>
    </main>
  );
}
