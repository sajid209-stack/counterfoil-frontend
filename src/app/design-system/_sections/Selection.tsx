"use client";

import { Checkbox, RadioGroup, Chip, SegmentedControl, Switch } from "@/components/ui";
import { useState } from "react";
import { Callout, ComponentDoc, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";

function CheckboxDemo() {
  const [sms, setSms] = useState(true);
  const [mail, setMail] = useState(false);
  const all = sms && mail;
  const some = sms || mail;
  return (
    <div className="grid gap-section md:grid-cols-2">
      <div className="flex flex-col">
        <Checkbox label="Send to all" indeterminate={some && !all} checked={all} onCheckedChange={(v) => { setSms(v); setMail(v); }} />
        <div className="pl-major">
          <Checkbox label="SMS" description="Sent when the sale completes." checked={sms} onCheckedChange={setSms} />
          <Checkbox label="E-mail" checked={mail} onCheckedChange={setMail} />
        </div>
      </div>
      <div className="flex flex-col">
        <Checkbox label="Default" defaultChecked />
        <Checkbox label="Invalid" invalid description="Accept the booking terms to continue." />
        <Checkbox label="Disabled" disabled />
      </div>
    </div>
  );
}

function RadioDemo() {
  const [m, setM] = useState("cash");
  return (
    <RadioGroup
      aria-label="How are they paying?"
      value={m}
      onChange={setM}
      options={[
        { value: "cash", label: "Cash", description: "Counted into the drawer." },
        { value: "bkash", label: "bKash", description: "Needs the transaction ID." },
        { value: "card", label: "Card", description: "Taken on the terminal.", disabled: true },
      ]}
    />
  );
}

function SwitchDemo() {
  const [online, setOnline] = useState(true);
  return (
    <div className="flex flex-col gap-tight">
      <Switch checked={online} onChange={setOnline} label="Online sales" description="Sells on your website as well as at the counter." />
      <Switch defaultChecked={false} label="Reminders" description="Off." />
      <Switch disabled defaultChecked label="Locked by your role" />
      <div className="flex items-center justify-between border-t border-hairline pt-tight">
        <span className="text-base">Row with no visible label for the switch</span>
        <Switch aria-label="Show on the till" defaultChecked />
      </div>
    </div>
  );
}

function SegmentedDemo() {
  const [v, setV] = useState("today");
  const [s, setS] = useState("week");
  return (
    <div className="flex flex-col gap-section">
      <SegmentedControl aria-label="Scope" value={v} onChange={setV} options={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }]} />
      <SegmentedControl aria-label="Group" size="sm" value={s} onChange={setS} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
      <SegmentedControl aria-label="Full width" fullWidth value={v} onChange={setV} options={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }]} />
    </div>
  );
}

