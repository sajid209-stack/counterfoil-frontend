import {
  AlarmClock,
  Banknote,
  BellRing,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Clock,
  Coins,
  DoorOpen,
  History,
  Mail,
  MessageSquareText,
  PackageMinus,
  RotateCcw,
  Send,
  Split,
  StickyNote,
  TicketCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { RunStatus, RunStepStatus, SequenceState, StartKind, StepKind } from "@/lib/sequences";
import type { PillTone } from "@/components/ui";

/**
 * The picture for every start and every step, in one place, so the list, the
 * ideas, the builder and the outbox never draw the same thing two ways.
 *
 * Colour is used the way the design system says: a wash behind a glyph names
 * the KIND of thing, never its state. Words to a customer are blue (info),
 * words to the team are amber (warning), a decision is the brand colour, and
 * everything that only passes time or files something away is neutral.
 */
export const START_ICON: Record<StartKind, LucideIcon> = {
  booked: CalendarPlus,
  beforeVisit: AlarmClock,
  afterVisit: CalendarCheck,
  cancelled: CalendarX,
  noShow: UserX,
  balanceOwed: Banknote,
  placeOpens: DoorOpen,
  notBack: History,
  refundAsked: RotateCcw,
  stockLow: PackageMinus,
  cashShort: Coins,
};

export const STEP_ICON: Record<StepKind, LucideIcon> = {
  wait: Clock,
  text: MessageSquareText,
  email: Mail,
  team: BellRing,
  note: StickyNote,
  offer: TicketCheck,
  app: Send,
  branch: Split,
};

type Tone = "info" | "warning" | "ember" | "success" | "neutral";

export const STEP_TONE: Record<StepKind, Tone> = {
  wait: "neutral",
  text: "info",
  email: "info",
  team: "warning",
  note: "neutral",
  offer: "success",
  app: "neutral",
  branch: "ember",
};

const TONE_CLASS: Record<Tone, string> = {
  info: "bg-info-wash text-info",
  warning: "bg-warning-wash text-warning",
  ember: "bg-ember-wash text-brand-foreground",
  success: "bg-success-wash text-success",
  neutral: "bg-subtle text-fg-secondary border border-line",
};

/** The square glyph tile that leads a start or a step. `sm` 28px, `md` 36px. */
export function KindTile({ icon: Icon, tone = "neutral", size = "md", className }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md"; className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-control", size === "sm" ? "size-7" : "size-9", TONE_CLASS[tone], className)}>
      <Icon size={size === "sm" ? 14 : 18} strokeWidth={1.75} />
    </span>
  );
}

export const StartTile = ({ kind, size, className }: { kind: StartKind; size?: "sm" | "md"; className?: string }) => <KindTile icon={START_ICON[kind]} tone="ember" size={size} className={className} />;

export const StepTile = ({ kind, size, className }: { kind: StepKind; size?: "sm" | "md"; className?: string }) => <KindTile icon={STEP_ICON[kind]} tone={STEP_TONE[kind]} size={size} className={className} />;

/** Pill tones for the three states a sequence can be in, and for runs. On is
 *  the normal state and stays quiet green; only "needs a look" raises its voice. */
export const STATE_TONE: Record<SequenceState, PillTone> = { on: "success", off: "neutral", unfinished: "warning" };
export const RUN_TONE: Record<RunStatus, PillTone> = { working: "info", done: "success", stopped: "neutral", problem: "danger" };
export const RUN_STEP_TONE: Record<RunStepStatus, PillTone> = { done: "success", waiting: "info", next: "neutral", skipped: "neutral", failed: "danger" };
