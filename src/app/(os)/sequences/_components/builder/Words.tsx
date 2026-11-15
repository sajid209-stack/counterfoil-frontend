import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { splitWords, type DetailKey } from "@/lib/sequences";

/** Words with their details drawn as small chips, never as {braces}. */
export function Words({ body, clamp = false, className }: { body: string; clamp?: boolean; className?: string }) {
  const ts = useTranslations("sequences");
  return (
    <p className={cn("whitespace-pre-wrap break-words text-sm text-fg-secondary", clamp && "line-clamp-2", className)}>
      {splitWords(body).map((p, i) =>
        p.detail ? (
          <span key={i} className="mx-inline inline-block rounded-full border border-line bg-subtle px-tight text-xs text-fg">
            {ts(`detail.${p.detail as DetailKey}`)}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
