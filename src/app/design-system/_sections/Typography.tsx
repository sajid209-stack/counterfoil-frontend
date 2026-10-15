"use client";

import { Callout, Code, CodeBlock, DoDont, DocSection, P, SectionHeader, Small, Sub } from "../_components/Doc";
import { Preview } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

const SCALE: TokenRow[] = [
  { name: "--text-2xs", utility: "text-2xs", note: "The classic till's tab-bar labels only." },
  { name: "--text-xs", utility: "text-xs", note: "Captions, metadata, badges, axis labels, field help." },
  { name: "--text-sm", utility: "text-sm", note: "Supporting text, table headers, dense cells. The POS reading floor." },
  { name: "--text-base", utility: "text-base", note: "The default: body, table cells, buttons, inputs." },
  { name: "--text-md", utility: "text-md", note: "Emphasised body, card titles, POS tile names, phone inputs." },
  { name: "--text-lg", utility: "text-lg", note: "Section headings." },
  { name: "--text-xl", utility: "text-xl", note: "Major sections, dialog titles." },
  { name: "--text-2xl", utility: "text-2xl", note: "Phone page titles, band figures." },
  { name: "--text-3xl", utility: "text-3xl", note: "Page titles, headline metrics." },
  { name: "--text-4xl", utility: "text-4xl", note: "Hero metrics." },
  { name: "--text-display", utility: "text-display", note: "POS amount due and change." },
];

/* Every recipe is written out as its literal classes so the sample IS the
   recipe, and so Tailwind sees each class. */
const ROLES: Array<{ role: string; classes: string; sample: string }> = [
  { role: "Page title", classes: "text-2xl sm:text-3xl font-semibold tracking-title", sample: "Orders" },
  { role: "Section title", classes: "text-lg font-semibold tracking-title", sample: "Payment methods" },
  { role: "Card title", classes: "text-md font-semibold", sample: "Winter Exhibition Pass" },
  { role: "Body", classes: "text-base", sample: "Tickets can be bought until the slot starts." },
  { role: "Supporting", classes: "text-sm text-muted", sample: "Valid for 7 days from the first visit" },
  { role: "Label (field, figure)", classes: "text-xs font-medium text-muted", sample: "Reference" },
  { role: "Table header", classes: "text-sm font-medium text-muted", sample: "Customer" },
  { role: "Table cell", classes: "text-base", sample: "Ayesha Siddika" },
  { role: "Headline metric", classes: "text-3xl font-semibold tracking-figure", sample: "৳41,653" },
  { role: "Band figure", classes: "text-2xl font-semibold tracking-figure", sample: "৳12,400" },
  { role: "Button", classes: "text-base font-medium", sample: "Put on sale" },
  { role: "Badge", classes: "text-xs font-medium", sample: "Part paid" },
  { role: "Identifier", classes: "font-mono text-sm", sample: "CF-2026-001053" },
  { role: "POS tile name", classes: "text-md font-semibold", sample: "General Admission" },
  { role: "POS price", classes: "text-xl font-semibold", sample: "৳500" },
  { role: "POS amount due", classes: "text-display font-bold tracking-figure", sample: "৳1,725" },
];

