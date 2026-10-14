"use client";

import { Inbox } from "lucide-react";
import { EmptyScreen } from "@/components/screens/EmptyScreen";
import { PageSkeleton } from "@/components/screens/PageSkeleton";
import { ENTRIES, matchScreen } from "@/components/screens/registry";
import { StatusScreen } from "@/components/screens/StatusScreen";
import type { SkeletonShape } from "@/components/screens/types";
import { Callout, Code, CodeBlock, DoDont, DocSection, P, SectionHeader, Small, Sub } from "../_components/Doc";
import { Preview } from "../_components/Preview";

/**
 * The six faces of a screen.
 *
 * Every page in OS and POS can be live, loading, empty, in error, not found or
 * signed out. Live data almost never shows the other five, so they rot unseen —
 * this section draws all of them, and the page-state menu in the top bar of both
 * shells draws the same ones over any real page.
 */

const OS_SHAPES: Array<{ shape: SkeletonShape; note: string }> = [
  { shape: "dashboard", note: "Stat tiles, a chart beside a feed, then a table." },
  { shape: "list", note: "Toolbar, a table (two-line rows on a phone), pagination." },
  { shape: "cards", note: "Toolbar, then a grid of picture cards." },
  { shape: "detail", note: "Record header, facts and lines on the left, side cards on the right." },
  { shape: "form", note: "Titled cards of label-and-control rows." },
  { shape: "calendar", note: "Date controls over the week grid (a day strip and agenda on a phone)." },
  { shape: "analytics", note: "Range controls, a figure band, one big chart, then small cards." },
];

const GO_SHAPES: Array<{ shape: SkeletonShape; note: string }> = [
  { shape: "pos-wall", note: "Date and search, chips, tile grid, the dock." },
  { shape: "pos-board", note: "Week strip, place chips, the hour-by-place grid." },
  { shape: "pos-list", note: "Search, chips, one card of rows with their action." },
  { shape: "pos-form", note: "A centred card: sign-in, pairing, shift." },
  { shape: "pos-scan", note: "The camera viewport, the code field, quick chips." },
];

