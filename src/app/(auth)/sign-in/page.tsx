import Link from "next/link";

export const metadata = { title: "Sign in · Counterfoil" };

// Placeholder sign-in shell — static; wired to the auth flow in a later phase.
export default function SignInPage() {
  return (
    <div className="rounded-md border border-line bg-card p-major">
      <p className="type-label text-[13px] text-ember">Counterfoil</p>
      <h1 className="type-h1 mt-inline text-2xl">Sign in</h1>

      <div className="mt-major flex flex-col gap-tight">
        <label className="type-label text-[12px] text-muted">Email</label>
        <input
          type="email"
          placeholder="you@operator.com"
          className="h-11 rounded-sm border border-line px-comfortable text-sm outline-none focus:border-inverse"
        />
      </div>

      <div className="mt-section flex flex-col gap-tight">
        <label className="type-label text-[12px] text-muted">Password</label>
        <input
          type="password"
          placeholder="••••••••"
          className="h-11 rounded-sm border border-line px-comfortable text-sm outline-none focus:border-inverse"
        />
      </div>

      <button
        type="button"
        className="mt-major flex h-11 w-full items-center justify-center rounded-sm bg-inverse text-sm font-medium text-inverse-fg"
      >
        Sign in
      </button>

      <p className="type-body mt-section text-center text-[13px] text-faint">
        <Link href="/" className="hover:text-ember">
          Back to launcher
        </Link>
      </p>
    </div>
  );
}
