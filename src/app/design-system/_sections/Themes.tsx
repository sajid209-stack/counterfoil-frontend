"use client";

import { Button, StatusPill } from "@/components/ui";
import { Plus } from "lucide-react";
import { Callout, Code, CodeBlock, DocSection, P, SectionHeader } from "../_components/Doc";
import { ThemeQuad } from "../_components/Preview";
import { ACCENT_HEX } from "../_components/brand";

const ROWS: Array<{ ref: string; who: string; total: string; status: string }> = [
  { ref: "CF-2026-001053", who: "Ayesha Siddika", total: "৳1,725", status: "paid" },
  { ref: "CF-2026-001052", who: "Rahim Khan", total: "৳800", status: "partial" },
  { ref: "CF-2026-001051", who: "Tanvir Ahmed", total: "৳3,075", status: "refunded" },
];

/** A real-ish fragment: a page header, a card with table rows, and the buttons
 *  that belong with them. */
function Fragment() {
  return (
    <div className="flex flex-col gap-section">
      <div className="flex items-center justify-between gap-tight">
        <h3 className="text-xl font-semibold tracking-title">Orders</h3>
        <Button size="sm" icon={<Plus size={16} strokeWidth={1.5} aria-hidden />}>
          New order
        </Button>
      </div>
      <div className="card-surface overflow-hidden">
        <ul>
          {ROWS.map((r) => (
            <li key={r.ref} className="flex items-center justify-between gap-tight border-b border-hairline px-card py-comfortable last:border-0">
              <div className="min-w-0">
                <p className="font-mono text-sm">{r.ref}</p>
                <p className="truncate text-sm text-muted">{r.who}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-inline">
                <span className="text-base font-medium tabular-nums">{r.total}</span>
                <StatusPill status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-tight">
        <Button variant="secondary" fullWidth>
          Export
        </Button>
        <Button fullWidth>
          Take payment
        </Button>
      </div>
    </div>
  );
}

export function ThemesSection() {
  return (
    <>
      <SectionHeader slug="themes" />

      <DocSection id="axes" title="Two axes">
        <P>
          <strong className="font-semibold">Mode</strong> is <Code>.dark</Code> on <Code>&lt;html&gt;</Code> (next-themes): it switches every semantic colour and the elevation values. <Code>.light</Code> re-asserts the light set on a subtree, so a light island can sit in a dark page — these previews, <Code>.paper</Code> print documents and the <Code>.sf</Code> storefront use it.
        </P>
        <P>
          <strong className="font-semibold">Product</strong> is <Code>data-product=&quot;go&quot;</Code> (set on <Code>&lt;html&gt;</Code> by the boot script on POS routes and by GoShell): it switches the component tokens. OS is the default.
        </P>
        <CodeBlock
          label="preview wrapper"
          code={'<div className="dark" data-product="go">\n  …a POS screen in dark…\n</div>'}
        />
        <Callout title="Both on the same element">
          The product blocks are listed after the mode blocks, so on an element that carries both, the product&rsquo;s shape and elevation resolve against that element&rsquo;s own mode. Putting them on two nested elements would resolve the product tokens against the outer mode.
        </Callout>
      </DocSection>

      <DocSection id="table" title="The four configurations">
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">OS and POS compared</caption>
              <thead>
                <tr className="border-b border-hairline text-muted">
                  <th scope="col" className="px-card py-tight font-medium" />
                  <th scope="col" className="px-card py-tight font-medium">OS</th>
                  <th scope="col" className="px-card py-tight font-medium">POS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Card radius", "12", "18"],
                  ["Control radius", "6", "pill"],
                  ["Inner frame", "3", "14"],
                  ["Sheet edge", "12", "28"],
                  ["Resting card", "1px ring + 2px lift", "wide soft lift"],
                  ["Floating", "level 2", "POS float"],
                  ["Minimum target", "44 phone, 36 desktop", "44 everywhere"],
                  ["Text floor", "12", "13"],
                  ["Primary fill", `brand-500 ${ACCENT_HEX} in both modes`, "the same, in both products"],
                  ["Accent", "ember", "ember (the same brand)"],
                ].map(([k, os, go]) => (
                  <tr key={k} className="border-b border-hairline last:border-0">
                    <th scope="row" className="px-card py-comfortable text-left font-medium text-fg">{k}</th>
                    <td className="px-card py-comfortable tabular-nums text-fg">{os}</td>
                    <td className="px-card py-comfortable tabular-nums text-fg">{go}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <P>
          The classic till (<Code>/classic</Code>) is the till as it was before 6 September, kept on purpose with its own kit; it is outside both product themes.
        </P>
      </DocSection>

      <DocSection id="quad" title="A screen fragment in each">
        <P>Same markup, four times. Nothing in it branches on the theme: the card, the buttons and the pill take their shape and elevation from product tokens.</P>
        <ThemeQuad>
          <Fragment />
        </ThemeQuad>
        <Callout tone="warning" title="A limit of previews on a page">
          A few components use Tailwind&rsquo;s <Code>dark:</Code> utilities directly (the logo, the neutral status pill, some borders). Those follow the <em>page&rsquo;s</em> theme, not the preview&rsquo;s, so a light preview on a dark page can differ slightly from a real light page. Everything driven by tokens is exact. To see a mode precisely, set your whole site to it.
        </Callout>
      </DocSection>
    </>
  );
}
