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
  /** dark chip needs light text */
  dark?: boolean;
  unconfirmed?: boolean;
};

const PRIMARIES: Swatch[] = [
  { name: "ink", hex: "#0A0A0A", cls: "bg-inverse", dark: true },
  { name: "paper", hex: "#F8F7F4", cls: "bg-surface" },
  { name: "ember", hex: "#FF6A1F", cls: "bg-ember", dark: true },
  { name: "bt-violet", hex: "#7C3AED", cls: "bg-bt-violet", dark: true },
];

const NEUTRALS: Swatch[] = [
  { name: "neutral-900", hex: "#0A0A0A", cls: "bg-neutral-900", dark: true },
  { name: "neutral-800", hex: "#1C1C1C", cls: "bg-neutral-800", dark: true },
  { name: "neutral-600", hex: "#4A4A48", cls: "bg-neutral-600", dark: true },
  { name: "neutral-400", hex: "#8A8985", cls: "bg-neutral-400", dark: true },
  { name: "neutral-200", hex: "#D6D4CE", cls: "bg-line" },
  { name: "neutral-50", hex: "#F8F7F4", cls: "bg-subtle" },
];

const AMBERS: Swatch[] = [
  { name: "amber-950", hex: "#451A05", cls: "bg-amber-950", dark: true },
  { name: "amber-800", hex: "#9A3412", cls: "bg-amber-800", dark: true },
  { name: "amber-700", hex: "#C2410C", cls: "bg-amber-700", dark: true },
  { name: "amber-600", hex: "#FF6A1F", cls: "bg-amber-600", dark: true },
  { name: "amber-400", hex: "#FB923C", cls: "bg-amber-400", dark: true },
  { name: "amber-200", hex: "#FED7AA", cls: "bg-amber-200" },
];

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-tight sm:grid-cols-3 lg:grid-cols-6">
      {swatches.map((s) => (
        <div key={s.name} className="overflow-hidden rounded-sm border border-line">
          <div
            className={`${s.cls} flex h-20 items-end p-tight ${
              s.dark ? "text-inverse-fg" : "text-fg"
            }`}
          >
            <span className="font-mono text-[11px] opacity-80">{s.hex}</span>
          </div>
          <div className="bg-surface px-tight py-inline">
            <span className="font-mono text-[12px]">{s.name}</span>
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
        <p className="type-label text-[13px] text-ember">Design tokens</p>
        <h1 className="type-display mt-tight text-6xl">Counterfoil</h1>
        <p className="type-body mt-section max-w-xl text-muted">
          The token layer both surfaces are built on. Primaries are exact from
          the brand guidelines; the neutral and amber scales are a derivation
          and marked unconfirmed until reconciled with Figma.
        </p>
      </header>

      <Section title="Primaries — exact">
        <SwatchGrid swatches={PRIMARIES} />
        <p className="type-body mt-section text-[13px] text-faint">
          The logo is two-colour only: {""}
          <span className="font-mono">#0A0A0A</span> on light,{" "}
          <span className="font-mono">#F8F7F4</span> on dark. Never an orange
          logo, never an orange background behind it.
        </p>
      </Section>

      <Section title="Neutral scale — derived / unconfirmed">
        <SwatchGrid swatches={NEUTRALS} />
      </Section>

      <Section title="Amber scale — derived / unconfirmed">
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
              <span className="font-mono text-[12px] text-faint whitespace-nowrap">
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
                className="rounded-sm bg-neutral-900 px-comfortable py-tight font-mono text-sm text-inverse-fg"
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
              <span className="font-mono text-[12px] text-faint">
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
              <span className="font-mono text-[12px] text-faint">
                {m.value}
              </span>
            </div>
          ))}
          <p className="type-body mt-tight text-[13px] text-faint">
            Easing: <span className="font-mono">cubic-bezier(0.32, 0.72, 0, 1)</span>{" "}
            — both surfaces animate at 120ms.
          </p>
        </div>
      </Section>
    </main>
  );
}
