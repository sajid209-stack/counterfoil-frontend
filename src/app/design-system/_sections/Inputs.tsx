"use client";

import { DateField, DurationInput, Field, FormField, Select, TimeInput } from "@/components/ui";
import { useState } from "react";
import { DEMO_TODAY } from "@/lib/schedule";
import { Callout, Code, ComponentDoc, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";

const VENUES = [
  { value: "fort", label: "Lalbagh Fort" },
  { value: "museum", label: "Ahsan Manzil Museum" },
  { value: "garden", label: "Baldha Garden" },
];
const BOOKINGS = [
  { value: "ga", label: "General Admission", note: "Any day you are open" },
  { value: "pl", label: "Planetarium Show" },
  { value: "tour", label: "Heritage Walking Tour" },
  { value: "cricket", label: "Cricket · Outdoor Field" },
  { value: "futsal", label: "Futsal · Indoor Field" },
  { value: "bowling", label: "Bowling Lane" },
];
const DATE_LABELS = { previousMonth: "Previous month", nextMonth: "Next month", today: "Today", open: "Choose a date" };

function FieldDemo() {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("2");
  const [notes, setNotes] = useState("");
  const [venue, setVenue] = useState("fort");
  const [on, setOn] = useState(true);
  return (
    <div className="grid gap-section md:grid-cols-2">
      <FormField label="Name" help="As it should appear on the ticket." placeholder="Ayesha Siddika" value={name} onChange={(e) => setName(e.target.value)} />
      <FormField label="Tickets" variant="number" value={qty} onChange={(e) => setQty(e.target.value)} />
      <FormField label="Venue" variant="select" options={VENUES} value={venue} onChange={(e) => setVenue(e.target.value)} />
      <FormField label="Email" variant="email" required placeholder="name@example.com" />
      <FormField label="Phone" variant="tel" placeholder="01712 345678" help="Raises the phone keypad." />
      <FormField label="Price" variant="number" prefix="৳" placeholder="500" help="A unit sits inside the box." />
      <FormField label="Deposit" variant="number" suffix="%" placeholder="20" min={0} max={100} />
      <FormField label="Website" variant="url" placeholder="https://" />
      <FormField label="Find" variant="search" placeholder="Search bookings" />
      <FormField className="md:col-span-2" label="Notes" variant="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the counter should know" />
      <FormField label="Online sales" variant="toggle" checked={on} onChange={(e) => setOn((e.target as HTMLInputElement).checked)} help="A Switch. Sells on your website as well as at the counter." />
      <FormField label="Date" variant="date" help="Counterfoil's own calendar; the value is an ISO date." />
    </div>
  );
}

function ValidationDemo() {
  return (
    <div className="grid gap-section md:grid-cols-3">
      <FormField label="Default" help="Help sits under the field." placeholder="Type here" />
      <FormField label="Invalid" error="Enter a price, for example 500." value="abc" onChange={() => {}} />
      <FormField label="Disabled" help="Set by your role." value="Locked" disabled onChange={() => {}} />
    </div>
  );
}

function SelectDemo() {
  const [a, setA] = useState("ga");
  const [b, setB] = useState("fort");
  return (
    <div className="grid gap-section md:grid-cols-2">
      <Field label="Short list — no search" htmlFor="ds-sel-a">
        <Select id="ds-sel-a" value={b} onChange={setB} options={VENUES} />
      </Field>
      <Field label="Long list — type to search" help="Five or more options grow a search field." htmlFor="ds-sel-b">
        <Select id="ds-sel-b" value={a} onChange={setA} options={BOOKINGS} />
      </Field>
    </div>
  );
}

function PickerDemo() {
  const [date, setDate] = useState<string | null>(DEMO_TODAY);
  const [time, setTime] = useState("19:00");
  const [end, setEnd] = useState("21:00");
  const [mins, setMins] = useState(90);
  return (
    <div className="grid gap-section md:grid-cols-2">
      <Field label="Date" htmlFor="ds-date">
        <DateField id="ds-date" size="form" value={date} onChange={setDate} today={DEMO_TODAY} labels={DATE_LABELS} />
      </Field>
      <TimeInput label="Start time" value={time} onChange={setTime} picker help="Type 7pm, 19:00 or 730p, or open the list." />
      <TimeInput label="End time (stepper)" value={end} onChange={setEnd} help="Without picker: nudge by 15 minutes." />
      <DurationInput label="Duration" value={mins} onChange={setMins} chips={[30, 60, 90, 120]} help="Chips fill the field; they never limit it." />
    </div>
  );
}

export function InputsSection() {
  return (
    <>
      <SectionHeader slug="inputs" />

      <DocSection id="anatomy" title="How a field is built">
        <P>
          A label above, the control, then one line of help — which an error <em>replaces</em>, so the field never grows two sentences. Controls are 44px on a phone and 36px dense on a desktop where a form allows; the edge is <Code>line</Code>, focus is the <Code>ring</Code>, and an invalid field takes a <Code>danger</Code> edge plus a sentence below saying what to do.
        </P>
        <Callout>
          <Code>Field</Code> is the wrapper (label, help, error); <Code>FormField</Code> is a wrapper plus a control picked by <Code>variant</Code>. Wire help and error to the control with <Code>aria-describedby</Code> — <Code>FormField</Code> does it for you.
        </Callout>
      </DocSection>

      <ComponentDoc
        id="form-field"
        title="Field and FormField"
        demo={
          <Preview label="Variants">
            <FieldDemo />
          </Preview>
        }
        importCode={'import { Field, FormField } from "@/components/ui";'}
        props={[
          { prop: "label", type: "string", description: "Above the control. Always provide one." },
          { prop: "variant", type: '"text" | "number" | "email" | "password" | "tel" | "url" | "search" | "select" | "textarea" | "toggle" | "date"', default: '"text"', description: "Which control. tel, email, url and search also raise the matching phone keyboard. toggle is a Switch; date is Counterfoil's own calendar; select is Select." },
          { prop: "prefix / suffix", type: "ReactNode", description: "A unit or glyph inside the box before or after the value (৳, %, days). Text-like variants only." },
          { prop: "min / max / step", type: "string | number", description: "A number's range, or a date's earliest and latest day." },
          { prop: "help", type: "string", description: "One sentence under the field." },
          { prop: "error", type: "string", description: "Replaces help, turns the edge danger, sets aria-invalid." },
          { prop: "required", type: "boolean", description: "Adds the asterisk." },
          { prop: "options", type: "SelectOption[]", description: "For variant=select." },
          { prop: "value / onChange", type: "native", description: "Controlled, like any input." },
          { prop: "autoComplete, inputMode", type: "string", description: "What the browser may fill in; the right keyboard on a phone." },
          { prop: "AffixInput / controlClass", type: "—", description: "The same chrome for a bare input (controlClass) or an input with fixed ends (AffixInput), when FormField's label wrapper is not wanted." },
        ]}
        dos={["Put the label above the field, in words.", "Say what to do in an error: “Enter a price, for example 500.”", "Offer autoComplete and the right inputMode."]}
        donts={["Use a placeholder as the label — it disappears when typing.", "Show help and an error together.", "Validate before the person has finished typing."]}
      />

      <DocSection id="validation" title="Validation states">
        <Preview label="Default · invalid · disabled">
          <ValidationDemo />
        </Preview>
      </DocSection>

      <ComponentDoc
        id="select"
        title="Select"
        summary="Counterfoil's own dropdown, never the platform's: it can be themed, carries a second line and group headings, and keeps its chevron in a reserved gutter. Above five options it grows a search field; below that, typing jumps to the next match."
        demo={
          <Preview label="Short and long lists">
            <SelectDemo />
          </Preview>
        }
        importCode={'import { Select } from "@/components/ui";'}
        props={[
          { prop: "value / onChange", type: "string / (value) => void", description: "Controlled. onChange receives the value, not an event." },
          { prop: "options", type: "SelectOption[]", description: "{ value, label, note?, group?, disabled? }." },
          { prop: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "The ONLY place height is set: toolbar, form, or the till's 48px." },
          { prop: "bare", type: "boolean", default: "false", description: "No box of its own — inside a chip or card header that has one." },
          { prop: "align", type: '"start" | "end"', default: '"start"', description: "Which edge the panel hangs from." },
          { prop: "placeholder, icon", type: "string, ReactNode", description: "Shown with no value; a glyph for a control with no visible label." },
          { prop: "aria-label", type: "string", description: "Required when there is no visible label." },
        ]}
        dos={["Use it for any pick-one list of more than two options.", "Give a long list real names — people search by them.", "Name it with a label or aria-label."]}
        donts={["Write a native <select>: it cannot be themed and its list belongs to the OS.", "Layer a height with triggerClassName; use size.", "Hide the only way to a value behind a search someone must guess."]}
      />

      <ComponentDoc
        id="pickers"
        title="DateField, TimeInput, DurationInput"
        summary="Dates, times and durations are typed forgivingly and shown the way the rest of the page shows them: “29 Jul 2026”, “7:30 PM”, “1 hr 30 min”. Times are drawn 12-hour and stored as 24-hour HH:MM."
        demo={
          <Preview label="Date, time and duration">
            <PickerDemo />
          </Preview>
        }
        importCode={'import { DateField, TimeInput, DurationInput } from "@/components/ui";'}
        props={[
          { prop: "DateField value", type: "string | null", description: "Local ISO date yyyy-mm-dd — never toISOString, which shifts the day at +06:00. (FormField variant=date wraps this.)" },
          { prop: "DateField today, min, max", type: "string", description: "today is required; min and max bound the choice." },
          { prop: "DateField labels", type: "{ previousMonth, nextMonth, today, open }", description: "Translated strings for the panel." },
          { prop: "DateField size", type: '"toolbar" | "form"', default: '"toolbar"', description: "form keeps 44px beside text fields." },
          { prop: "TimeInput value", type: "string", description: "Stored “HH:MM”; the box shows “7:30 PM”." },
          { prop: "TimeInput picker, step", type: "boolean, number", default: "false, 15", description: "picker adds a list of every step; otherwise nudge buttons." },
          { prop: "DurationInput value", type: "number", description: "Minutes. Types 90, 1:30, 1h30 or 1.5." },
          { prop: "DurationInput chips", type: "number[]", description: "Quick fills, in minutes. They fill; they never limit." },
        ]}
        dos={["Use FormField variant=\"date\" or DateField — never an input with type=date.", "Let people type: 730p, 1h30.", "Show a parse error that says what to try."]}
        donts={["Show 24-hour times to a person.", "Limit a duration to its chips.", "Store a date from toISOString."]}
      />
    </>
  );
}
