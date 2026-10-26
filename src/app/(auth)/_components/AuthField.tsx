"use client";

import { useId, useState } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { controlClass, controlShellClass } from "@/components/ui";

/* One labelled field for the whole auth family. Same chrome as the kit's
   FormField (it reuses its control recipes), but the label reads as a label
   (fg, 13px), the refusal is written at 13px with a mark beside it, and a
   password gets a show/hide button and an optional link on the label row. */
export function AuthField({
  label,
  labelAside,
  error,
  help,
  below,
  type = "text",
  className,
  ...input
}: {
  label: string;
  /** Sits at the right end of the label row ("Forgot password?"). */
  labelAside?: React.ReactNode;
  error?: string;
  help?: string;
  /** Extra content under the control (a strength meter). */
  below?: React.ReactNode;
  type?: "text" | "email" | "password";
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  const id = useId();
  const t = useTranslations("auth.field");
  const [shown, setShown] = useState(false);
  const isPw = type === "password";
  const msgId = `${id}-msg`;
  const described = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || help ? msgId : undefined,
  } as const;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-section">
        <label htmlFor={id} className="text-sm font-medium text-fg">{label}</label>
        {labelAside}
      </div>
      <div className="relative isolate">
      {isPw ? (
        <div data-focus-host="" className={cn(controlShellClass(!!error, true), "peer h-10 items-center max-sm:h-11 [@media(pointer:coarse)]:h-11")}>
          <input
            id={id}
            {...input}
            {...described}
            type={shown ? "text" : "password"}
            className="h-full min-w-0 flex-1 bg-transparent pl-comfortable text-base text-fg placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? t("hide") : t("show")}
            aria-pressed={shown}
            className="flex h-10 w-10 shrink-0 max-sm:h-11 [@media(pointer:coarse)]:h-11 max-sm:w-11 [@media(pointer:coarse)]:w-11 items-center justify-center rounded-sm text-muted hover:text-fg"
          >
            {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
      ) : (
        <input id={id} {...input} {...described} type={type} className={cn(controlClass(!!error), "peer h-10 max-sm:h-11 [@media(pointer:coarse)]:h-11")} />
      )}
      {!error && <span aria-hidden className="pointer-events-none absolute -inset-1 -z-10 rounded-md bg-ember-wash max-sm:inset-x-0 opacity-0 transition-opacity duration-standard ease-counterfoil peer-focus-within:opacity-100" />}
      </div>
      {below}
      {error ? (
        <p id={msgId} className="flex items-start gap-inline text-sm text-danger">
          <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p id={msgId} className="text-sm text-muted">{help}</p>
      ) : null}
    </div>
  );
}
