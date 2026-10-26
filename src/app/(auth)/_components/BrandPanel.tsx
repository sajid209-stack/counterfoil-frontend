import { getTranslations } from "next-intl/server";
import { ProductStory } from "./ProductStory";
import m from "./brand-motion.module.css";

/* The right half of the split screen. `dark` re-asserts the dark tokens on this
   subtree, so it is ink in both modes and every token inside still resolves.
   The perforated left edge is the counterfoil: the stub you tear along. */
export async function BrandPanel() {
  const t = await getTranslations("auth.shell");
  return (
    <aside className="dark relative hidden overflow-hidden border-l border-dashed border-strong bg-surface text-fg lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-wide xl:p-hero">
      <div className={m.glow} aria-hidden />
      <div className={m.grain} aria-hidden />
      <div className="relative flex min-h-0 flex-1 flex-col gap-section">
        <div>
          <h2 className="max-w-lg text-4xl font-semibold tracking-title [@media(max-height:960px)]:text-3xl">{t("headline")}</h2>
          <p className="mt-section max-w-md text-md text-muted [@media(max-height:960px)]:hidden">{t("lead")}</p>
        </div>
        <ProductStory />
      </div>
    </aside>
  );
}
