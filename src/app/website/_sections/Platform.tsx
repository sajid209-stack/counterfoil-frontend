import { Heading, Section } from "../_components/ui";
import { PlatformTabs } from "./PlatformTabs";

/**
 * The centrepiece: one day at the venue, in five numbered tabs that advance on
 * their own. Set up what you sell, sell it, admit the guest, count the drawer,
 * know the customer. Each panel's right half is a live product demo.
 */
export function Platform() {
  return (
    <Section id="platform">
      <Heading label="Platform" title={<>One day at the <span className="cf-accent">venue.</span></>} dim="From setup to the last count."
        lead="Set up what you sell, sell it at the counter, admit it at the gate and close the day square — the same system all the way through." />
      <div data-reveal className="mt-12 md:mt-16">
        <PlatformTabs />
      </div>
    </Section>
  );
}
