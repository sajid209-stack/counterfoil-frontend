/**
 * The event catalogue: six categories, their subtypes, and the visual theme
 * each one publishes in.
 *
 * The important structural idea is that a template is NOT a bespoke page per
 * category. Every template renders the same ordered list of sections from the
 * same content model; a theme supplies a palette, two typefaces, a layout
 * variant and its own words for those sections. That is what makes six
 * templates a system rather than six one-offs — a section added here appears in
 * all six, styled correctly, without touching six files.
 *
 * Theme colours are LITERAL, never design-system tokens. A published event page
 * has its own fixed look; it must not follow the operator's dashboard theme, so
 * an operator toggling dark mode in OS cannot repaint a customer's event page.
 */

export type CategoryId =
  | "entertainment"
  | "sports"
  | "business"
  | "arts"
  | "travel"
  | "nightlife";

/** The sections every template can draw, in their canonical order. */
export type SectionId =
  | "hero"
  | "countdown"
  | "about"
  | "lineup"
  | "schedule"
  | "gallery"
  | "tickets"
  | "venue"
  | "faq";

export const ALL_SECTIONS: SectionId[] = [
  "hero",
  "countdown",
  "about",
  "lineup",
  "schedule",
  "gallery",
  "tickets",
  "venue",
  "faq",
];

/** Hero and tickets cannot be switched off: one names the event, the other is
 *  the reason the page exists. Everything else is the operator's call. */
export const REQUIRED_SECTIONS: SectionId[] = ["hero", "tickets"];

export interface EventTheme {
  /** Page ground and the ink on it. */
  bg: string;
  fg: string;
  /** A step off the ground for cards and panels. */
  panel: string;
  /** Hairlines and dividers. */
  line: string;
  /** Secondary ink — always checked against `bg`, never guessed. */
  muted: string;
  accent: string;
  /** Ink that sits ON the accent. */
  onAccent: string;
  /** Display face variable, body face variable. */
  display: string;
  body: string;
  /** Corner radius for the template's own cards. */
  radius: string;
  /** Uppercase, tracked-out eyebrows suit posters and clubs, not galleries. */
  eyebrowCase: "upper" | "normal";
  /** Some themes want the display face tightened hard. */
  displayTracking: string;
  /** Neon themes glow; editorial ones must not. */
  glow: boolean;
}

