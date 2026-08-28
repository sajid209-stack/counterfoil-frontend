import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata = { title: "Sign in · Counterfoil" };

// Branded sign-in front door — static shell; wired to the auth flow later.
export default function SignInPage() {
  return (
    <div className="card-surface p-major">
      <Logo size={28} />

      <h1 className="type-h1 mt-major text-2xl">Welcome back</h1>
      <p className="type-body mt-inline text-[13px] text-muted">Sign in to run your counter.</p>

      <div className="mt-major flex flex-col gap-tight">
        <label className="type-label text-[12px] text-muted">Email</label>
        <input
          type="email"
          placeholder="you@operator.com"
          className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none transition-colors duration-quick focus:border-ember focus:ring-2 focus:ring-ember/20"
        />
      </div>

      <div className="mt-section flex flex-col gap-tight">
        <div className="flex items-baseline justify-between">
          <label className="type-label text-[12px] text-muted">Password</label>
          <Link href="/forgot-password" className="text-[12px] text-faint hover:text-ember">Forgot password?</Link>
        </div>
        <input
          type="password"
          placeholder="••••••••"
          className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none transition-colors duration-quick focus:border-ember focus:ring-2 focus:ring-ember/20"
        />
      </div>

      <button
        type="button"
        className="mt-major flex h-11 w-full items-center justify-center rounded-sm bg-ember text-sm font-medium text-white transition-colors duration-quick hover:bg-brand-600 active:bg-brand-700"
      >
        Sign in
      </button>

      <p className="type-body mt-section text-center text-[13px] text-faint">
        <Link href="/" className="hover:text-ember">Back to launcher</Link>
      </p>
    </div>
  );
}
