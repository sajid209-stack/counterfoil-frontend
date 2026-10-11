"use client";

import { Button, StatusPill } from "@/components/ui";
import { Code, DocSection, P, SectionHeader, Small } from "../_components/Doc";
import { ThemeQuad } from "../_components/Preview";
import { QuickReference } from "../_components/QuickReference";
import { SectionGrid } from "../_components/SectionGrid";

/* The five principles are docs/design-system.md §1, verbatim in meaning. */
const PRINCIPLES: Array<{ title: string; body: string }> = [
  { title: "One way to do each thing.", body: "A role — a page title, a primary button, a selected chip — has one recipe. Two recipes for one job is a bug." },
  { title: "Tokens, never values.", body: "Colour, size, spacing, radius, shadow and motion come from tokens. A raw value needs a documented exception." },
  { title: "Shared foundation, distinct products.", body: "OS and POS share colour, type, spacing, motion and every behaviour rule. They differ in shape, elevation and density, through product tokens — never through a second component." },
  { title: "Calm.", body: "Fewer lines and strokes; a surface change separates before a border does. One primary action per screen." },
  { title: "Accessible by construction.", body: "Contrast, focus, target size and reduced motion are properties of the components, so a page cannot get them wrong." },
];

/** A small composed screen fragment, drawn once and reused four times. */
function SampleCard() {
  return (
    <div className="card-surface flex flex-col gap-comfortable p-card">
      <div className="flex items-start justify-between gap-tight">
        <div className="min-w-0">
          <p className="text-md font-semibold">Winter Exhibition Pass</p>
          <p className="text-sm text-muted">Valid for 7 days from the first visit</p>
        </div>
        <StatusPill tone="success">On sale</StatusPill>
      </div>
      <p className="text-3xl font-semibold tracking-figure">৳1,300</p>
      <div className="flex gap-tight">
        <Button variant="secondary" fullWidth>
          Edit
        </Button>
        <Button fullWidth>
          Sell
        </Button>
      </div>
    </div>
  );
}

export function OverviewSection() {
  return (
    <>
      <SectionHeader slug="overview" />

      <DocSection id="what-it-is" title="What this is">
        <P>
          The rules that govern <strong className="font-semibold">Counterfoil OS</strong> (the admin app) and <strong className="font-semibold">Counterfoil POS</strong> (the till, called Counterfoil GO in code), in light and dark. The tokens live in{" "}
          <Code>src/app/globals.css</Code>; the components in <Code>src/components/ui</Code>. Every table and swatch on these pages reads its value from the live stylesheet, so this site cannot disagree with the product.
        </P>
        <Small>It is a standardisation of a product that already works, not a redesign. The objective is to remove variation, not to add design.</Small>
      </DocSection>

      <DocSection id="quick-reference" title="Quick reference">
        <P>Looking for something by its name? Each card goes to where it lives.</P>
        <QuickReference />
      </DocSection>

      <DocSection id="principles" title="Five principles">
        <ol className="flex flex-col gap-comfortable">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title} className="card-surface flex gap-comfortable p-card">
              <span className="w-5 shrink-0 text-md font-semibold tabular-nums text-muted">{i + 1}</span>
              <p className="min-w-0 text-base text-fg">
                <strong className="font-semibold">{p.title}</strong> {p.body}
              </p>
            </li>
          ))}
        </ol>
      </DocSection>

      <DocSection id="how-to-use" title="How to use this site">
        <ol className="flex max-w-prose list-decimal flex-col gap-tight pl-major text-base text-fg marker:text-muted">
          <li>
            Choose a product and a mode in the top bar. They drive the <em>previews</em> only — the page around them keeps your own theme — and they are kept in the address, so a link carries them.
          </li>
          <li>Read a token&rsquo;s name, its computed value and the Tailwind utility that reaches it. Names and values copy with one press.</li>
          <li>Open a component for its live states, its props, what to do and what not to do, and the import line.</li>
          <li>
            Before you merge, run <Code>npm run lint:tokens</Code>. It fails on anything that bypasses the tokens — see <em>Accessibility &amp; standards</em> for the rules and the documented exceptions.
          </li>
        </ol>
      </DocSection>

      <DocSection id="four-themes" title="Four themes at a glance">
        <P>
          Two orthogonal axes — mode and product — make four configurations. The same small screen fragment, drawn in each. Notice what moves (card shape, button shape, elevation) and what does not (colour, type, the one orange action).
        </P>
        <ThemeQuad>
          <SampleCard />
        </ThemeQuad>
      </DocSection>

      <DocSection id="sections" title="All sections">
        <SectionGrid />
      </DocSection>
    </>
  );
}
