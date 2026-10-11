"use client";

import { Button } from "@/components/ui";
import { Callout, Code, CodeBlock, DocSection, P, SectionHeader, Small } from "../_components/Doc";
import { ContrastTable } from "../_components/ContrastTable";
import { Preview } from "../_components/Preview";

const EXCEPTIONS = [
  ["src/app/deck/**", "A fixed 1600 × 900 slide canvas in real pixels."],
  ["Event page templates (src/lib/events, src/components/events)", "Each template's own type and palette, scoped to --e-*."],
  ["The storefront's venue accent (--sf-*)", "Computed per venue for contrast."],
  ["Chart palettes (--chart-*, --heat-*)", "And operator-chosen category colours."],
  ["Fluid money figures on the till", "clamp() so a figure fits its row."],
  ["The seat plan's 9px seat labels", "Each seat carries its full name."],
  ["Print pages", "Physical measurements: paper, thermal rolls, tickets."],
];

const RULES = [
  "arbitrary bracket values for font size, radius, shadow, duration, z-index and spacing",
  "hex / rgb colour literals in components",
  "the faint text colour on content (it is 2.09:1; disabled and placeholder only)",
  "font-mono on money",
  "a .dark token missing from the .light re-assertion",
];

function Targets() {
  return (
    <div className="flex flex-wrap items-center gap-section">
      <Button>Tab to me</Button>
      <Button variant="secondary">
        Focus shows a 2px ring
      </Button>
      <Button variant="tertiary" size="sm">
        Small: 44 on touch, 36 on desktop
      </Button>
    </div>
  );
}

export function AccessibilitySection() {
  return (
    <>
      <SectionHeader slug="accessibility" />

      <DocSection id="standard" title="WCAG 2.2 AA, by construction">
        <P>
          Contrast, focus, target size and reduced motion are properties of the components, so a page cannot get them wrong. The target is WCAG 2.2 level AA in both modes and both products.
        </P>
        <ul className="flex max-w-prose list-disc flex-col gap-tight pl-major text-base text-fg marker:text-muted">
          <li><strong className="font-semibold">Text</strong> 4.5:1; <strong className="font-semibold">large text</strong> (24px, or 18.66px bold) and <strong className="font-semibold">UI marks and focus</strong> 3:1.</li>
          <li><strong className="font-semibold">Targets</strong>: at least 24px by rule; 44px for anything important or touched. Phone controls are 44px; desktop controls step down to 36.</li>
          <li><strong className="font-semibold">Focus</strong>: one visible ring, 2px of <Code>ring</Code> with a 2px offset, on every focusable element in both products. A control that fills a rounded shape moves it onto the shape.</li>
          <li><strong className="font-semibold">Keyboard</strong>: everything works without a pointer. Dialogs trap focus, Escape closes, and focus returns to the opener. Table rows and calendar blocks are tab stops. Nothing is draggable only.</li>
          <li><strong className="font-semibold">Reduced motion</strong> (the OS setting, or Settings → Display) collapses every duration. Nothing is withheld.</li>
          <li><strong className="font-semibold">Meaning is never colour alone</strong>: a status has its word, a selection its check, a verdict its shape.</li>
          <li><strong className="font-semibold">Language</strong>: plain, short and translated. Labels of one to four words; help of one sentence; see the glossary in <Code>docs/plain-language.md</Code>.</li>
        </ul>
      </DocSection>

      <DocSection id="contrast" title="Contrast you can check">
        <P>The pairs that carry the most text, measured from the live tokens. Flip the mode in the top bar: every row must hold in both.</P>
        <ContrastTable
          rows={[
            { fg: "--color-fg", bg: "--color-card", label: "Body text", need: 4.5 },
            { fg: "--color-muted", bg: "--color-card", label: "Supporting text", need: 4.5 },
            { fg: "--color-brand-foreground", bg: "--color-card", label: "Links and brand text", need: 4.5 },
            { fg: "--color-on-solid", bg: "--color-ember-solid", label: "The primary button", need: 4.5 },
            { fg: "--color-on-solid", bg: "--color-danger-solid", label: "The destructive button", need: 4.5 },
            { fg: "--color-ring", bg: "--color-card", label: "The focus ring", need: 3 },
          ]}
        />
      </DocSection>

      <DocSection id="targets" title="Targets and focus">
        <Preview label="Press Tab">
          <Targets />
        </Preview>
        <Small>The ring is drawn by a single global rule, so components never draw their own.</Small>
      </DocSection>

      <DocSection id="enforcement" title="Keeping it true">
        <P>One command fails on anything that bypasses the tokens:</P>
        <CodeBlock label="command" code="npm run lint:tokens" />
        <P>Outside the exceptions below, it fails on:</P>
        <ul className="flex max-w-prose list-disc flex-col gap-tight pl-major text-base text-fg marker:text-muted">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <Callout>A single line is exempted with a comment carrying a reason: <Code>{"// ds-exception: <reason>"}</Code>. A marker without a reason exempts nothing and is itself an error. Whole-file exceptions are reviewable in <Code>scripts/design-tokens.allow.json</Code>.</Callout>
      </DocSection>

      <DocSection id="house-exceptions" title="House exceptions to the floors">
        <P>
          The primary button is <strong className="font-semibold">not</strong> an exception: white on <Code>ember-solid</Code> (brand-600) is 4.64:1, above the 4.5:1 text floor, in both modes. The accent <Code>ember</Code> is 3.50:1 under white, which is exactly why it is never a fill behind text.
        </P>
        <P>What is left is short, and each has a reason:</P>
        <ul className="flex max-w-prose list-disc flex-col gap-tight pl-major text-base text-fg marker:text-muted">
          <li><strong className="font-semibold">The 11px POS tab labels</strong> (<Code>text-2xs</Code>): five labelled tabs do not fit across a 390px phone at 14px, and every tab also carries an icon.</li>
          <li><strong className="font-semibold">The 9px seat labels</strong> on a seat plan: each seat carries its full name as an accessible name and a title.</li>
          <li><strong className="font-semibold">The scopes below</strong> — the deck, event templates, the storefront accent, print pages, charts and fluid till figures — which use raw values for their own reasons.</li>
        </ul>
      </DocSection>

      <DocSection id="exceptions" title="Documented exceptions">
        <P>These may use raw values; nothing else may.</P>
        <div className="card-surface overflow-hidden">
          <ul>
            {EXCEPTIONS.map(([where, why]) => (
              <li key={where} className="flex flex-col gap-inline border-b border-hairline px-card py-comfortable last:border-0 sm:flex-row sm:gap-section">
                <span className="font-mono text-sm text-fg sm:w-1/2">{where}</span>
                <span className="text-sm text-muted sm:w-1/2">{why}</span>
              </li>
            ))}
          </ul>
        </div>
      </DocSection>
    </>
  );
}
