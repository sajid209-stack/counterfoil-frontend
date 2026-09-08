import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Tokens · Counterfoil",
};

/* ─────────────────────────────────────────────────────────────────────────
   /tokens — the design-token reference for Phase 2.
   Shows the palette, every type role, the spacing scale, the four radii, and
   the motion durations. Swatches use literal Tailwind utility classes on
   purpose: if a token didn't generate its utility, the swatch renders wrong,
   so this page doubles as a wiring test for the @theme layer.
   Deliberately low-polish — structure over decoration (per the brief).
   ──────────────────────────────────────────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-major">
      <h2 className="type-label mb-major text-[13px] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

type Swatch = {
  name: string;
  hex: string;
  cls: string;
  unconfirmed?: boolean;
};

/* Primitives are drawn from the PALETTE, never from semantic tokens.
   These were `bg-inverse` / `bg-surface` / `bg-ember`, which are all
   theme-adaptive — so in dark mode the chip labelled "ink #141413" rendered
   light, "paper #F5F2EB" rendered dark, and "ember" showed #FF7A3D. A
   reference page that misstates its own palette is worse than no page. */
const PRIMARIES: Swatch[] = [
  { name: "ink", hex: "#141413", cls: "bg-neutral-950" },
  { name: "paper", hex: "#F5F2EB", cls: "bg-neutral-50" },
  { name: "ember", hex: "#F94A00", cls: "bg-brand-500" },
  { name: "bt-violet", hex: "#7C3AED", cls: "bg-bt-violet" },
];

const NEUTRALS: Swatch[] = [
  { name: "neutral-950", hex: "#141413", cls: "bg-neutral-950" },
  { name: "neutral-900", hex: "#22211F", cls: "bg-neutral-900" },
  { name: "neutral-800", hex: "#383632", cls: "bg-neutral-800" },
  { name: "neutral-700", hex: "#514E48", cls: "bg-neutral-700" },
  { name: "neutral-600", hex: "#706C65", cls: "bg-neutral-600" },
  { name: "neutral-500", hex: "#969188", cls: "bg-neutral-500" },
  { name: "neutral-400", hex: "#B8B3A8", cls: "bg-neutral-400" },
  { name: "neutral-300", hex: "#D1CDC3", cls: "bg-neutral-300" },
  { name: "neutral-200", hex: "#E2DED5", cls: "bg-neutral-200" },
  { name: "neutral-100", hex: "#EFECE5", cls: "bg-neutral-100" },
  { name: "neutral-50", hex: "#F5F2EB", cls: "bg-neutral-50" },
];

const BRANDS: Swatch[] = [
  { name: "brand-950", hex: "#2D0D00", cls: "bg-brand-950" },
  { name: "brand-700", hex: "#AA3000", cls: "bg-brand-700" },
  { name: "brand-600", hex: "#D63D00", cls: "bg-brand-600" },
  { name: "brand-500", hex: "#F94A00", cls: "bg-brand-500" },
  { name: "brand-400", hex: "#FF7A3D", cls: "bg-brand-400" },
  { name: "brand-300", hex: "#FFA572", cls: "bg-brand-300" },
  { name: "brand-100", hex: "#FFE6D5", cls: "bg-brand-100" },
  { name: "brand-50", hex: "#FFF5EE", cls: "bg-brand-50" },
];

