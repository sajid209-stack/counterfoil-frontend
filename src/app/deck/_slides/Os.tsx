import { Archive, Check, Eye, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { Callout, Crop, Floor, Glow, Hotspot, Laptop, Phone, Pill, Slide, Step, Ticket, deckStyles as s } from "../_components/Parts";
import dashLight from "../_media/os-dashboard-light.jpg";
import calendar from "../_media/os-calendar-light.jpg";
import bookings from "../_media/os-bookings.jpg";
import holds from "../_media/os-holds.jpg";
import orders from "../_media/os-orders.jpg";
import order from "../_media/os-order.jpg";
import customers from "../_media/os-customers.jpg";
import customer from "../_media/os-customer.jpg";
import reportsDark from "../_media/os-reports-dark.jpg";
import eventOs from "../_media/os-event.jpg";
import turfPhone from "../_media/web-turfcup-phone.jpg";
import settings from "../_media/os-settings.jpg";

/*
 * Chapter 01 — Counterfoil OS, one slide per part of the admin app.
 *
 * Paper is the OS chapter's ground and ink is Go's, so where a slide sits in
 * the product can be told before a word of it is read. Each slide names at most
 * three or four things, and no two neighbours share a composition: a laptop, a
 * flat crop with a close-up, a bento, a list over its record, the same mirrored.
 */

/** Stacked below 1280: a screen area that does not outgrow a tablet-width slide. */
const SCREENS = "relative mx-auto w-full max-w-[680px] xl:mx-0 xl:max-w-none";

function Intro({ eyebrow, title, lead, className }: { eyebrow: string; title: string; lead?: string; className?: string }) {
  return (
    <div className={className}>
      <p className={s.eyebrow}>{eyebrow}</p>
      <h2 className={cn(s.title, "mt-[max(10px,1.4cqw)]")}>{title}</h2>
      {lead && <p className={cn(s.lead, "mt-[max(10px,1.6cqw)]")}>{lead}</p>}
    </div>
  );
}

function Ticks({ items, tone }: { items: string[]; tone: "ink" | "paper" }) {
  return (
    <ul className="flex flex-col gap-[max(10px,0.9cqw)]">
      {items.map((line) => (
        <li key={line} className={cn(s.body, "flex items-start gap-[max(10px,0.8cqw)]", tone === "paper" && "text-[#22211f]")}>
          <span
            aria-hidden
            className={cn(
              "mt-[0.2em] grid h-[max(20px,1.5cqw)] w-[max(20px,1.5cqw)] shrink-0 place-items-center rounded-full",
              tone === "paper" ? "bg-[#141413] text-[#f5f2eb]" : "bg-white/10 text-[#ffa572]",
            )}
          >
            <Check className="h-[60%] w-[60%]" strokeWidth={2.4} />
          </span>
          {line}
        </li>
      ))}
    </ul>
  );
}

/** A chapter opens on ink, with its number printed on the stub. */
export function ChapterDivider({
  n,
  chapter,
  word,
  title,
  lead,
  contents,
}: {
  n: number;
  chapter: string;
  word: string;
  title: string;
  lead: string;
  contents: string[];
}) {
  return (
    <Slide tone="ink" n={n} section={`Chapter ${chapter}`} label={title}>
      <Glow className="right-[-6%] top-[-30%] h-[120%] w-[62%]" />
      <Floor />
      <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
        <div className="flex flex-col justify-between gap-8 xl:col-span-6">
          <p className={s.eyebrow}>Chapter {chapter}</p>
          <div>
            <h2 className={s.display}>{title}</h2>
            <p className={cn(s.lead, "mt-[max(12px,1.8cqw)] max-w-[40ch]")}>{lead}</p>
          </div>
          <ul className="flex flex-wrap gap-[max(6px,0.6cqw)]">
            {contents.map((c) => (
              <li key={c}>
                <Pill>{c}</Pill>
              </li>
            ))}
          </ul>
        </div>
        {/* Capped below 1280: sized to a wide stacked slide, the tilted stub grew
            up over the chapter's own contents. */}
        <div className="relative mx-auto min-h-[240px] w-full max-w-[520px] sm:min-h-[340px] xl:col-span-6 xl:mx-0 xl:min-h-0 xl:max-w-none">
          <Ticket
            variant="glass"
            className="absolute left-[6%] top-[40%] w-[56%] [transform:perspective(1000px)_rotateX(26deg)_rotateY(-24deg)_rotateZ(-16deg)] xl:left-[2%] xl:top-[44%]"
          />
          <Ticket
            word={word}
            kicker={`Chapter ${chapter}`}
            code={`CF-2026-CH${chapter}`}
            className={cn(s.float, "absolute right-[2%] top-[4%] w-[74%] xl:right-[4%] xl:top-[16%] xl:w-[70%]")}
          />
        </div>
      </div>
    </Slide>
  );
}

export function DashboardSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil OS" label="The day, at a glance">
      <div className="grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4 xl:pr-[2cqw]">
          <Intro eyebrow="Dashboard" title="The day, at a glance." lead="What came in, what is filling up, and what needs a decision before it costs money." />
          <ol className="flex flex-col gap-[max(14px,1.5cqw)]">
            <Step n={1} title="Four numbers" body="Revenue, capacity sold, arrivals and what is booked ahead." />
            <Step n={2} title="Revenue trend" body="The last 30 days against the 30 before them." />
            <Step n={3} title="Needs attention" body="A short cash count, a booking about to stop, a tablet gone quiet." />
          </ol>
        </div>
        <div className={cn(SCREENS, "xl:col-span-8")}>
          <div className="relative xl:absolute xl:right-[-4%] xl:top-[8%] xl:w-[102%]">
            <Laptop src={dashLight} alt="The Counterfoil OS dashboard for Lalbagh Heritage Attractions" tilt="none" />
            <Hotspot n={1} className="left-[19%] top-[18%]" />
            <Hotspot n={2} className="left-[47%] top-[42%]" />
            <Hotspot n={3} className="left-[85%] top-[38.5%]" />
          </div>
        </div>
      </div>
    </Slide>
  );
}

