import { OsShell } from "./_components/OsShell";

// OS surface shell — persistent sidebar on desktop, hamburger sheet on mobile.
export default function OsLayout({ children }: { children: React.ReactNode }) {
  return <OsShell>{children}</OsShell>;
}
