"use client";

import { Button } from "@/components/ui";
import { Callout, Code, DoDont, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

const LINES: TokenRow[] = [
  { name: "--color-line", utility: "border-line", note: "A component's edge; an input." },
  { name: "--color-strong", utility: "border-strong", note: "On hover, or an emphasised edge." },
  { name: "--color-hairline", utility: "border-hairline", note: "A divider between rows." },
];

function Strokes() {
  return (
    <div className="grid gap-section md:grid-cols-2">
      <div className="card-surface p-card">
        <p className="text-md font-semibold">Rows are divided by hairlines</p>
        <ul className="mt-tight">
          {["Adult", "Child", "Senior"].map((n) => (
            <li key={n} className="flex items-center justify-between border-b border-hairline py-comfortable text-base last:border-0">
              <span>{n}</span>
              <span className="text-muted">1</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card-surface flex flex-col gap-comfortable p-card">
        <p className="text-md font-semibold">Edges and selection</p>
        <input aria-label="Example field" placeholder="An input has a line edge" className="h-11 rounded-sm border border-line bg-card px-comfortable text-base placeholder:text-faint" />
        <div className="rounded-inner border border-strong p-comfortable text-sm">A strong edge, for emphasis or hover</div>
        <div className="rounded-inner p-comfortable text-sm ring-2 ring-ember-solid">A selected choice: 2px ember-solid ring</div>
        <Button variant="secondary">
          Tab here for the focus ring
        </Button>
      </div>
    </div>
  );
}

export function BordersSection() {
  return (
    <>
      <SectionHeader slug="borders" />

      <DocSection id="rule" title="1px everywhere">
        <P>
          A stroke is 1px. <Code>line</Code> draws a component&rsquo;s edge and an input; <Code>hairline</Code> divides rows; <Code>strong</Code> appears on hover or for an emphasised edge. In dark, lighter means <em>less</em> contrast, not a lighter colour: on ink a stroke softens by moving toward the card it sits on.
        </P>
        <TokenTable rows={LINES} sample="colour" label="Line tokens" />
      </DocSection>

      <DocSection id="two-pixel" title="Where 2px is allowed">
        <P>
          Only a <strong className="font-semibold">selected</strong> choice (<Code>ring-2 ring-ember-solid</Code>, drawn inset where a card would clip it) and the <strong className="font-semibold">focus ring</strong>: 2px of <Code>ring</Code>, 2px outside the control, one rule for both products.
        </P>
        <Preview label="Strokes in use">
          <Strokes />
        </Preview>
      </DocSection>

      <DocSection id="calm" title="Calm over lined">
        <P>A surface change separates before a border does. A card on the page needs no outline, and nothing needs a box inside a box.</P>
        <DoDont
          dos={["Let the card colour against the page do the separating.", "Use a hairline between rows and nothing around the list.", "Use a quiet fill (subtle) for a group inside a card."]}
          donts={["Draw a border around a card that already sits on a different surface.", "Put a bordered box inside a bordered card.", "Use a 2px stroke for emphasis — that is what selection and focus mean."]}
        />
        <Callout>In dark a card draws a real 1px line instead of a shadow, because a shadow on near-black reads as nothing. Elevation covers that.</Callout>
      </DocSection>
    </>
  );
}