function ChipDemo() {
  const [on, setOn] = useState<string[]>(["paid"]);
  const toggle = (k: string) => setOn((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const [applied, setApplied] = useState(true);
  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-wrap gap-tight" role="group" aria-label="Status">
        {[["paid", "Paid", 112], ["partial", "Part paid", 9], ["refunded", "Refunded", 4]].map(([k, l, c]) => (
          <Chip key={k as string} selected={on.includes(k as string)} onClick={() => toggle(k as string)} count={c as number}>
            {l}
          </Chip>
        ))}
        <Chip disabled>Unavailable</Chip>
      </div>
      {applied && (
        <div className="flex flex-wrap gap-tight">
          <Chip selected onRemove={() => setApplied(false)} removeLabel="Remove Status: Paid">
            Status: Paid
          </Chip>
        </div>
      )}
    </div>
  );
}

export function SelectionSection() {
  return (
    <>
      <SectionHeader slug="selection" />

      <DocSection id="choosing" title="Which one">
        <P>The first question is whether the choice is one thing or several, and whether it applies as it flips.</P>
        <ul className="flex max-w-prose list-disc flex-col gap-tight pl-major text-base text-fg marker:text-muted">
          <li><strong className="font-semibold">Switch</strong> — a setting with two states that takes effect as you flip it (or is saved with the form).</li>
          <li><strong className="font-semibold">Checkbox</strong> — one of several independent yes/no choices submitted together.</li>
          <li><strong className="font-semibold">Radio</strong> — exactly one of a few options that need a description.</li>
          <li><strong className="font-semibold">SegmentedControl</strong> — exactly one of two to four short options that read as modes or views.</li>
          <li><strong className="font-semibold">Chip</strong> — a set of independent filters or tags, or an applied filter you can clear.</li>
        </ul>
        <Callout>Selection never depends on colour alone: a chosen chip shows a check, a chosen option shows a mark, and each exposes its state to assistive tech.</Callout>
      </DocSection>

      <ComponentDoc
        id="checkbox"
        title="Checkbox"
        demo={<Preview label="Group with a select-all · states"><CheckboxDemo /></Preview>}
        importCode={'import { Checkbox } from "@/components/ui";'}
        props={[
          { prop: "label, description", type: "ReactNode", description: "Clicking the label toggles. 44px target through it." },
          { prop: "checked / onCheckedChange", type: "boolean / (checked) => void", description: "Controlled; or defaultChecked for uncontrolled." },
          { prop: "indeterminate", type: "boolean", default: "false", description: "Part-selected: a select-all over a list." },
          { prop: "invalid", type: "boolean", description: "Danger edge and aria-invalid." },
          { prop: "disabled", type: "boolean", description: "Not available." },
        ]}
        dos={["Use for independent yes/no choices.", "Show a select-all as indeterminate when part is chosen."]}
        donts={["Use for a setting that applies instantly — that is a Switch.", "Use for one-of-many."]}
      />

      <ComponentDoc
        id="radio"
        title="Radio and RadioGroup"
        demo={<Preview label="A group with descriptions"><RadioDemo /></Preview>}
        importCode={'import { Radio, RadioGroup } from "@/components/ui";'}
        props={[
          { prop: "RadioGroup options", type: "{ value, label, description?, disabled? }[]", description: "The set. Native radios underneath: arrow keys move and select." },
          { prop: "value / onChange", type: "string / (value) => void", description: "Controlled." },
          { prop: "orientation", type: '"vertical" | "horizontal"', default: '"vertical"', description: "Layout." },
          { prop: "aria-label / aria-labelledby", type: "string", description: "Required — a group with no name is a set of unexplained dots." },
        ]}
        dos={["Name the group.", "Use when each option needs a sentence."]}
        donts={["Use for two short options that read as modes — a SegmentedControl is calmer.", "Leave a radio group with nothing chosen when a default exists."]}
      />

      <ComponentDoc
        id="switch"
        title="Switch"
        demo={<Preview label="Labelled, described, disabled, and with no visible label"><SwitchDemo /></Preview>}
        importCode={'import { Switch } from "@/components/ui";'}
        props={[
          { prop: "checked / onChange", type: "boolean / (next) => void", description: "Controlled; or defaultChecked." },
          { prop: "label, description", type: "ReactNode", description: "Beside the track. Wired as the accessible name and description." },
          { prop: "aria-label", type: "string", description: "For a switch no visible text points at — one per list row." },
          { prop: "disabled", type: "boolean", description: "Not available." },
        ]}
        dos={["Describe what flipping it does.", "Take effect as it flips, or save with the form's save bar."]}
        donts={["Use for a choice that is submitted later with others — use a Checkbox.", "Leave a row switch without an aria-label."]}
      />

      <ComponentDoc
        id="segmented"
        title="SegmentedControl"
        demo={<Preview label="Two options · three · full width"><SegmentedDemo /></Preview>}
        importCode={'import { SegmentedControl } from "@/components/ui";'}
        props={[
          { prop: "options", type: "{ value, label, icon?, ariaLabel?, disabled? }[]", description: "Two to four short options." },
          { prop: "value / onChange", type: "string / (value) => void", description: "Controlled. Arrow keys move and select." },
          { prop: "size", type: '"sm" | "md"', default: '"md"', description: "Height." },
          { prop: "fullWidth", type: "boolean", description: "Share the row equally." },
          { prop: "aria-label", type: "string", description: "Names the group." },
        ]}
        dos={["Use for views or modes: Today / This week.", "Keep labels to a word or two."]}
        donts={["Use for navigation between pages — that is Tabs.", "Use more than four options."]}
      />

      <ComponentDoc
        id="chip"
        title="Chip"
        demo={<Preview label="Toggle chips with counts · an applied filter"><ChipDemo /></Preview>}
        importCode={'import { Chip } from "@/components/ui";'}
        props={[
          { prop: "selected", type: "boolean", default: "false", description: "Solid ember-solid with a check." },
          { prop: "onClick", type: "() => void", description: "Toggle. Omit for a read-only chip." },
          { prop: "onRemove, removeLabel", type: "() => void, string", description: "Adds a × and names it: “Remove Status: Paid”." },
          { prop: "count, icon", type: "number, ReactNode", description: "A trailing figure; a leading glyph." },
        ]}
        dos={["Show an applied filter as a removable chip that names its value.", "Pair a filter with its count where it helps."]}
        donts={["Use a chip for one-of-many views.", "Rely on the fill alone to show selection."]}
      />
    </>
  );
}
