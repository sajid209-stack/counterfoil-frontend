"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";

/** Class-strategy theming (light · dark · system), persisted, no flash. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeColorSync />
      {children}
    </NextThemes>
  );
}

/**
 * Keep the browser chrome on the same theme as the app.
 *
 * The root layout ships a pair of `theme-color` metas keyed to
 * `prefers-color-scheme`, which is right until someone uses the in-app toggle:
 * force light inside a dark OS and the status bar stays ink while the page
 * turns to paper. The media-query pair stays as the no-JS default; this
 * overrides it once a person has actually chosen.
 */
const THEME_COLOR = { light: "#f5f2eb", dark: "#141413" } as const;

function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    // The media-keyed pair cannot be edited in place — a light meta with a
    // dark colour would be a lie the moment the override is cleared — so the
    // override is its own unconditional tag, which wins by document order.
    let el = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-app-theme]');
    if (!el) {
      el = document.createElement("meta");
      el.name = "theme-color";
      el.dataset.appTheme = "";
      document.head.appendChild(el);
    }
    el.content = THEME_COLOR[resolvedTheme];
  }, [resolvedTheme]);
  return null;
}

/** Header mode button: one tap flips light ↔ dark. The full picker (incl.
 *  System) stays in Settings. Renders after mount to avoid hydration drift. */
export function ModeButton({ className, shape = "square" }: { className?: string; shape?: "square" | "round" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <span className={`inline-block h-11 w-11 ${className ?? ""}`} aria-hidden />;
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-11 w-11 items-center justify-center text-muted transition-colors duration-quick hover:text-fg active:bg-ember/10 ${shape === "round" ? "rounded-full bg-subtle dark:bg-line" : "rounded-sm border border-line bg-card hover:border-ember/40"} ${className ?? ""}`}
    >
      {dark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
    </button>
  );
}

/** The appearance picker — OS Settings and the Go shift menu share it. */
export function AppearancePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  /* The stored theme only exists in the browser, so the server cannot know
   * which of the three is pressed. Rendering that guess and then correcting it
   * is exactly the hydration mismatch React warns about — and the warning is
   * earned: for one frame the picker shows the wrong button selected. Nothing
   * is marked until the client has actually read the preference. */
  // "Has the client taken over?" is an external fact, not component state —
  // the same shape PageShell uses for its media query. getServerSnapshot
  // returns false, getSnapshot true, and nothing subscribes because the answer
  // never changes again after hydration.
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const current = ready ? theme : undefined;
  return (
    <div className={className}>
      <span className="type-label mb-tight block text-[12px] text-muted">Appearance</span>
      <div className="flex gap-tight">
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={current === t}
            className={`h-11 flex-1 rounded-sm border text-sm capitalize transition-colors duration-quick ${current === t ? "border-ember bg-ember/5 font-medium" : "border-line bg-card"}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
