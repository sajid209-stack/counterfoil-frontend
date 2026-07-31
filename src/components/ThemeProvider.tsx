"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";

/** Class-strategy theming (light · dark · system), persisted, no flash. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

/** The appearance picker — OS Settings and the Go shift menu share it. */
export function AppearancePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={className}>
      <span className="type-label mb-tight block text-[12px] text-muted">Appearance</span>
      <div className="flex gap-tight">
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            className={`h-11 flex-1 rounded-sm border text-sm capitalize transition-colors duration-quick ${theme === t ? "border-ember bg-ember/5 font-medium" : "border-line bg-card"}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
