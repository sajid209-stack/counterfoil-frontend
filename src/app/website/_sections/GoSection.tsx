import { Phone } from "../_components/media";
import { Heading, Section } from "../_components/ui";
import { FeatureSwitcher, SwitcherClip, type FeatureItem } from "./FeatureSwitcher";

function phone(name: string, label: string) {
  return (
    <Phone className="w-[min(280px,100%)]">
      <SwitcherClip name={name} label={label} />
    </Phone>
  );
}

const ITEMS: FeatureItem[] = [
  {
    id: "sell",
    title: "Sell in seconds",
    body: "Pick the tour, set the party, take bKash. The sale is done and the ticket is issued.",
    seconds: 13.7,
    media: phone("go-sell", "Counterfoil Go selling two adult tickets to a heritage walking tour and taking bKash"),
  },
  {
    id: "slot",
    title: "Book a court",
    body: "Pick the field and the hour, repeat it weekly. Every date is checked before it sells.",
    seconds: 10.4,
    media: phone("go-slot", "Counterfoil Go booking an indoor futsal field for 2 PM, repeating weekly for four weeks"),
  },
  {
    id: "seats",
    title: "Pick the seats",
    body: "Choose seats on the map and sell them straight from the till.",
    seconds: 6.8,
    media: phone("go-seats", "Counterfoil Go choosing seats C6, C7 and C8 for an evening film"),
  },
  {
    id: "scan",
    title: "Scan the whole family in",
    body: "One scan of a family ticket lets all four in, and the gate counts every head.",
    seconds: 5,
    media: phone("go-scan", "Counterfoil Go reading Let 4 in for one family ticket, then admitting everyone"),
  },
  {
    id: "checkin",
    title: "Check in at the desk",
    body: "The day’s roster, with each party ticked in as it arrives.",
    seconds: 6.5,
    media: phone("go-checkin", "Counterfoil Go roster checking in a party of ten"),
  },
  {
    id: "bangla",
    title: "In Bangla or English",
    body: "The whole till switches language, for whoever is behind the counter.",
    seconds: 6,
    media: phone("go-bangla", "Counterfoil Go with the till in Bangla"),
  },
];

export function GoSection() {
  return (
    <Section id="go">
      <FeatureSwitcher
        items={ITEMS}
        label="Counterfoil Go features"
        panelClassName="p-5 lg:py-10"
        mediaShare={0.52}
        intro={<Heading eyebrow="Counterfoil Go" title="The till in your hand." lead="A tablet at the counter, a phone at the gate." />}
      />
    </Section>
  );
}