const AMBERS: Swatch[] = [
  { name: "amber-950", hex: "#451A03", cls: "bg-amber-950" },
  { name: "amber-800", hex: "#92400E", cls: "bg-amber-800" },
  { name: "amber-700", hex: "#B45309", cls: "bg-amber-700" },
  { name: "amber-600", hex: "#D97706", cls: "bg-amber-600" },
  { name: "amber-400", hex: "#FBBF24", cls: "bg-amber-400" },
  { name: "amber-200", hex: "#FDE68A", cls: "bg-amber-200" },
];

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-tight sm:grid-cols-3 lg:grid-cols-6">
      {swatches.map((s) => (
        <div key={s.name} className="overflow-hidden rounded-sm border border-line">
          {/* The swatch is pure colour and carries no text.
              It used to print its hex on itself in `text-fg` / `text-inverse-fg`
              — theme tokens, on a chip whose colour is FIXED. So in dark mode
              the label inverted while the swatch did not, and `#22211F` was
              drawn in near-black on near-black: measured 1.15:1. Both labels now
              sit on the page surface underneath, where they read in either
              theme and the chip shows the colour undisturbed, which is what a
              swatch is for. */}
          <div className={`${s.cls} h-20`} />
          <div className="flex items-baseline justify-between gap-inline bg-surface px-tight py-inline">
            <span className="font-mono text-[12px]">{s.name}</span>
            <span className="font-mono text-[12px] text-muted">{s.hex}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const TYPE_ROLES = [
  { role: "Display", cls: "type-display", size: "text-5xl", spec: "800 · −0.03em" },
  { role: "H1", cls: "type-h1", size: "text-3xl", spec: "700 · −0.02em" },
  { role: "H2", cls: "type-h2", size: "text-2xl", spec: "600 · 0" },
  { role: "Body", cls: "type-body", size: "text-base", spec: "400 · 1.6 line-height" },
  { role: "Label", cls: "type-label", size: "text-sm", spec: "500 · uppercase + tracking" },
];

const SPACING = [
  { name: "inline", value: 4 },
  { name: "tight", value: 8 },
  { name: "comfortable", value: 12 },
  { name: "section", value: 16 },
  { name: "major", value: 24 },
  { name: "hero", value: 48 },
];

const RADII = [
  { name: "xs", cls: "rounded-xs", value: "3px" },
  { name: "sm", cls: "rounded-sm", value: "8px" },
  { name: "md", cls: "rounded-md", value: "12px" },
  { name: "lg", cls: "rounded-lg", value: "24px" },
];

const MOTION = [
  { name: "instant", value: "0ms" },
  { name: "quick", value: "120ms" },
  { name: "standard", value: "200ms" },
  { name: "considered", value: "320ms" },
];

export default function TokensPage() {
  return (
    <main className="mx-auto max-w-5xl px-section py-hero">
      <header className="mb-hero">
        <p className="type-label text-[13px] text-brand-foreground">Design tokens</p>
        <h1 className="type-display mt-tight text-6xl">Counterfoil</h1>
        <p className="type-body mt-section max-w-xl text-muted">
          The token layer both surfaces are built on — the canonical Counterfoil
          Color System: primitive tonal scales, mode-adaptive semantic tokens,
          WCAG-validated contrast.
        </p>
      </header>

      <Section title="Primaries">
        <SwatchGrid swatches={PRIMARIES} />
        <p className="type-body mt-section text-[13px] text-muted">
          The logo is two-colour only: {""}
          <span className="font-mono">#141413</span> on light,{" "}
          <span className="font-mono">#F5F2EB</span> on dark. Never an orange
          logo, never an orange background behind it.
        </p>
      </Section>

      <Section title="Brand / Primary scale — hue 18°, from #F94A00">
        <SwatchGrid swatches={BRANDS} />
      </Section>

      <Section title="Neutral / Warm gray scale — hue 40°">
        <SwatchGrid swatches={NEUTRALS} />
      </Section>

      <Section title="Amber / Warning scale — hue 38°">
        <SwatchGrid swatches={AMBERS} />
      </Section>

      <Section title="Type roles">
        <div className="flex flex-col gap-major">
          {TYPE_ROLES.map((t) => (
            <div
              key={t.role}
              className="flex flex-col gap-inline border-b border-line pb-major sm:flex-row sm:items-baseline sm:justify-between"
            >
              <span className={`${t.cls} ${t.size}`}>
                {t.role === "Label" ? "Timed entry" : "The experience economy"}
              </span>
              <span className="font-mono text-[12px] text-muted whitespace-nowrap">
                {t.role} · {t.spec}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Mono — the visual signature">
        <div className="flex flex-wrap gap-tight">
          {["CF-2026-008479", "CONFIRMED", "BT-02", "2026-07-29", "৳10.50"].map(
            (code) => (
              <span
                key={code}
                /* `bg-neutral-900` is a FIXED colour; `text-inverse-fg` is a theme
                    token. In dark the ink inverted to near-black while the chip
                    stayed near-black behind it — measured 1.15:1. The chip is a
                    sample of the palette, so its ink is pinned to the palette
                    too rather than following the theme. */
                className="rounded-sm bg-neutral-900 px-comfortable py-tight font-mono text-sm text-neutral-50"
              >
                {code}
              </span>
            ),
          )}
        </div>
      </Section>

      <Section title="Spacing — base 8">
        <div className="flex flex-col gap-tight">
          {SPACING.map((s) => (
            <div key={s.name} className="flex items-center gap-section">
              <span className="w-28 font-mono text-[12px] text-muted">
                {s.name}
              </span>
              <span
                className="h-4 bg-ember"
                style={{ width: `${s.value}px` }}
              />
              <span className="font-mono text-[12px] text-muted">
                {s.value}px
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii — only these four exist">
        <div className="flex flex-wrap gap-major">
          {RADII.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-tight">
              <div className={`${r.cls} h-20 w-20 border-2 border-inverse bg-line`} />
              <span className="font-mono text-[12px] text-muted">
                {r.name} · {r.value}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion">
        <div className="flex flex-col gap-tight">
          {MOTION.map((m) => (
            <div key={m.name} className="flex items-center gap-section">
              <span className="w-28 font-mono text-[12px] text-muted">
                {m.name}
              </span>
              <span className="font-mono text-[12px] text-muted">
                {m.value}
              </span>
            </div>
          ))}
          <p className="type-body mt-tight text-[13px] text-muted">
            Easing: <span className="font-mono">cubic-bezier(0.32, 0.72, 0, 1)</span>{" "}
            — both surfaces animate at 120ms.
          </p>
        </div>
      </Section>
    </main>
  );
}
