import Link from "next/link";

export const metadata = { title: "Sign up · Counterfoil" };

export default function SignUpPage() {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-major">
      <p className="type-label text-[13px] text-ember">Counterfoil</p>
      <h1 className="type-h1 mt-inline text-2xl">Create your operator</h1>

      <div className="mt-major flex flex-col gap-section">
        {[
          { label: "Business name", type: "text", ph: "Lalbagh Heritage Attractions" },
          { label: "Your name", type: "text", ph: "Rahim Uddin" },
          { label: "Email", type: "email", ph: "you@operator.com" },
          { label: "Password", type: "password", ph: "••••••••" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-tight">
            <label className="type-label text-[12px] text-neutral-600">{f.label}</label>
            <input type={f.type} placeholder={f.ph} className="h-11 rounded-sm border border-neutral-200 px-comfortable text-sm outline-none focus:border-ink" />
          </div>
        ))}
      </div>

      <button type="button" className="mt-major flex h-11 w-full items-center justify-center rounded-sm bg-ink text-sm font-medium text-paper">
        Create operator
      </button>
      <p className="type-body mt-section text-center text-[13px] text-neutral-400">
        Have an account? <Link href="/sign-in" className="text-ember hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
