import Image from "next/image";
import { ScanLine, Store, LayoutDashboard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import dashboard from "./dashboard-dark.jpg";

/* The right half of the split screen. `dark` re-asserts the dark tokens on this
   subtree, so it is ink in both modes and every token inside still resolves. */
export async function BrandPanel() {
  const t = await getTranslations("auth.shell");
  return (
    <aside className="dark relative hidden overflow-hidden border-l border-line bg-card text-fg lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-major lg:pl-hero lg:pt-hero">
      <div className="pr-hero">
        <h2 className="max-w-md text-4xl font-semibold tracking-title">{t("headline")}</h2>
        <p className="mt-section max-w-md text-md text-muted">{t("lead")}</p>
        <ul className="mt-major flex flex-col gap-section">
          <Proof icon={<Store size={18} aria-hidden />} title={t("p1.title")} body={t("p1.body")} />
          <Proof icon={<ScanLine size={18} aria-hidden />} title={t("p2.title")} body={t("p2.body")} />
          <Proof icon={<LayoutDashboard size={18} aria-hidden />} title={t("p3.title")} body={t("p3.body")} />
        </ul>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-tl-lg border-l border-t border-strong bg-surface shadow-lg">
        <Image
          src={dashboard}
          alt={t("picture")}
          sizes="(min-width: 1024px) 50vw, 0px"
          className="h-auto w-[165%] max-w-none select-none"
        />
      </div>
    </aside>
  );
}

function Proof({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-comfortable">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ember-wash text-brand-foreground">{icon}</span>
      <span>
        <span className="block text-base font-medium">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
    </li>
  );
}