const STATES = [
  { name: "Booked", swatch: "bg-[#fde2d4] ring-[#f3b495]" },
  { name: "Arrived", swatch: "bg-[#dcefe2] ring-[#9fd0ae]" },
  { name: "No-show", swatch: "bg-[#ebe7df] ring-[#cfc9bd]" },
  { name: "Held back", swatch: "bg-[#f4e4c6] ring-[#dcc08c]" },
  { name: "Session closed", swatch: "bg-[#f7d6d6] ring-[#e3a3a3]" },
];

export function CalendarSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil OS" label="Every session, lane and hold on one grid">
      <div className="grid h-full gap-10 xl:grid-cols-12 xl:gap-[2.4cqw]">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Calendar" title="Every session, lane and hold on one grid." lead="By day, week or month — with the capacity held back shown beside what is sold." />
          <div className="flex flex-col gap-[max(12px,1.2cqw)]">
            <ul className="flex flex-wrap gap-[max(6px,0.5cqw)]">
              {STATES.map((st) => (
                <li key={st.name}>
                  <Pill>
                    <span aria-hidden className={cn("h-[0.8em] w-[0.8em] rounded-[3px] ring-1 ring-inset", st.swatch)} />
                    {st.name}
                  </Pill>
                </li>
              ))}
            </ul>
            <p className={s.body}>Hover a block for the whole booking; filter by booking, category or lane.</p>
          </div>
        </div>
        <div className={cn(SCREENS, "xl:col-span-8")}>
          <Crop src={calendar} alt="The calendar week view with bookings, a held private event and today marked" x={0.17} y={0.23} w={0.83} h={0.77} className="w-full xl:mt-[1cqw]" />
          {/* The close-up: a session held for a private event, drawn hatched. */}
          <div className="absolute bottom-[3%] left-[-3%] w-[40%] rounded-[max(14px,1.3cqw)] bg-[#f94a00] p-[max(3px,0.25cqw)] shadow-[0_30px_60px_-24px_rgb(20_20_19/0.5)] xl:bottom-[-2%] xl:left-[-5%] xl:w-[34%]">
            <Crop src={calendar} alt="" x={0.64} y={0.535} w={0.1} h={0.085} />
          </div>
        </div>
      </div>
    </Slide>
  );
}

