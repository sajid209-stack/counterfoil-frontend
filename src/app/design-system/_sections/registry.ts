/**
 * The section list — the one place that knows which sections exist, in which
 * group, in what order and how finished each is.
 *
 * Server-safe on purpose (no components, no hooks): the layout's nav, the
 * overview's section grid, `generateStaticParams` and the prev/next footer all
 * read it. The section COMPONENTS live in `./index.tsx`, keyed by slug.
 */

export type SectionGroup = "Foundations" | "Components" | "Patterns & rules";

/** `placeholder` = none of the components it documents has landed yet; `partial` = some live, some still to come. */
export type SectionStatus = "done" | "partial" | "placeholder";

export interface SectionMeta {
  slug: string;
  /** 1–23, as printed in the nav and above each title. */
  number: number;
  title: string;
  group: SectionGroup;
  /** One sentence: the lead under the title and the line on the overview card. */
  summary: string;
  status: SectionStatus;
}

export const GROUPS: readonly SectionGroup[] = ["Foundations", "Components", "Patterns & rules"];

export const SECTIONS: readonly SectionMeta[] = [
  { slug: "overview", number: 1, title: "Overview", group: "Foundations", status: "done",
    summary: "What the system is for, the five principles it holds, the four configurations every screen has to work in, and a quick reference to everything below." },
  { slug: "colour", number: 2, title: "Colour", group: "Foundations", status: "done",
    summary: "The Counterfoil Color System: six tonal scales, semantic tokens in four groups, component state tokens, status and feedback, contrast measured live, and the two hierarchies." },
  { slug: "typography", number: 3, title: "Typography", group: "Foundations", status: "done",
    summary: "Fonts and how they load, one scale from 11 to 40px, the role recipes built on it, and the rule for Inter, DM Mono and Hind Siliguri." },
  { slug: "spacing", number: 4, title: "Spacing & layout", group: "Foundations", status: "done",
    summary: "A 4px grid with named steps, the card and gutter rhythm, breakpoints and the widths content stops at." },
  { slug: "radius", number: 5, title: "Radius", group: "Foundations", status: "done",
    summary: "Four primitive radii, four component radii that change with the product, and the rule for nesting corners." },
  { slug: "borders", number: 6, title: "Borders & strokes", group: "Foundations", status: "done",
    summary: "1px everywhere, three line tokens, and the two places a stroke is allowed to be 2px." },
  { slug: "elevation", number: 7, title: "Elevation", group: "Foundations", status: "done",
    summary: "Four levels. Shadows in light, surface steps and lines in dark." },
  { slug: "motion", number: 8, title: "Motion", group: "Foundations", status: "done",
    summary: "Three durations, one easing, and reduced motion that collapses all of it." },
  { slug: "iconography", number: 9, title: "Iconography", group: "Foundations", status: "done",
    summary: "Lucide at four sizes and a 1.5 stroke, always paired with a word." },
  { slug: "themes", number: 10, title: "Themes", group: "Foundations", status: "done",
    summary: "Two axes, four configurations: OS and POS, light and dark." },
  { slug: "buttons", number: 11, title: "Buttons", group: "Components", status: "done",
    summary: "Five variants, four sizes and every state, plus the icon button." },
  { slug: "states", number: 12, title: "Interaction states", group: "Components", status: "done",
    summary: "Rest, hover, focus, pressed, selected, disabled, loading and invalid for every control, and what each state changes." },
  { slug: "inputs", number: 13, title: "Inputs & forms", group: "Components", status: "done",
    summary: "Field and FormField, Select, DateField, TimeInput, DurationInput, and how validation is drawn." },
  { slug: "selection", number: 14, title: "Selection controls", group: "Components", status: "done",
    summary: "Checkbox, Radio, Switch, SegmentedControl and Chip." },
  { slug: "navigation", number: 15, title: "Navigation", group: "Components", status: "done",
    summary: "Tabs, ActionMenu, Pagination and the OS rail." },
  { slug: "cards", number: 16, title: "Cards & surfaces", group: "Components", status: "done",
    summary: "Card anatomy, the stack of surfaces, variants, nested corners, record cards (DetailCard, FactGrid, TimelineCard, the ticket stub), and OS against POS." },
  { slug: "data-display", number: 17, title: "Data display", group: "Components", status: "done",
    summary: "DataTable, StatusPill, StatStrip, Card, EmptyState, MarketBadge and Avatar." },
  { slug: "feedback", number: 18, title: "Feedback", group: "Components", status: "done",
    summary: "Toast, BlockedNotice, Notice and Skeleton." },
  { slug: "overlays", number: 19, title: "Overlays", group: "Components", status: "done",
    summary: "Modal, ConfirmDialog and Sheet, each opened from a button." },
  { slug: "os-patterns", number: 20, title: "OS patterns", group: "Patterns & rules", status: "done",
    summary: "The page shell, the toolbar, list to record, the filter bar and settings rows." },
  { slug: "go-patterns", number: 21, title: "POS patterns", group: "Patterns & rules", status: "done",
    summary: "The sell tile, the action bar pair, sheets, scan verdicts and the touch and reading floors. The till, called Counterfoil GO in code." },
  { slug: "screen-states", number: 22, title: "Screen states", group: "Patterns & rules", status: "done",
    summary: "Loading skeletons shaped like their pages, empty pages with one action, error, not found and signed out, and the page-state menu that previews all of them." },
  { slug: "accessibility", number: 23, title: "Accessibility & standards", group: "Patterns & rules", status: "done",
    summary: "WCAG 2.2 AA as a property of the components, the house exceptions, and the checks that keep it true." },
];

export const sectionBySlug = (slug: string): SectionMeta | undefined => SECTIONS.find((s) => s.slug === slug);

/** The overview lives at the route root; every other section is a child of it. */
export const sectionPath = (slug: string): string => (slug === "overview" ? "/design-system" : `/design-system/${slug}`);

export const neighbours = (slug: string): { prev?: SectionMeta; next?: SectionMeta } => {
  const i = SECTIONS.findIndex((s) => s.slug === slug);
  return { prev: i > 0 ? SECTIONS[i - 1] : undefined, next: i >= 0 && i < SECTIONS.length - 1 ? SECTIONS[i + 1] : undefined };
};