export interface CategoryDef {
  id: CategoryId;
  /** i18n key suffix under the `events` namespace. */
  key: string;
  subtypes: string[];
  /** Section order and default visibility for this category. */
  sections: SectionId[];
  /** What this theme calls the people/things section. */
  lineupKey: string;
  theme: EventTheme;
  /** Layout variants an operator can switch between, first is the default. */
  variants: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "entertainment",
    key: "entertainment",
    subtypes: ["concert", "music", "movie", "drama", "standup", "party", "festival", "reunion", "popculture"],
    sections: ["hero", "countdown", "lineup", "about", "gallery", "tickets", "venue", "faq"],
    lineupKey: "lineup",
    variants: ["poster", "stacked"],
    theme: {
      bg: "#0E0B14",
      fg: "#FFFFFF",
      panel: "#171226",
      line: "#2B2340",
      muted: "#B9AEDA",
      accent: "#FF3D71",
      onAccent: "#12040A",
      display: "var(--font-bebas)",
      body: "var(--font-inter)",
      radius: "14px",
      eyebrowCase: "upper",
      displayTracking: "0.02em",
      glow: false,
    },
  },
  {
    id: "sports",
    key: "sports",
    subtypes: ["match", "tournament", "race", "recreational", "workshop", "class"],
    sections: ["hero", "countdown", "schedule", "about", "tickets", "venue", "faq"],
    lineupKey: "fixtures",
    variants: ["kinetic", "stacked"],
    theme: {
      bg: "#F4F4F5",
      fg: "#0A0A0A",
      panel: "#FFFFFF",
      line: "#D7D7DA",
      muted: "#54545C",
      accent: "#D5001F",
      onAccent: "#FFFFFF",
      display: "var(--font-space-grotesk)",
      body: "var(--font-inter)",
      radius: "4px",
      eyebrowCase: "upper",
      displayTracking: "-0.03em",
      glow: false,
    },
  },
  {
    id: "business",
    key: "business",
    subtypes: ["conference", "seminar", "launch", "corporate", "networking", "training"],
    sections: ["hero", "about", "lineup", "schedule", "tickets", "venue", "faq"],
    lineupKey: "speakers",
    variants: ["structured", "stacked"],
    theme: {
      bg: "#FFFFFF",
      fg: "#0F172A",
      panel: "#F6F8FC",
      line: "#DFE5F0",
      muted: "#4A5568",
      accent: "#1D4ED8",
      onAccent: "#FFFFFF",
      display: "var(--font-inter)",
      body: "var(--font-inter)",
      radius: "8px",
      eyebrowCase: "upper",
      displayTracking: "-0.02em",
      glow: false,
    },
  },
  {
    id: "arts",
    key: "arts",
    subtypes: ["exhibition", "fashion", "cultural", "installation", "screening", "literary"],
    sections: ["hero", "about", "lineup", "gallery", "tickets", "venue", "faq"],
    lineupKey: "works",
    variants: ["editorial", "stacked"],
    theme: {
      bg: "#F7F6F2",
      fg: "#141414",
      panel: "#FFFFFF",
      line: "#DEDCD4",
      muted: "#57564F",
      accent: "#2E4A3F",
      onAccent: "#F7F6F2",
      display: "var(--font-playfair)",
      body: "var(--font-inter)",
      radius: "0px",
      eyebrowCase: "normal",
      displayTracking: "-0.01em",
      glow: false,
    },
  },
  {
    id: "travel",
    key: "travel",
    subtypes: ["tour", "trip", "excursion", "sightseeing", "cruise", "package"],
    sections: ["hero", "about", "schedule", "gallery", "tickets", "venue", "faq"],
    lineupKey: "itinerary",
    variants: ["immersive", "stacked"],
    theme: {
      bg: "#101815",
      fg: "#F1EEE7",
      panel: "#18231F",
      line: "#2A3833",
      muted: "#A9BAB1",
      accent: "#D08C3E",
      onAccent: "#14100A",
      display: "var(--font-outfit)",
      body: "var(--font-outfit)",
      radius: "18px",
      eyebrowCase: "upper",
      displayTracking: "-0.02em",
      glow: false,
    },
  },
  {
    id: "nightlife",
    key: "nightlife",
    subtypes: ["club", "rave", "private", "djnight", "themed", "afterparty"],
    sections: ["hero", "countdown", "lineup", "about", "tickets", "venue", "faq"],
    lineupKey: "djs",
    variants: ["neon", "stacked"],
    theme: {
      bg: "#08070C",
      fg: "#EFEAFA",
      panel: "#120F1C",
      line: "#282040",
      muted: "#A79BC9",
      accent: "#B026FF",
      onAccent: "#FFFFFF",
      display: "var(--font-syne)",
      body: "var(--font-dm-mono)",
      radius: "2px",
      eyebrowCase: "upper",
      displayTracking: "-0.02em",
      glow: true,
    },
  },
];

export const categoryById = (id: CategoryId): CategoryDef =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

/** The typeface choices offered in the customiser, as CSS variable names.
 *  Every one is loaded by `lib/events/fonts`, so a pick can never fall back
 *  silently to a system face. */
export const FONT_CHOICES = [
  { id: "bebas", key: "bebas", css: "var(--font-bebas)" },
  { id: "syne", key: "syne", css: "var(--font-syne)" },
  { id: "space", key: "space", css: "var(--font-space-grotesk)" },
  { id: "playfair", key: "playfair", css: "var(--font-playfair)" },
  { id: "outfit", key: "outfit", css: "var(--font-outfit)" },
  { id: "inter", key: "inter", css: "var(--font-inter)" },
  { id: "mono", key: "mono", css: "var(--font-dm-mono)" },
] as const;

/** Accent swatches per theme — the theme's own accent first, then five that
 *  are known to sit on that ground. Offering a colour wheel invites an operator
 *  to pick something unreadable on their own page. */
export const ACCENT_CHOICES: Record<CategoryId, string[]> = {
  entertainment: ["#FF3D71", "#FFB000", "#00E5B0", "#7C5CFF", "#FF6B35", "#22D3EE"],
  sports: ["#D5001F", "#0B5FFF", "#00875A", "#FF6A00", "#111111", "#7A00CC"],
  business: ["#1D4ED8", "#0F766E", "#4338CA", "#B45309", "#0F172A", "#9333EA"],
  arts: ["#2E4A3F", "#7A2E2E", "#3C3A6B", "#8A6A1F", "#1A1A1A", "#4A5D2E"],
  travel: ["#D08C3E", "#2FA98C", "#3E7CD0", "#C4553D", "#8FA31E", "#E0B341"],
  nightlife: ["#B026FF", "#00F0FF", "#FF2D95", "#39FF6A", "#FFC400", "#FF4D00"],
};
