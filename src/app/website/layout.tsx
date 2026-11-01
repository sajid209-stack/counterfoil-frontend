import type { Metadata, Viewport } from "next";
import "./website.css";

export const metadata: Metadata = {
  title: { absolute: "Counterfoil — runs the places that sell time" },
  description:
    "Tickets, sessions, courts and tours — sold at the counter, checked at the gate and reconciled by close. Counterfoil OS runs the business; Counterfoil Go sells and admits.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

/**
 * The Counterfoil website lives at the app root, outside the OS shell — the
 * same arrangement as /deck and /design-system — so the sidebar's ↗ on the
 * entry that leads here tells the truth about leaving the admin app.
 */
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