export function BookingsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil OS" label="Everything you sell, in one catalogue">
      <div className="grid h-full gap-[max(12px,1.4cqw)] xl:grid-cols-12 xl:grid-rows-3">
        <div className={cn(s.card, s.paperCard, "relative flex min-h-[420px] flex-col overflow-hidden xl:col-span-7 xl:row-span-3 xl:min-h-0")}>
          <Intro
            eyebrow="Bookings"
            title="Everything you sell, in one catalogue."
            lead="Admission, tours, courts and events — each with its price, its category and where it is sold."
            className="relative z-10 p-[max(18px,2.4cqw)] pb-0"
          />
          <div className={cn(s.washPanel, "absolute inset-x-0 bottom-0 h-[55%]")} />
          <div className="relative mt-auto px-[max(14px,2cqw)]">
            <Crop src={bookings} alt="The bookings catalogue with prices, channels and status" x={0.17} y={0.33} w={0.83} h={0.55} className="w-full translate-y-[6%]" />
          </div>
        </div>
        <div className={cn(s.card, "flex items-center justify-between gap-6 bg-[#141413] p-[max(16px,2cqw)] text-[#f5f2eb] xl:col-span-5")}>
          <div>
            <p className="font-mono text-[max(12px,0.85cqw)] uppercase tracking-[0.12em] text-[#ffa572]">Not sellable</p>
            <p className="mt-[max(6px,0.5cqw)] max-w-[30ch] text-[clamp(14px,1.1cqw,17px)] leading-snug text-[rgb(245_242_235/0.8)]">
              A booking missing a price, a schedule or somewhere to sell says so before a customer finds out.
            </p>
          </div>
          <span className={cn(s.numeral, s.accentInk)}>0</span>
        </div>
        {[
          { icon: Archive, title: "On, off or archived — in bulk", body: "Tick the rows, then activate, deactivate or archive. Duplicate one to start the next." },
          { icon: MonitorSmartphone, title: "Sold where you choose", body: "Counter, online or both — with seat layouts for rooms that have seats." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className={cn(s.card, s.paperCard, "flex flex-col justify-between gap-6 p-[max(16px,2cqw)] xl:col-span-5")}>
            <span className="grid h-[max(36px,2.8cqw)] w-[max(36px,2.8cqw)] shrink-0 place-items-center rounded-[0.8cqw] bg-[#fff1e8] text-[#aa3000]">
              <Icon className="h-[52%] w-[52%]" strokeWidth={1.6} aria-hidden />
            </span>
            <div>
              <h3 className={s.heading}>{title}</h3>
              <p className={cn(s.body, "mt-[max(4px,0.4cqw)]")}>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </Slide>
  );
}

export function HoldsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil OS" label="Keep places back without faking a booking">
      <div className="grid h-full gap-10 xl:grid-cols-12 xl:gap-[2.4cqw]">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Holds" title="Hold places, on the record." lead="Every hold says who it is for, who placed it, and when it goes back on sale." />
          <Ticks
            tone="paper"
            items={["A number of places, a whole session, a lane or named seats", "Released by hand, or on its own when its time is up", "A till holds its cart’s places for ten minutes"]}
          />
        </div>
        <div className={cn(SCREENS, "flex flex-col justify-center gap-[max(14px,1.6cqw)] xl:col-span-8")}>
          <Crop src={holds} alt="Holds for maintenance on lane 3, a private event and a school group" x={0.17} y={0.415} w={0.83} h={0.585} className="w-full" />
          <div className={cn(s.card, s.paperCard, "p-[max(16px,2cqw)]")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={s.heading}>Planetarium Show · 1 Aug, 11:00</h3>
              <span className={cn(s.mono, "text-[#6b675f]")}>40 places</span>
            </div>
            <div aria-hidden className="mt-[max(12px,1.2cqw)] flex h-[max(18px,1.6cqw)] overflow-hidden rounded-full ring-1 ring-inset ring-[#e2ded5]">
              <span
                className="h-full"
                style={{
                  width: `${(25 / 40) * 100}%`,
                  background: "repeating-linear-gradient(135deg, #e9c79b 0 6px, #f4e4c6 6px 12px)",
                }}
              />
              <span className="h-full flex-1 bg-[#f5f2eb]" />
            </div>
            <div className="mt-[max(10px,0.9cqw)] flex flex-wrap justify-between gap-2">
              <p className={s.body}>
                <span className="font-semibold text-[#22211f]">25 held</span> for Sunbeams School — Class 6
              </p>
              <p className={s.body}>The rest stay on sale</p>
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

export function OrdersSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil OS" label="Every sale, and the money behind it">
      <div className="grid h-full gap-10 xl:grid-cols-12 xl:gap-[2.4cqw]">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Orders" title="Every sale, and the money behind it." lead="Counter and online in one list — with what is collected and what is still owed." />
          <Ticks
            tone="paper"
            items={["Each line kept as it was sold — add-ons, discounts and VAT", "Refund a line with a reason, resend a ticket, move a date", "Internal notes a guest never sees"]}
          />
        </div>
        <div className={cn(SCREENS, "sm:min-h-[520px] xl:col-span-8 xl:min-h-0")}>
          <Crop src={orders} alt="The orders list with collected, orders, average order and outstanding" x={0.17} y={0.13} w={0.83} h={0.6} className="w-[90%]" />
          <Crop
            src={order}
            alt="Order CF-2026-999001: paid in full, with its items, add-ons, discounts and VAT"
            x={0.17}
            y={0.17}
            w={0.55}
            h={0.62}
            className="relative -mt-[14%] ml-auto w-[64%] sm:absolute sm:bottom-0 sm:right-0 sm:mt-0 sm:w-[52%] xl:bottom-[2%]"
          />
          <Callout tone="ink" label="Outstanding" value="৳47,011.37 still owed" className="absolute left-[4%] top-[52%] hidden sm:flex xl:top-[60%]" />
        </div>
      </div>
    </Slide>
  );
}

