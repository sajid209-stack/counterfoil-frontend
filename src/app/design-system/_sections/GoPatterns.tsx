"use client";

import { Button, Sheet } from "@/components/ui";
import { useState } from "react";
import { Check, Clock, Plus, ShoppingBag, X } from "lucide-react";
import { ActionBar } from "@/app/(go)/_components/ActionBar";
import { WallTile } from "@/app/(go)/_components/WallTile";
import { Callout, Code, DoDont, DocSection, P, SectionHeader, Small } from "../_components/Doc";
import { Preview } from "../_components/Preview";

function Wall() {
  const [counts, setCounts] = useState<Record<string, number>>({ ga: 1 });
  const add = (k: string) => setCounts((c) => ({ ...c, [k]: (c[k] ?? 0) + 1 }));
  return (
    <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
      <WallTile
        onClick={() => add("ga")}
        image="/demo/pages/admission-1.jpg"
        name="General Admission"
        price="৳500"
        meta="Any day you are open"
        live={{ text: "Open today", tone: "ok" }}
        count={counts.ga ?? 0}
      />
      <WallTile
        onClick={() => add("tour")}
        image="/demo/pages/gardentour-1.jpg"
        name="Heritage Walking Tour"
        price="৳800"
        meta="With a guide"
        live={{ text: "3 of 15 left", tone: "low" }}
        flag="Limited"
        count={counts.tour ?? 0}
      />
      <WallTile
        onClick={() => {}}
        glyph={<ShoppingBag size={32} strokeWidth={1.5} aria-hidden />}
        name="Souvenir tote bag"
        price="৳450"
        live={{ text: "Sold out", tone: "none" }}
        soldOut
        soldOutLabel="Sold out"
      />
    </div>
  );
}

function BarDemo() {
  const [step, setStep] = useState(0);
  const labels = ["Add to sale", "Take payment", "Complete sale", "New sale"];
  return (
    <ActionBar
      docked="panel"
      label="Sale actions"
      secondary={step === 0 ? { label: "Hold", onClick: () => {} } : { label: "Back", onClick: () => setStep((s) => Math.max(0, s - 1)) }}
      primary={{ label: labels[step], icon: step === 0 ? <Plus size={20} strokeWidth={1.5} aria-hidden /> : undefined, onClick: () => setStep((s) => (s + 1) % labels.length) }}
    />
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open a booking sheet
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Heritage Walking Tour"
        closeLabel="Close"
        footer={
          <ActionBar
            docked="panel"
            className="w-full border-0 bg-transparent p-0"
            secondary={{ label: "Hold", onClick: () => setOpen(false) }}
            primary={{ label: "Add ৳800", icon: <Plus size={20} strokeWidth={1.5} aria-hidden />, onClick: () => setOpen(false) }}
          />
        }
      >
        <div className="flex flex-col gap-section p-card text-base">
          <p>The sheet opens ready — a date and a ticket type are already chosen — so the orange button works at once.</p>
          <p className="text-sm text-muted">Hold is always on the left, the orange action on the right.</p>
        </div>
      </Sheet>
    </>
  );
}

const hatch = {
  backgroundImage: "repeating-linear-gradient(135deg, transparent 0 10px, color-mix(in srgb, var(--color-danger) 14%, transparent) 10px 20px)",
};

function Verdicts() {
  return (
    <div className="grid gap-section sm:grid-cols-3">
      <div className="flex flex-col items-center gap-tight rounded-go bg-inverse p-card text-center text-inverse-fg">
        <Check size={44} strokeWidth={2} aria-hidden />
        <p className="text-xl font-semibold">Let in</p>
        <p className="text-sm">General Admission · Adult</p>
      </div>
      <div className="flex flex-col items-center gap-tight rounded-go bg-danger-wash p-card text-center text-fg" style={hatch}>
        <X size={44} strokeWidth={2} aria-hidden className="text-danger" />
        <p className="text-xl font-semibold">Do not let in</p>
        <p className="text-sm">Already used 04 Jul. Send them to the counter.</p>
      </div>
      <div className="flex flex-col items-center gap-tight rounded-go bg-warning-wash p-card text-center text-fg">
        <Clock size={44} strokeWidth={2} aria-hidden className="text-warning" />
        <p className="text-xl font-semibold">Balance due</p>
        <p className="text-sm">Take ৳1,537.50 before they go in.</p>
      </div>
    </div>
  );
}

