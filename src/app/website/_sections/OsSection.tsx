import { Browser } from "../_components/media";
import { Heading, Section } from "../_components/ui";
import { FeatureSwitcher, SwitcherClip, type FeatureItem } from "./FeatureSwitcher";

function screen(name: string, label: string) {
  return (
    <Browser className="w-full">
      <SwitcherClip name={name} label={label} />
    </Browser>
  );
}

const ITEMS: FeatureItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    body: "Sales, capacity and what needs attention, updating as the tills sell.",
    seconds: 10,
    media: screen("os-dashboard", "The Counterfoil OS dashboard"),
  },
  {
    id: "calendar",
    title: "Calendar",
    body: "The week, then the day by lane, and a booking opened from it.",
    seconds: 8.6,
    media: screen("os-calendar", "The Counterfoil OS calendar, week and day views with a booking"),
  },
  {
    id: "customers",
    title: "Customers",
    body: "Search your people and open a record with its history.",
    seconds: 10.6,
    media: screen("os-customers", "The Counterfoil OS customers list, searched, with a customer record"),
  },
  {
    id: "catalog",
    title: "Catalog",
    body: "Set a show’s schedule and prices once, and every counter sells it.",
    seconds: 12.4,
    media: screen("os-catalog", "The Counterfoil OS catalog showing the Planetarium Show schedule and prices"),
  },
  {
    id: "analytics",
    title: "Analytics",
    body: "Charts of sales over time and where they come from.",
    seconds: 9.9,
    media: screen("os-analytics", "The Counterfoil OS analytics charts and where sales come from"),
  },
];

export function OsSection() {
  return (
    <Section id="os" tone="paper">
      <Heading eyebrow="Counterfoil OS" title="The whole venue on one screen." lead="Bookings, people and money, live as the tills sell." />
      <div className="mt-12">
        <FeatureSwitcher items={ITEMS} layout="top" label="Counterfoil OS features" panelClassName="!bg-transparent" />
      </div>
    </Section>
  );
}
