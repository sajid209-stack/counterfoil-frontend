/**
 * Empty state — a quiet centred stack: a soft disc with the glyph, a title, one
 * line of reason, and the way out. No dashed stub, no frame: the card or table
 * it sits in is already the frame, and a second outline inside it is the kind
 * of stroke the calm pass removes. The perforated ticket-stub outline this used
 * to draw was the brand's empty page; the brand now lives in the mark and the
 * ember action, and the page it is drawn on stays calm.
 */
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
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-tight px-card py-major text-center">
      {icon && (
        <div className="mb-inline grid h-12 w-12 place-items-center rounded-full bg-subtle text-muted dark:bg-fg/10">
          {icon}
        </div>
      )}
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      {message && <p className="type-body max-w-sm text-[0.8125rem] text-muted">{message}</p>}
      {action && <div className="mt-tight">{action}</div>}
    </div>
  );
}