function RolesTable() {
  return (
    <Preview flush label="Type roles">
      <table className="w-full text-left text-sm">
        <thead className="max-md:sr-only">
          <tr className="border-b border-hairline text-muted">
            <th scope="col" className="w-48 px-section py-tight font-medium">
              Role
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Live sample
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Classes
            </th>
          </tr>
        </thead>
        <tbody>
          {ROLES.map((r) => (
            <tr key={r.role} className="border-b border-hairline last:border-0 max-md:flex max-md:flex-col max-md:gap-inline max-md:px-section max-md:py-comfortable">
              <th scope="row" className="px-section py-comfortable text-left align-baseline text-sm font-medium text-fg max-md:p-0">
                {r.role}
              </th>
              <td className="px-section py-comfortable align-baseline max-md:p-0">
                <span className={r.classes}>{r.sample}</span>
              </td>
              <td className="px-section py-comfortable align-baseline max-md:p-0">
                <code className="break-words font-mono text-xs text-muted">{r.classes}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Preview>
  );
}

export function TypographySection() {
  return (
    <>
      <SectionHeader slug="typography" />

      <DocSection id="fonts" title="Fonts">
        <P>
          Three faces, one rule each. <strong className="font-semibold">Inter</strong> (variable) is for every interface role. <strong className="font-semibold">DM Mono</strong> is for identifiers only. <strong className="font-semibold">Hind Siliguri</strong> sits behind both so Bangla never falls to a system face. Figures are tabular everywhere (set on <Code>body</Code>), and body tracking is −0.01em.
        </P>

        <Sub title="Inter — the interface">
          <Preview label="Inter at the four weights in use">
            <div className="grid gap-section sm:grid-cols-2">
              {[
                ["400", "font-normal", "Body text, table cells, help"],
                ["500", "font-medium", "Labels, buttons, navigation"],
                ["600", "font-semibold", "Titles and figures"],
                ["700", "font-bold", "POS display figures only"],
              ].map(([w, cls, use]) => (
                <div key={w} className="card-surface flex flex-col gap-inline p-card">
                  <p className="text-sm text-muted">
                    {w} · {use}
                  </p>
                  <p className={`text-2xl tracking-figure ${cls}`}>৳12,500.00</p>
                  <p className={`text-base ${cls}`}>Winter Exhibition Pass · 3 tickets · 7:00 PM</p>
                </div>
              ))}
            </div>
          </Preview>
          <Small>Never 800: Bangla has no 800, so it would fall back unpredictably. Inter&rsquo;s default figures are proportional, so tabular figures are switched on globally — a column of money does not re-flow as its digits change.</Small>
        </Sub>

        <Sub title="DM Mono — identifiers only">
          <Preview label="DM Mono, weights 400 and 500">
            <div className="grid gap-section sm:grid-cols-2">
              <div className="card-surface flex flex-col gap-inline p-card">
                <p className="text-sm text-muted">References and codes</p>
                <p className="font-mono text-md">CF-2026-001053</p>
                <p className="font-mono text-sm font-medium">TOTE-01 · pairing 482 913</p>
              </div>
              <div className="card-surface flex flex-col gap-inline p-card">
                <p className="text-sm text-muted">Not money, counts, times or dates</p>
                <p className="text-md">৳12,500.00 · 3 tickets · 14 Aug 2026</p>
                <p className="text-sm text-muted">Those stay in Inter.</p>
              </div>
            </div>
          </Preview>
        </Sub>

        <Sub title="Hind Siliguri — Bangla">
          <Preview label="Hind Siliguri, weights 300 to 700">
            <div className="flex flex-col gap-tight" lang="bn">
              {[
                ["font-light", "৩০০"],
                ["font-normal", "৪০০"],
                ["font-medium", "৫০০"],
                ["font-semibold", "৬০০"],
                ["font-bold", "৭০০"],
              ].map(([cls, w]) => (
                <p key={cls} className={`text-md ${cls}`}>
                  টিকিট ইস্যু হয়েছে · আজ ১২টি বুকিং · ৳১,৩০০ <span className="text-sm text-muted">({w})</span>
                </p>
              ))}
            </div>
          </Preview>
          <Small>Bengali glyphs fall through to it per character, so there is no language switch and Latin text inside a Bangla line stays Inter.</Small>
        </Sub>

        <Sub title="How they load, and the fallback stack">
          <P>
            All three come from <Code>next/font/google</Code> in the root layout, self-hosted at build time with <Code>display: swap</Code>, and are exposed as CSS variables on <Code>&lt;html&gt;</Code>. The theme&rsquo;s two stacks point at them:
          </P>
          <CodeBlock
            label="font loading"
            code={[
              'const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });',
              'const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });',
              'const hindSiliguri = Hind_Siliguri({ variable: "--font-hind-siliguri", subsets: ["latin", "bengali"], weight: ["300", "400", "500", "600", "700"], display: "swap" });',
            ].join(String.fromCharCode(10))}
          />
          <TokenTable
            rows={[
              { name: "--font-sans", utility: "font-sans", note: "Inter, then Hind Siliguri, then the system UI face." },
              { name: "--font-mono", utility: "font-mono", note: "DM Mono, then Hind Siliguri, then the system monospace." },
            ]}
            sample="none"
            label="Font stacks"
          />
        </Sub>

        <DoDont
          dos={["Set a booking reference, a ticket code, a SKU or a pairing code in DM Mono.", "Let Inter carry money, counts, times and dates — tabular figures keep a column aligned."]}
          donts={["Set money, counts, times or dates in DM Mono — it is the typewriter face, not a number face.", "Use weight 800, or load another font family for one screen."]}
        />
      </DocSection>

      <DocSection id="scale" title="The scale">
        <P>One size per step, in rem so the till&rsquo;s text-size setting scales every POS screen and OS honours the browser&rsquo;s own font size. Each step carries its line height; both are read from the browser below, with pixels at the current root size.</P>
        <TokenTable rows={SCALE} sample="text" label="Type scale" />
        <Small>
          Weights: 400 body, 500 labels and buttons, 600 titles and figures, 700 POS display figures only. <Code>text-5xl</Code> and <Code>text-6xl</Code> (48 and 60) are the scan verdict and the landing page only.
        </Small>
      </DocSection>

      <DocSection id="roles" title="Roles">
        <P>Use these recipes; do not compose new ones. A title, a figure and a label are different jobs, and each has exactly one.</P>
        <RolesTable />
        <Callout title="No uppercase tracked labels">
          Neither product sets labels in tracked capitals. Hierarchy comes from size, weight and colour. Text truncates only where the full value is reachable (a title, a tooltip, a record); names that tell one row from another wrap.
        </Callout>
      </DocSection>

      <DocSection id="bangla" title="Bangla">
        <P>Every screen ships in English and Bangla, so type has to survive both. Bengali needs more line height than Latin at the same size, which the scale already allows for.</P>
        <Sub title="One scale, two scripts">
          <Preview label="Bangla at three steps">
            <div className="flex flex-col gap-tight" lang="bn">
              <p className="text-3xl font-semibold tracking-title">অর্ডারের তালিকা</p>
              <p className="text-md font-semibold">শীতকালীন প্রদর্শনী পাস</p>
              <p className="text-base">টিকিট কেনা যাবে স্লট শুরু হওয়ার আগে পর্যন্ত।</p>
              <p className="text-sm text-muted">প্রথম দর্শনের পর ৭ দিন বৈধ</p>
            </div>
          </Preview>
        </Sub>
        <Small>Money and clock times stay in Latin digits in both languages, by convention at the counter; an ICU plural&rsquo;s count follows the page&rsquo;s numbering.</Small>
      </DocSection>
    </>
  );
}
