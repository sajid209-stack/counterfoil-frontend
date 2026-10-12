import { cn } from "@/lib/cn";

/**
 * Empty state — a quiet centred stack: a soft disc with the glyph, a title, one
 * line of reason, and the way out. No dashed stub, no frame: the card or table
 * it sits in is already the frame, and a second outline inside it is the kind
 * of stroke the calm pass removes.
 *
 * Title is `text-md font-semibold`, the reason `text-base` muted. `action` is a
 * slot for the one way forward (a Button). There is no built-in English: the
 * caller supplies every string, already translated.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-tight px-card py-major text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-inline grid h-12 w-12 place-items-center rounded-full bg-subtle text-muted ring-1 ring-inset ring-line">
          {icon}
        </div>
      )}
      <p className="text-md font-semibold text-fg">{title}</p>
      {message && <p className="type-body max-w-sm text-base text-muted">{message}</p>}
      {action && <div className="mt-tight">{action}</div>}
    </div>
  );
}
