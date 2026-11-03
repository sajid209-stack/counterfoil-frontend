import { OsShell } from "./_components/OsShell";

// Today is on these screens, so they are drawn when asked for: a page saved at build
// time would carry the build's date and disagree with the browser the day after.
export const dynamic = "force-dynamic";

// OS surface shell — persistent sidebar on desktop, hamburger sheet on mobile.
export default function OsLayout({ children }: { children: React.ReactNode }) {
  return <OsShell>{children}</OsShell>;
}
