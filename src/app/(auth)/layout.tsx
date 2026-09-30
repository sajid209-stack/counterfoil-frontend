import { LanguagePicker } from "@/components/LocaleProvider";

// Auth surface shell — centered card on paper. Sign in, sign up, invite accept.
//
// The language is chosen HERE, before anybody has an account: a cashier who
// reads only Bangla meets this screen first, and a language switch that lives
// behind sign-in is a switch they can never reach.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-surface px-gutter py-section">
      <div className="flex justify-end">
        <LanguagePicker showLabel={false} />
      </div>
      <div className="flex flex-1 items-center justify-center py-section">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