/** A skeleton is tall; the docs show the top of it, which is the part that has to match. */
function Crop({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return <div className={narrow ? "mx-auto h-96 max-w-3xl overflow-hidden" : "h-96 overflow-hidden"}>{children}</div>;
}

function Coverage() {
  const shapes = [...OS_SHAPES, ...GO_SHAPES].map((s) => s.shape);
  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Routes by skeleton shape</caption>
        <thead>
          <tr className="border-b border-hairline text-muted">
            <th scope="col" className="px-card py-tight font-medium">
              Shape
            </th>
            <th scope="col" className="px-card py-tight font-medium">
              Routes
            </th>
            <th scope="col" className="px-card py-tight font-medium">
              Examples
            </th>
          </tr>
        </thead>
        <tbody>
          {shapes.map((shape) => {
            const routes = ENTRIES.filter((e) => e.shape === shape);
            return (
              <tr key={shape} className="border-b border-hairline last:border-0">
                <td className="px-card py-comfortable align-top">
                  <Code>{shape}</Code>
                </td>
                <td className="px-card py-comfortable align-top text-fg">{routes.length || "—"}</td>
                <td className="px-card py-comfortable align-top text-muted">
                  {routes.length ? (
                    routes
                      .slice(0, 3)
                      .map((r) => r.pattern)
                      .join(", ") + (routes.length > 3 ? `, +${routes.length - 3} more` : "")
                  ) : (
                    <span>None yet</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const REGISTRY_SNIPPET = `// src/components/screens/registry.os.ts  (till routes: registry.go.ts)
{
  pattern: "/orders",              // [id] is one dynamic segment
  surface: "os",
  shape: "list",                   // which skeleton draws its loading state
  empty: {
    id: "orders",                  // screens.empty.orders.title / .body / .action
    icon: ReceiptText,
    action: "/pos",                // the ONE primary action; "self" = this page, live
  },
}`;

export function ScreenStatesSection() {
  const orders = matchScreen("/orders")!.empty;
  const catalog = matchScreen("/catalog")!.empty;
  const team = matchScreen("/settings/team/new")!.empty;
  return (
    <>
      <SectionHeader slug="screen-states" />

      <DocSection id="principles" title="Six faces, one registry">
        <P>
          Every screen can be <strong className="font-semibold">live</strong>, <strong className="font-semibold">loading</strong>, <strong className="font-semibold">empty</strong>, in <strong className="font-semibold">error</strong>, <strong className="font-semibold">not found</strong> or <strong className="font-semibold">signed out</strong>. A screen that only ever looks right with data in it is half designed, so all six are built from the same kit and chosen by the same registry:
        </P>
        <ul className="flex max-w-prose list-disc flex-col gap-inline pl-section text-base text-fg marker:text-muted">
          <li>
            <Code>PageSkeleton</Code> draws the loading state as the page&rsquo;s own shape.
          </li>
          <li>
            <Code>EmptyScreen</Code> draws a page with nothing on it, with copy written for that page.
          </li>
          <li>
            <Code>StatusScreen</Code> draws error, not found and signed out, framed inside the app or as a whole page.
          </li>
          <li>
            <Code>ScreenPreview</Code> picks the right one for a route and a state; both shells use it.
          </li>
          <li>
            <Code>registry.ts</Code> maps every route to its skeleton shape and its empty copy.
          </li>
        </ul>
        <Small>
          The one drawing they share is a ticket torn at its perforation — the counterfoil the product is named after. The outline is always a quiet line; only the icon on it takes a tone (red for an error, blue for not found, amber for signed out).
        </Small>
      </DocSection>

      <DocSection id="loading" title="Loading: the page's own shape">
        <P>
          A skeleton earns its place only when it matches the page it stands in for — the same filter row, the same rows or cards — so the page does not move when the data arrives (Polaris&rsquo; SkeletonPage, Linear and Stripe all work this way). Blocks are the ordinary pulse and are still under reduced motion. The region is <Code>role=&quot;status&quot;</Code> with <Code>aria-busy</Code> and one visually hidden &ldquo;Loading…&rdquo;; every block is <Code>aria-hidden</Code>.
        </P>
        <Sub title="OS — seven shapes">
          <div className="flex flex-col gap-section">
            {OS_SHAPES.map(({ shape, note }) => (
              <Preview key={shape} product="os" label={`${shape} — ${note}`}>
                <Crop>
                  <PageSkeleton shape={shape} />
                </Crop>
              </Preview>
            ))}
          </div>
        </Sub>
        <Sub title="POS — five shapes">
          <div className="flex flex-col gap-section">
            {GO_SHAPES.map(({ shape, note }) => (
              <Preview key={shape} product="go" label={`${shape} — ${note}`}>
                <Crop narrow>
                  <PageSkeleton shape={shape} />
                </Crop>
              </Preview>
            ))}
          </div>
        </Sub>
        <Sub title="Route coverage">
          <Small>Read live from the registry. A route with no entry falls back to a generic list skeleton and a generic empty page, so a new screen is never blank while it waits.</Small>
          <Coverage />
        </Sub>
      </DocSection>

      <DocSection id="empty" title="Empty: say what is missing, and what to do">
        <P>
          Four parts, in this order: the drawing; <strong className="font-semibold">one headline</strong> that says what is missing; <strong className="font-semibold">one line</strong> that says why it matters or what will appear; <strong className="font-semibold">one primary action</strong>. A quiet second link is allowed. The copy is specific to the page — &ldquo;No orders yet. Sales from the counter and your website appear here.&rdquo; — never a shared &ldquo;No data&rdquo;.
        </P>
        <Preview product="os" label="List page, with a second link">
          <EmptyScreen spec={{ ...catalog, secondary: "/orders" }} />
        </Preview>
        <Preview product="os" label="List page">
          <EmptyScreen spec={orders} />
        </Preview>
        <Preview product="os" label="Form page: the action says start">
          <EmptyScreen spec={team} onSelf={() => {}} />
        </Preview>
        <Preview product="go" label="POS (generic copy until the till's entries are added)">
          <EmptyScreen spec={{ id: "generic", icon: Inbox, action: "/pos" }} />
        </Preview>
        <DoDont
          dos={["Name the thing that is missing (“No orders yet”).", "Say where it will come from, in one line.", "Make the one action the real way to fill the page."]}
          donts={["Write “No data” or “Nothing to display”.", "Offer two filled buttons.", "Use an empty state for an error: the page is not empty, it failed."]}
        />
        <Small>
          <Code>EmptyState</Code> in the kit is the smaller cousin for inside a card or a table (&ldquo;No results for this filter&rdquo;). <Code>EmptyScreen</Code> is the whole page.
        </Small>
      </DocSection>

      <DocSection id="status" title="Error, not found and signed out">
        <P>
          Each says <strong className="font-semibold">what happened</strong> and <strong className="font-semibold">what to do</strong>, with one primary action: Try again, Go to dashboard, Sign in again. An error also carries a reference code to quote — the digest Next gives a server error, or a short code made from the message — with a copy button. Not found offers a way home, a way back and, inside OS, a search that opens the command palette.
        </P>
        <Preview product="os" label="Error">
          <StatusScreen variant="error" framed reference="CF-ZH8-UK4" onRetry={() => {}} />
        </Preview>
        <Preview product="os" label="Not found">
          <StatusScreen variant="notFound" framed onSearch={() => {}} />
        </Preview>
        <Preview product="os" label="Signed out">
          <StatusScreen variant="sessionExpired" framed />
        </Preview>
        <Preview product="go" label="Error, in POS: home is the sell screen">
          <StatusScreen variant="error" framed surface="go" reference="CF-ZH8-UK4" onRetry={() => {}} />
        </Preview>
        <Sub title="Where each one lives">
          <ul className="flex max-w-prose list-disc flex-col gap-inline pl-section text-base text-fg marker:text-muted">
            <li>
              <Code>app/not-found.tsx</Code> — a URL that matches nothing. <Code>app/(os)/not-found.tsx</Code> — a missing record inside the admin frame.
            </li>
            <li>
              <Code>app/error.tsx</Code> — any error below the root layout, as a whole page. <Code>app/(os)/error.tsx</Code> — an error in an admin page, drawn inside the frame so the rail still works.
            </li>
            <li>
              <Code>app/global-error.tsx</Code> — an error in the root layout itself. It replaces the layout, so it has no providers: its own two-language copy, the cookie for the language and the boot script for the theme.
            </li>
            <li>
              <Code>app/session-expired</Code> — a standalone, bilingual page with the language switch on it, because a cashier who reads only Bangla meets it before signing in.
            </li>
          </ul>
        </Sub>
        <DoDont
          dos={["Say it is not the person's fault, in one sentence.", "End on the next step.", "Give an error a code that can be read out over the phone."]}
          donts={["Show a stack trace or the raw error message.", "Blame the person (“You entered…”).", "Leave an error with no way out: always Try again and Go home."]}
        />
      </DocSection>

      <DocSection id="preview" title="Previewing every state">
        <P>
          A <strong className="font-semibold">Page state</strong> menu sits beside the venue (OS) or counter (POS) picker in the top bar, and in the phone menu sheet. Choosing a state draws that face in place of the page while the rail and bar stay put: Loading shows the page&rsquo;s skeleton, Empty its empty page, Error, Not found and Session expired the status pages.
        </P>
        <ul className="flex max-w-prose list-disc flex-col gap-inline pl-section text-base text-fg marker:text-muted">
          <li>
            The choice is held per browser (<Code>lib/screenState</Code>: <Code>useScreenState</Code>, <Code>setScreenState</Code>) and follows you from page to page until you choose Live.
          </li>
          <li>Anything but Live turns the menu amber with a ring, so nobody mistakes a sample for real data. On a phone the bar shows a chip to leave the preview.</li>
          <li>
            Actions mean what they say but stay in the preview: <Code>self</Code> actions and Try again return to the live page; other actions go where they would.
          </li>
          <li>
            It shows on Settings pages too, unlike the venue picker: a state is a lens on the whole shell, not on a venue.
          </li>
        </ul>
        <Callout title="Adding a route">
          Add one entry to the registry and four strings to the <Code>screens</Code> messages (English and Bangla). Without an entry the route still has a generic skeleton and empty page.
        </Callout>
        <CodeBlock label="registry entry" code={REGISTRY_SNIPPET} />
      </DocSection>
    </>
  );
}