export function CustomersSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil OS" label="Know the guest in front of you">
      <div className="grid h-full gap-10 xl:grid-cols-12 xl:gap-[2.4cqw]">
        <div className={cn(SCREENS, "order-2 sm:min-h-[500px] xl:order-1 xl:col-span-8 xl:min-h-0")}>
          <Crop src={customers} alt="The customers list, ranked by spend, with marketing consent" x={0.17} y={0.15} w={0.83} h={0.6} className="ml-auto w-[90%]" />
          <Crop
            src={customer}
            alt="Sabbir Alam’s record, flagged for staff attention, with spend and orders"
            x={0.17}
            y={0.13}
            w={0.83}
            h={0.62}
            className="relative -mt-[12%] w-[80%] sm:absolute sm:left-0 sm:top-[46%] sm:mt-0 sm:w-[76%]"
          />
        </div>
        <div className="order-1 flex flex-col justify-between gap-8 xl:order-2 xl:col-span-4">
          <Intro eyebrow="Customers" title="Know the guest in front of you." lead="One record per person — what they have bought, agreed to and still owe." />
          <Ticks
            tone="paper"
            items={["Matched by phone, however the number is typed", "Email and SMS consent, kept as a record", "Flag a guest, and the till shows why", "Merge duplicates; erase personal data on request"]}
          />
        </div>
      </div>
    </Slide>
  );
}

export function ReportsSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil OS" label="Read the business by the hour">
      <Glow className="bottom-[-40%] left-[20%] h-[90%] w-[50%] opacity-70" />
      <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Reports" title="Read the business by the hour." lead="Transactions, a summary, what is outstanding and analytics — all from one ledger." />
          <div className={cn(s.card, s.inkCard, "flex items-center gap-[max(14px,1.6cqw)] p-[max(16px,1.8cqw)]")}>
            <span className={cn(s.numeral, s.accentInk)}>8</span>
            <p className={s.body}>charts: revenue against the period before, hour, weekday, payment mix, capacity, no-shows, lead time and top bookings.</p>
          </div>
          <div className="flex flex-wrap gap-[max(6px,0.6cqw)]">
            <Pill>CSV export</Pill>
            <Pill>Saved views</Pill>
            <Pill>Shareable links</Pill>
          </div>
        </div>
        <div className={cn(SCREENS, "xl:col-span-8")}>
          <div className="relative xl:absolute xl:right-[-6%] xl:top-[8%] xl:w-[102%]">
            <Laptop src={reportsDark} alt="Sales analytics with revenue over time, sales by weekday and payment mix" tilt="left" />
          </div>
        </div>
      </div>
    </Slide>
  );
}

