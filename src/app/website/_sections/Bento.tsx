import Image, { type StaticImageData } from "next/image";
import { Heading, Section, delay } from "../_components/ui";
import calendar from "../_media/ui-calendar.jpg";
import seats from "../_media/ui-seats.jpg";
import verdict from "../_media/ui-verdict.jpg";
import mix from "../_media/ui-mix.jpg";
import customer from "../_media/ui-customer.jpg";
import pay from "../_media/ui-pay.jpg";

/* Six capabilities, each a real capture at a size that can be read. Office
   captures run to the card's width and bleed off the right on a phone; till
   captures are a phone's width, centred, and run off the bottom. Shot on #f5f2eb,
   so they sit on a --cf-paper card and the corners blend. Nothing is drawn UI. */

type Card = { lead: string; rest: string; src: StaticImageData; alt: string; span: string; till?: boolean };

const CARDS: Card[] = [
  {
    lead: "Never sold twice.",
    rest: "A place sold at one counter is gone at every other.",
    src: calendar,
    alt: "The Counterfoil calendar in day view, with a lane for each court and lane, and the bookings on them.",
    span: "md:col-span-2 lg:col-span-4",
  },
  {
    lead: "Seat maps.",
    rest: "Pick the actual seat on the plan.",
    src: seats,
    alt: "A seat map in the till with seats C6, C7 and C8 selected.",
    till: true,
    span: "lg:col-span-2",
  },
  {
    lead: "One scan, the whole family.",
    rest: "A family ticket lets everyone in at once.",
    src: verdict,
    alt: "The scan result screen reading Let 4 in.",
    till: true,
    span: "lg:col-span-2",
  },
  {
    lead: "Where sales come from.",
    rest: "Each channel, side by side.",
    src: mix,
    alt: "The Where sales come from card in Analytics.",
    span: "md:col-span-2 lg:col-span-4",
  },
  {
    lead: "Customers on record.",
    rest: "What they have spent, how often they come, what they still owe.",
    src: customer,
    alt: "The top of a customer record in the office.",
    span: "lg:col-span-3",
  },
  {
    lead: "Every way to pay.",
    rest: "Cash, bKash, Bangla QR or card, on one screen.",
    src: pay,
    alt: "The payment step on the phone till: to pay 575 taka, with cash, bKash, Bangla QR and card.",
    till: true,
    span: "lg:col-span-3",
  },
];

const KINDS = [
  "open entry",
  "date passes",
  "daily capacity",
  "quick passes",
  "timed sessions",
  "seat maps",
  "courts and fields",
  "flexible duration",
  "guided tours",
  "appointments",
  "courses",
  "credit packs",
  "bundles",
  "waitlists",
];

export function Bento() {
  return (
    <Section id="features" tone="white">
      <Heading eyebrow="Everything in one system" title="What a retail till can’t do." />

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        {CARDS.map((c, i) => (
          <article
            key={c.lead}
            data-reveal
            style={delay((i % 2) * 80)}
            className={`flex h-[420px] flex-col overflow-hidden rounded-[20px] bg-[var(--cf-paper)] pt-6 md:h-[460px] md:pt-8 ${c.till ? "px-6 md:px-8" : "pl-6 md:pl-8"} ${c.span}`}
          >
            <h3 className={`cf-h3 max-w-[480px] ${c.till ? "" : "pr-6 md:pr-8"}`}>
              <span className="text-[var(--cf-fg)]">{c.lead}</span>{" "}
              <span className="text-[var(--cf-muted)]">{c.rest}</span>
            </h3>
            <div className="mt-6 min-h-0 flex-1">
              <Image
                src={c.src}
                alt={c.alt}
                placeholder="blur"
                sizes={c.till ? "300px" : "(min-width: 1264px) 800px, 640px"}
                className={c.till ? "mx-auto block h-auto w-full max-w-[300px]" : "block h-auto w-full min-w-[620px] md:min-w-0"}
              />
            </div>
          </article>
        ))}
      </div>

      <p data-reveal className="cf-lead mt-10 max-w-[860px]">
        <span className="font-medium text-[var(--cf-fg)]">Fourteen ways to sell time:</span> {KINDS.join(", ")}.
      </p>
    </Section>
  );
}
