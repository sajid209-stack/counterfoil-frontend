"use client";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { ArrowRight, Download, Plus, Trash2 } from "lucide-react";
import { Callout, Code, ComponentDoc, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview, ThemeQuad } from "../_components/Preview";

const VARIANTS: Array<{ v: ButtonVariant; use: string }> = [
  { v: "primary", use: "One per screen. The ember-solid fill with white text." },
  { v: "secondary", use: "White with a line edge. The default companion." },
  { v: "tertiary", use: "No fill. Quiet actions in a toolbar or a row." },
  { v: "destructive", use: "danger-solid. Archive, delete, refund — and confirm first." },
  { v: "link", use: "Brand text, underlined. Inside a sentence or beside a field." },
];
const SIZES: Array<{ s: ButtonSize; px: string }> = [
  { s: "sm", px: "36 (44 on touch)" },
  { s: "md", px: "44" },
  { s: "lg", px: "48" },
];

function VariantMatrix() {
  return (
    <div className="flex flex-col gap-comfortable">
      {VARIANTS.map(({ v, use }) => (
        <div key={v} className="flex flex-col gap-tight border-b border-hairline pb-comfortable last:border-0 last:pb-0">
          <p className="text-sm text-muted">
            <span className="font-mono text-fg">{v}</span> · {use}
          </p>
          <div className="flex flex-wrap items-center gap-tight">
            {SIZES.map(({ s }) => (
              <Button key={s} variant={v} size={s}>
                {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StateMatrix() {
  return (
    <div className="flex flex-col gap-comfortable">
      {VARIANTS.filter((x) => x.v !== "link").map(({ v }) => (
        <div key={v} className="grid grid-cols-1 items-center gap-tight sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))]">
          <p className="font-mono text-sm text-muted">{v}</p>
          <div>
            <Button variant={v}>
              Default
            </Button>
          </div>
          <div>
            <Button variant={v} disabled>
              Disabled
            </Button>
          </div>
          <div>
            <Button variant={v} loading>
              Saving
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function WithIcons() {
  return (
    <div className="flex flex-wrap items-center gap-tight">
      <Button icon={<Plus size={16} strokeWidth={1.5} aria-hidden />}>
        New booking
      </Button>
      <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} aria-hidden />}>
        Export
      </Button>
      <Button variant="destructive" icon={<Trash2 size={16} strokeWidth={1.5} aria-hidden />}>
        Delete
      </Button>
      <Button variant="tertiary" size="icon" aria-label="Next">
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
      </Button>
      <Button fullWidth className="mt-tight">
        Full width
      </Button>
    </div>
  );
}

function Quad() {
  return (
    <div className="flex flex-col gap-tight">
      <div className="flex flex-wrap gap-tight">
        <Button>Primary</Button>
        <Button variant="secondary">
          Secondary
        </Button>
        <Button variant="tertiary">
          Tertiary
        </Button>
      </div>
      <div className="flex flex-wrap gap-tight">
        <Button variant="destructive">
          Destructive
        </Button>
        <Button disabled>
          Disabled
        </Button>
        <Button loading>
          Loading
        </Button>
      </div>
    </div>
  );
}

export function ButtonsSection() {
  return (
    <>
      <SectionHeader slug="buttons" />

      <DocSection id="variants" title="Variants and sizes">
        <P>
          One primary action per screen. The variant says how loud a button is; the size is the target. <Code>sm</Code> is 44px on touch and 36px from <Code>md</Code>; <Code>md</Code> is 44px; <Code>lg</Code> is 48px, the till&rsquo;s touch floor. Every variant draws its own hover, focus-visible, pressed, disabled and loading states — a page picks a variant, it never restyles one with <Code>className</Code>.
        </P>
        <Preview label="Variants × sizes">
          <VariantMatrix />
        </Preview>
      </DocSection>

      <DocSection id="states" title="States">
        <P>
          Loading keeps the button&rsquo;s width and shows a spinner (and sets <Code>aria-busy</Code>); a loading button is also disabled. A disabled button should say why, nearby — it is not an explanation on its own.
        </P>
        <Preview label="Default · disabled · loading">
          <StateMatrix />
        </Preview>
      </DocSection>

      <DocSection id="icons" title="Icons, and icon-only buttons">
        <P>
          Pass a lucide element as <Code>icon</Code> for a leading icon, 16px at a 1.5 stroke, marked <Code>aria-hidden</Code>. An icon-only button is <Code>size=&quot;icon&quot;</Code> — square, 44px on touch and 36px from <Code>md</Code> — and always carries an <Code>aria-label</Code>.
        </P>
        <Preview label="With an icon; icon-only; full width">
          <WithIcons />
        </Preview>
        <Callout title="One shape, two products">
          A button&rsquo;s corner is the <Code>rounded-control</Code> token: 6px in OS and a pill in POS, set by <Code>data-product</Code>. The same <Code>&lt;Button&gt;</Code> is therefore right in both products with no prop — switch the preview to GO to see it.
        </Callout>
      </DocSection>

      <DocSection id="themes" title="In all four themes">
        <ThemeQuad>
          <Quad />
        </ThemeQuad>
      </DocSection>

      <ComponentDoc
        id="button"
        title="Button"
        summary="The one button. It forwards every native button attribute."
        importCode={'import { Button } from "@/components/ui";'}
        props={[
          { prop: "variant", type: '"primary" | "secondary" | "tertiary" | "destructive" | "link"', default: '"primary"', description: "How loud it is." },
          { prop: "size", type: '"sm" | "md" | "lg" | "icon"', default: '"md"', description: "The target: 36/44, 44 or 48px; icon is square and needs aria-label. Ignored by link." },
          { prop: "selected", type: "boolean", description: "A toggle button: sets aria-pressed and a subtle fill." },
          { prop: "shape", type: '"default" | "pill"', default: '"default"', description: "Rarely needed: the corner follows the product token. pill forces a full round." },
          { prop: "icon", type: "ReactNode", description: "A lucide element drawn before the label." },
          { prop: "loading", type: "boolean", default: "false", description: "Spinner, width kept, aria-busy, and disabled." },
          { prop: "fullWidth", type: "boolean", default: "false", description: "Fills its container." },
          { prop: "disabled", type: "boolean", default: "false", description: "Not available. Say why nearby." },
          { prop: "type", type: "string", default: '"button"', description: "Never submits a form unless you ask." },
        ]}
        dos={["Give a screen one primary button.", "Use a verb: “Put on sale”, “Take payment”.", "Confirm a destructive action before it runs.", "Name an icon-only button with aria-label."]}
        donts={["Put two primary buttons side by side.", "Restyle a button with className to get a new look — pick a variant.", "Disable a button without saying why nearby.", "Use a link-variant button as a navigation item; use a link."]}
      />
    </>
  );
}
