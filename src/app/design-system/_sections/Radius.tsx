"use client";

import { Button } from "@/components/ui";
import { Callout, Code, DoDont, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

const PRIMITIVES: TokenRow[] = [
  { name: "--radius-xs", utility: "rounded-xs", note: "Small media; a frame inside a frame." },
  { name: "--radius-sm", utility: "rounded-sm", note: "OS controls; a frame inside a card." },
  { name: "--radius-md", utility: "rounded-md", note: "OS containers: card, menu, popover, dialog." },
  { name: "--radius-lg", utility: "rounded-lg", note: "The OS page frame." },
];

const COMPONENT: TokenRow[] = [
  { group: "Component tokens — shared components use these" },
  { name: "--radius-card", utility: "rounded-card", note: "A card." },
  { name: "--radius-control", utility: "rounded-control", note: "A control. A pill in POS." },
  { name: "--radius-inner", utility: "rounded-inner", note: "A frame inside a card." },
  { name: "--radius-sheet", utility: "rounded-sheet", note: "A sheet where it meets the screen edge." },
  { group: "POS primitives" },
  { name: "--radius-go-sm", utility: "rounded-go-sm", note: "POS inner frame: 14." },
  { name: "--radius-go", utility: "rounded-go", note: "POS card: 18." },
  { name: "--radius-go-lg", utility: "rounded-go-lg", note: "POS sheet edge: 28." },
];

/** The four component radii on one small composition, in whichever product the
 *  enclosing preview is. */
function Shapes() {
  return (
    <div className="flex flex-col gap-section">
      <div className="card-surface p-card">
        <p className="text-md font-semibold">Card</p>
        <p className="text-sm text-muted">rounded-card</p>
        <div className="mt-comfortable rounded-inner bg-subtle p-comfortable text-sm">Inner frame · rounded-inner</div>
        <div className="mt-comfortable flex gap-tight">
          <Button variant="secondary" size="sm">
            Control
          </Button>
          <Button size="sm">
            Control
          </Button>
        </div>
      </div>
      <div className="rounded-t-sheet border-x border-t border-line bg-card px-card pb-comfortable pt-card text-sm">
        Sheet edge · rounded-sheet
      </div>
    </div>
  );
}

export function RadiusSection() {
  return (
    <>
      <SectionHeader slug="radius" />

      <DocSection id="primitives" title="The primitive scale">
        <P>Four radii, plus <Code>rounded-full</Code> for pills. OS uses them directly; the component tokens below point at them.</P>
        <TokenTable rows={PRIMITIVES} sample="radius" label="Radius scale" />
      </DocSection>

      <DocSection id="component" title="Component radii">
        <P>
          A card, a control, an inner frame and a sheet edge are different shapes in OS and POS. Shared components ask for <Code>rounded-card</Code>, <Code>rounded-control</Code>, <Code>rounded-inner</Code> or <Code>rounded-sheet</Code> and get the right one without knowing which product they are in. The values read below are for the active product and mode.
        </P>
        <TokenTable rows={COMPONENT} sample="radius" label="Component radius tokens" />
      </DocSection>

      <DocSection id="os-go" title="OS and POS, side by side">
        <P>Card 12 → 18. Control 6 → pill. Inner frame 3 → 14. Sheet edge 12 → 28. POS is softer because it is held in a hand.</P>
        <div className="grid gap-section md:grid-cols-2">
          <Preview product="os">
            <Shapes />
          </Preview>
          <Preview product="go">
            <Shapes />
          </Preview>
        </div>
      </DocSection>

      <DocSection id="nesting" title="Nesting corners">
        <P>
          <strong className="font-semibold">Inner corner = outer corner − the gap between them.</strong> A corner set inside another must be smaller, or the two cross. In practice that is one step down the scale for each level of nesting; flush with no gap, a child may match its parent (a settings row&rsquo;s hover fill follows the card&rsquo;s own corner on purpose).
        </P>
        <Preview label="Container 12 → control or frame 6 → small media 3">
          <div className="rounded-md border border-strong bg-card p-comfortable">
            <p className="mb-tight text-xs text-muted">rounded-md</p>
            <div className="rounded-sm border border-strong bg-subtle p-comfortable">
              <p className="mb-tight text-xs text-muted">rounded-sm</p>
              <div className="rounded-xs border border-strong bg-card p-tight text-xs text-muted">rounded-xs</div>
            </div>
          </div>
        </Preview>
        <DoDont
          dos={["Use a component token (rounded-card, rounded-control) in anything shared between OS and POS.", "Step one size down for each frame you nest inside a card."]}
          donts={["Write an arbitrary radius in brackets: the token check fails on it.", "Set a 12px box inside a 12px card with padding between them — the corners will not follow each other."]}
        />
        <Callout>
          <Code>Button</Code> and every text field use <Code>rounded-control</Code>, so the same markup is 6px in OS and a pill in POS with no per-call prop. (<Code>shape=&quot;pill&quot;</Code> still forces the full round in either product.)
        </Callout>
      </DocSection>
    </>
  );
}
