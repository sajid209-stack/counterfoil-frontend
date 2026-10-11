import type { Metadata } from "next";
import { DsShell } from "./_components/DsShell";
import "./ds.css";

export const metadata: Metadata = {
  title: { default: "Design System · Counterfoil", template: "%s · Design System · Counterfoil" },
  description: "The tokens, components and rules behind Counterfoil OS and Counterfoil POS (the till), drawn live in light and dark.",
};

/**
 * The Design System lives at the app root, outside the OS shell — the same
 * arrangement as /deck and /pos — so its own frame (top bar, section nav,
 * "On this page") is the only chrome around it, and the sidebar's ↗ on the
 * entry that leads here tells the truth about leaving the admin app.
 */
export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return <DsShell>{children}</DsShell>;
}
