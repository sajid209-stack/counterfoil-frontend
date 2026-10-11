"use client";

import { Callout, Code, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview, ThemeQuad } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

const LEVELS: Array<{ level: number; token: string; cls: string; use: string }> = [
  { level: 0, token: "none", cls: "", use: "Layout, tables, settings rows." },
  { level: 1, token: "shadow-sm / shadow-card", cls: "shadow-sm", use: "A resting card." },
  { level: 2, token: "shadow-md / shadow-float", cls: "shadow-md", use: "Menus, popovers, toasts." },
  { level: 3, token: "shadow-lg", cls: "shadow-lg", use: "Dialogs, sheets, the command palette." },
];

const TOKENS: TokenRow[] = [
  { group: "Values — plain CSS the theme points at" },
  { name: "--elevation-1" },
  { name: "--elevation-2" },
  { name: "--elevation-3" },
  { name: "--elevation-go" },
  { name: "--elevation-go-pop" },
  { group: "Theme tokens" },
  { name: "--shadow-sm", utility: "shadow-sm" },
  { name: "--shadow-md", utility: "shadow-md" },
  { name: "--shadow-lg", utility: "shadow-lg" },
  { name: "--shadow-card", utility: "shadow-card", note: "What a resting card is in this product." },
  { name: "--shadow-float", utility: "shadow-float", note: "What a floating layer is in this product." },
];

function Levels() {
  return (
    <div className="grid grid-cols-2 gap-section sm:grid-cols-4">
      {LEVELS.map((l) => (
        <div key={l.level} className="flex flex-col gap-tight">
          <div className={`flex h-20 items-center justify-center rounded-card bg-card text-md font-semibold ${l.cls}`}>{l.level}</div>
          <p className="text-xs text-muted">{l.use}</p>
        </div>
      ))}
    </div>
  );
}

export function ElevationSection() {
  return (
    <>
      <SectionHeader slug="elevation" />

      <DocSection id="levels" title="Four levels">
        <P>No others. A level is a role, not a number to pick: a card is level 1, a menu level 2, a dialog level 3, and layout is flat.</P>
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Elevation levels</caption>
              <thead className="max-md:sr-only">
                <tr className="border-b border-hairline text-muted">
                  <th scope="col" className="px-card py-tight font-medium">
                    Level
                  </th>
                  <th scope="col" className="px-card py-tight font-medium">
                    Token
                  </th>
                  <th scope="col" className="px-card py-tight font-medium">
                    Use
                  </th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((l) => (
                  <tr key={l.level} className="border-b border-hairline last:border-0 max-md:flex max-md:flex-col max-md:px-card max-md:py-comfortable">
                    <td className="px-card py-comfortable tabular-nums max-md:p-0">{l.level}</td>
                    <td className="px-card py-comfortable max-md:p-0">
                      <code className="font-mono text-sm">{l.token}</code>
                    </td>
                    <td className="px-card py-comfortable text-fg max-md:p-0">{l.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Preview label="Levels 0 to 3">
          <Levels />
        </Preview>
      </DocSection>

      <DocSection id="tokens" title="Tokens">
        <P>
          The values live in <Code>--elevation-*</Code> (plain CSS); the theme only points at them, so dark mode and the product can change them. Tailwind inlines a shadow token&rsquo;s value into its utility, so a literal in the theme would ignore both overrides. Never write an arbitrary bracket shadow.
        </P>
        <TokenTable rows={TOKENS} sample="shadow" label="Elevation tokens" />
      </DocSection>

      <DocSection id="modes" title="Light against dark, OS against POS">
        <P>
          Light: a card is a 1px ring and a 2px lift; floating layers are soft. Dark: a card is a surface step plus a 1px line, and floating layers get a deeper, blacker shadow with a faint light edge. POS uses a wider, softer lift for a resting card.
        </P>
        <ThemeQuad>
          <Levels />
        </ThemeQuad>
        <Callout title="One level, two behaviours">
          This is why elevation is a token and a component, never a class string: the same level 1 is a shadow in light and a line in dark.
        </Callout>
      </DocSection>
    </>
  );
}
