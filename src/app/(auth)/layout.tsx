// Auth surface shell — centered card on paper. Sign in, sign up, invite accept.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-paper px-section py-hero">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
