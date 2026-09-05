/** Empty state as a perforated ticket-stub outline — the brand's empty page. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="flex flex-col items-center justify-center gap-tight rounded-md border border-dashed border-line px-section pb-tight pt-hero text-center">
        {icon && <div className="text-muted">{icon}</div>}
        <p className="type-h2 text-base">{title}</p>
        {message && (
          <p className="type-body max-w-sm text-[13px] text-muted">{message}</p>
        )}
      </div>
      {/* perforation — the stub tears here */}
      <div className="relative flex items-center" aria-hidden>
        <span className="absolute -left-2 h-4 w-4 rounded-full bg-surface" />
        <span className="absolute -right-2 h-4 w-4 rounded-full bg-surface" />
        <span className="mx-major flex-1 border-t-2 border-dashed border-line" />
      </div>
      <div className="flex items-center justify-center rounded-md border border-dashed border-line px-section py-section">
        {action ?? <span className="font-mono text-[12px] uppercase tracking-wider text-muted">Nothing here yet</span>}
      </div>
    </div>
  );
}
