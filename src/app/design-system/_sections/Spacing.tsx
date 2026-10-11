"use client";

import { useSyncExternalStore } from "react";
import { Callout, Code, DocSection, P, SectionHeader, Small } from "../_components/Doc";
import { Preview } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

const STEPS: TokenRow[] = [
  { group: "The rhythm" },
  { name: "--spacing-inline", utility: "p-inline gap-inline", note: "Icon to label in a tight control." },
  { name: "--spacing-tight", utility: "p-tight gap-tight", note: "Icon to label; a label and its field." },
  { name: "--spacing-comfortable", utility: "p-comfortable gap-comfortable", note: "Inside a nested frame; between list items." },
  { name: "--spacing-section", utility: "p-section gap-section", note: "Between cards; between form groups." },
  { name: "--spacing-major", utility: "p-major gap-major", note: "Between a titled group and the next." },
  { name: "--spacing-wide", utility: "p-wide gap-wide", note: "Between page regions." },
  { name: "--spacing-hero", utility: "p-hero gap-hero", note: "Empty states and first-run." },
  { group: "Card and page rhythm (16px on a phone)" },
  { name: "--spacing-card", utility: "p-card px-card", note: "Inside every card; rows in an edge-to-edge card." },
  { name: "--spacing-gutter", utility: "px-gutter", note: "The page edge." },
];

const BREAKPOINTS: Array<{ name: string; query: string; rem: string; px: number; what: string }> = [
  { name: "base", query: "(default)", rem: "0", px: 0, what: "Phone. Targets are 44px, card padding and gutter are 16px, tables become lists." },
  { name: "sm", query: "40rem", rem: "40rem", px: 640, what: "Card padding and the page gutter step up to 20px." },
  { name: "md", query: "48rem", rem: "48rem", px: 768, what: "Desktop density: 36px controls, tables instead of lists, popovers instead of sheets." },
  { name: "lg", query: "64rem", rem: "64rem", px: 1024, what: "The docs section nav appears; the POS tab bar becomes a rail in landscape." },
  { name: "xl", query: "80rem", rem: "80rem", px: 1280, what: "The docs gain an “On this page” list; the calendar's seven days get room for a second line." },
  { name: "2xl", query: "96rem", rem: "96rem", px: 1536, what: "Wide tables show every column." },
];

const subscribe = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

function Viewport() {
  const w = useSyncExternalStore(subscribe, () => window.innerWidth, () => 0);
  const active = [...BREAKPOINTS].reverse().find((b) => w >= b.px)?.name ?? "base";
  return (
    <p className="text-sm text-muted" aria-live="polite">
      Your viewport is <strong className="font-semibold tabular-nums text-fg">{w || "—"}px</strong> wide: the <strong className="font-semibold text-fg">{active}</strong> breakpoint is active.
    </p>
  );
}

function RhythmDiagram() {
  return (
    <div className="bg-subtle px-gutter py-gutter">
      <div className="flex flex-col gap-section">
        {["Card one", "Card two"].map((t) => (
          <div key={t} className="card-surface p-card">
            <div className="rounded-xs bg-ember-wash px-comfortable py-tight text-sm font-medium text-fg">
              {t} <span className="text-muted">· content</span>
            </div>
            <p className="mt-tight text-xs text-muted">
              <Code>p-card</Code> inside; <Code>gap-section</Code> between cards; <Code>px-gutter</Code> to the page edge.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpacingSection() {
  return (
    <>
      <SectionHeader slug="spacing" />

      <DocSection id="grid" title="A 4px grid">
        <P>
          Named tokens carry the rhythm; Tailwind&rsquo;s numeric steps (<Code>1</Code> = 4px, <Code>2</Code> = 8px…) cover anything else <em>on the grid</em>. Arbitrary <Code>[Npx]</Code> spacing is not allowed — the token check fails on it.
        </P>
        <TokenTable rows={STEPS} sample="space" label="Spacing tokens" />
      </DocSection>

      <DocSection id="rhythm" title="Card and gutter rhythm">
        <P>
          One padding inside every card, one gap between cards, one page edge. Two tokens do the work — <Code>card</Code> and <Code>gutter</Code>, both 20px, both 16px under <Code>sm</Code> — so changing the rhythm later is two numbers in <Code>globals.css</Code>, not seventy class strings.
        </P>
        <Preview flush label="p-card · gap-section · px-gutter">
          <RhythmDiagram />
        </Preview>
        <Callout title="Inside is more than between">
          A card has a fill and an edge doing the grouping, so the gap between cards (16) can be smaller than the padding inside one (20). Inside a card, where nothing draws the group, the usual rule holds: a nested frame is padded <Code>comfortable</Code> (12), less than its parent. A group with its own heading sits <Code>major</Code> (24) from the next, with its heading <Code>tight</Code> (8) above its card.
        </Callout>
      </DocSection>

      <DocSection id="breakpoints" title="Breakpoints">
        <P>Mobile first. The same four widths decide the form factor everywhere, so a component and the CSS around it agree on where the line is.</P>
        <Viewport />
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Breakpoints</caption>
              <thead className="max-md:sr-only">
                <tr className="border-b border-hairline text-muted">
                  <th scope="col" className="px-card py-tight font-medium">Name</th>
                  <th scope="col" className="px-card py-tight font-medium">From</th>
                  <th scope="col" className="px-card py-tight font-medium">What changes</th>
                </tr>
              </thead>
              <tbody>
                {BREAKPOINTS.map((b) => (
                  <tr key={b.name} className="border-b border-hairline last:border-0 max-md:flex max-md:flex-col max-md:gap-inline max-md:px-card max-md:py-comfortable">
                    <td className="px-card py-comfortable align-top max-md:p-0">
                      <code className="font-mono text-sm font-medium text-fg">{b.name}</code>
                    </td>
                    <td className="px-card py-comfortable align-top tabular-nums text-muted max-md:p-0">{b.px ? `${b.rem} · ${b.px}px` : "0"}</td>
                    <td className="px-card py-comfortable align-top text-fg max-md:p-0">{b.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Small>
          The till adds one custom variant, <Code>rail</Code>: from 64rem <em>and</em> in landscape, where the bottom tab bar gives way to a left rail.
        </Small>
      </DocSection>

      <DocSection id="widths" title="Widths content stops at">
        <P>Lines of text stay readable and panels stay panels. These are the limits already in use.</P>
        <ul className="flex max-w-prose list-disc flex-col gap-tight pl-major text-base text-fg marker:text-muted">
          <li>
            Running text: <Code>max-w-prose</Code> (65 characters).
          </li>
          <li>
            A settings page: a centred column of about 880px.
          </li>
          <li>
            These docs: a 960px content column.
          </li>
          <li>
            A side drawer (<Code>Sheet side</Code>): 30rem from <Code>md</Code>; the filter popover: 22rem.
          </li>
          <li>
            The POS action bar and dock: 32rem, centred, however wide the screen.
          </li>
        </ul>
      </DocSection>
    </>
  );
}
