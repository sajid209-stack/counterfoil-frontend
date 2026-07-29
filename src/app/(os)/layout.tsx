import { Sidebar } from "./_components/Sidebar";

// OS surface shell — persistent sidebar + dense content area. Desktop.
export default function OsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