function Floors() {
  return (
    <div className="flex flex-wrap items-center gap-section">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ember-solid text-md font-semibold text-on-solid">44</span>
      <p className="max-w-sm text-sm text-fg">The smallest tap target is 44px square, at every width — the till is touch on a phone and on a counter tablet alike. This text is 13px, the reading floor.</p>
    </div>
  );
}

export function GoPatternsSection() {
  return (
    <>
      <SectionHeader slug="go-patterns" />

      <DocSection id="principles" title="Fast, accurate, on touch">
        <P>
          POS is the till. It shares OS&rsquo;s colour, type and behaviour and differs in shape (18px image-first cards, pill controls, a floating tab bar), elevation (a wide soft lift) and density (nothing smaller than a thumb). It is worked under a queue by people who remember a pattern rather than read — so the next step is always in the same place.
        </P>
        <Small>The till is called <strong className="font-semibold">Counterfoil GO</strong> in code: its routes live under <Code>(go)</Code> and its product token is <Code>data-product=&quot;go&quot;</Code>. This documentation calls it POS; the URL parameter stays <Code>product=go</Code>.</Small>
      </DocSection>

      <DocSection id="sell-tile" title="The sell tile">
        <P>
          One thing on the wall is a card of its own: the picture, the name, the price as the biggest figure, what it is, and what it is doing now. A tile in the sale gets a count badge, a wash and a ring; a sold-out tile drops to the page colour with no shadow. The price is ink — it is loudest by size, not by colour. Tap the tiles.
        </P>
        <Preview product="go" label="WallTile">
          <Wall />
        </Preview>
      </DocSection>

      <DocSection id="action-bar" title="The action bar pair">
        <P>
          <strong className="font-semibold">The orange button is always bottom-right and always moves the sale forward; its “not now” neighbour is always on its left.</strong> Add to sale → Take payment → Complete sale → New sale; Hold, Cart, Pause, Back. One component draws it everywhere so it cannot drift. Press the orange button to walk the steps.
        </P>
        <Preview product="go" label="ActionBar">
          <BarDemo />
        </Preview>
        <DoDont
          dos={["Keep the orange button on the right, every screen.", "Label it with what happens next, not “Continue”.", "Put the “not now” action on its left."]}
          donts={["Swap the pair on one screen.", "Show two orange buttons.", "Grey the button out without saying what is missing — say it on the button."]}
        />
      </DocSection>

      <DocSection id="sheets" title="Sheets">
        <P>A booking opens in a sheet over the wall, ready to sell, with the action bar as its footer. It rises from the edge it belongs to and offers four ways out.</P>
        <Preview product="go" label="Sheet + ActionBar">
          <SheetDemo />
        </Preview>
      </DocSection>

      <DocSection id="verdicts" title="Scan verdicts">
        <P>
          A scan result is read at arm&rsquo;s length in under a second, so it is carried by <strong className="font-semibold">shape, colour and words together</strong>: an ink screen with a check to let someone in, a hatched danger screen with a cross to refuse, an amber one when money is owed. Any one of the three carries it alone.
        </P>
        <Preview product="go" label="Admit · refuse · balance">
          <Verdicts />
        </Preview>
        <Small>A refusal always ends on what to do next. A plain admission clears itself after two seconds; a refusal stays until it is dismissed.</Small>
      </DocSection>

      <DocSection id="floors" title="Touch and reading floors">
        <Preview product="go" label="44px and 13px">
          <Floors />
        </Preview>
        <Callout title="The floors">
          <Code>44px</Code> minimum target and <Code>13px</Code> minimum text on every POS screen, the tab-bar labels included (only the classic till keeps its 11px labels). One stepper, one method selector, one money-figure scale — <Code>text-display</Code> for the amount due.
        </Callout>
      </DocSection>

      <DocSection id="phone" title="On a phone">
        <P>
          The header holds the counter and the person; preferences such as light and dark live in Display &amp; language. A sheet shows a question only when it has answers. Checkout shows the amount, how they pay and Complete; customer, discount and promo code are rows that open in place. The More sheet leads with daily tools (My sales, Shift, Quick pass) and puts the design tools last. Every screen uses the sell wall's card language: each group its own white card, every choice its own rounded tile with a gap around it (orange with a tick when chosen), one card per list item with a picture. There are no category chips; a bag button beside the search jumps to the shop items.
        </P>
      </DocSection>
    </>
  );
}
