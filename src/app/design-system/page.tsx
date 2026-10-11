import type { Metadata } from "next";
import { SectionPage } from "./_components/SectionPage";
import { OverviewSection } from "./_sections/Overview";

export const metadata: Metadata = { title: "Overview" };

export default function DesignSystemOverview() {
  return (
    <SectionPage slug="overview">
      <OverviewSection />
    </SectionPage>
  );
}