export function EventsSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil OS" label="A page for every event">
      <Glow className="right-[10%] top-[-40%] h-[90%] w-[55%] opacity-80" />
      <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Events" title="A page for every event." lead="Six templates, one per kind of event, selling the same tickets as the counter." />
          <div className="grid grid-cols-2 gap-[max(8px,0.8cqw)]">
            {[
              { value: "6", label: "Events on sale" },
              { value: "4,867", label: "Tickets sold" },
            ].map(({ value, label }) => (
              <div key={label} className={cn(s.card, s.inkCard, "p-[max(14px,1.4cqw)]")}>
                <p className="text-[clamp(28px,2.8cqw,46px)] font-semibold leading-none tracking-[-0.04em]">{value}</p>
                <p className="mt-[max(6px,0.5cqw)] font-mono text-[max(12px,0.85cqw)] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.66)]">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-[max(6px,0.6cqw)]">
            {["Concerts", "Sports", "Conferences", "Galleries", "Tours", "Nightlife"].map((k) => (
              <Pill key={k}>{k}</Pill>
            ))}
          </div>
        </div>
        <div className={cn(SCREENS, "min-h-[300px] sm:min-h-[440px] xl:col-span-8 xl:min-h-0")}>
          <div className="xl:absolute xl:right-[10%] xl:top-[6%] xl:w-[88%]">
            <Laptop src={eventOs} alt="Chattogram Turf Cup in Counterfoil OS: 622 of 1,216 tickets sold, with a live preview of its page" tilt="left" />
          </div>
          <div className="absolute bottom-[-4%] right-[0%] w-[26%] xl:bottom-[-2%] xl:right-[-1%] xl:w-[22%]">
            <Phone src={turfPhone} alt="The Chattogram Turf Cup page on a phone" tilt="right" />
          </div>
          <Callout tone="ink" label="Chattogram Turf Cup" value={<span className="text-[#ffa572]">622 / 1,216 sold</span>} className="absolute bottom-[2%] left-[0%] hidden sm:flex" />
        </div>
      </div>
    </Slide>
  );
}

export function SettingsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} size="half" section="Counterfoil OS" label="Set up once, change it any time">
      <div className="grid h-full items-center gap-8 xl:grid-cols-12 xl:gap-[2.2cqw]">
        <Intro eyebrow="Settings" title="Set up once." lead="Every section shows what it is set to before you open it." className="xl:col-span-3" />
        <Crop src={settings} alt="Settings, with each section’s current value beside it" x={0.17} y={0.215} w={0.83} h={0.49} className="w-full xl:col-span-6" />
        <ul className="flex flex-col gap-[max(6px,0.5cqw)] xl:col-span-3">
          {[
            ["Tax", "VAT 15% · reduced 7.5%"],
            ["Payments", "bKash · cash"],
            ["Team", "9 members · 2 invited"],
            ["Sign-in", "Two-step for managers"],
            ["Notifications", "5 of 6 messages on"],
          ].map(([name, value]) => (
            <li key={name} className={cn(s.card, s.paperCard, "flex items-center justify-between gap-3 px-[max(12px,1cqw)] py-[max(8px,0.6cqw)]")}>
              <span className="text-[clamp(13px,0.95cqw,15px)] font-semibold">{name}</span>
              <span className="flex items-center gap-1.5 text-[clamp(12px,0.9cqw,14px)] text-[#57534c]">
                <Eye className="hidden h-[1em] w-[1em] sm:block" strokeWidth={1.6} aria-hidden />
                {value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Slide>
  );
}
