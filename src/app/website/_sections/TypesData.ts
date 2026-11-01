import {
  CalendarDays,
  CalendarRange,
  Clapperboard,
  Compass,
  DoorOpen,
  Gauge,
  GraduationCap,
  Hourglass,
  Layers,
  LandPlot,
  Sparkles,
  Ticket,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/** The primitives the micro-animations draw. */
export type MicroKind = "slots" | "stretch" | "seats" | "credits" | "dots" | "steps";

export type Way = {
  id: string;
  name: string;
  icon: LucideIcon;
  /** A seed-true example, from the product's own demo businesses. */
  example: string;
  /** The same kind, in a sentence a guest would say. */
  plain: string;
  micro: MicroKind;
  n?: number;
};

/** The fourteen, in the deck's order (a way in / a time or a place / more than one visit). */
export const WAYS: Way[] = [
  { id: "open", name: "Open entry", icon: DoorOpen, example: "General Admission", plain: "Walk in, any time you are open.", micro: "dots", n: 4 },
  { id: "date", name: "Date passes", icon: CalendarRange, example: "Winter Exhibition Pass", plain: "A day, a week or a season.", micro: "steps", n: 7 },
  { id: "daily", name: "Daily capacity", icon: Gauge, example: "Sculpture Garden, 200 a day", plain: "A cap per day, any time of it.", micro: "stretch" },
  { id: "quick", name: "Quick passes", icon: Ticket, example: "Parking Pass, by the plate", plain: "Issued in seconds against an identifier.", micro: "stretch" },
  { id: "timed", name: "Timed sessions", icon: Timer, example: "Planetarium Show, every 45 min", plain: "Set start times with seats on each.", micro: "slots" },
  { id: "seats", name: "Seat maps", icon: Clapperboard, example: "Evening Film, Stalls & Balcony", plain: "The seat, chosen on a plan.", micro: "seats" },
  { id: "courts", name: "Courts & fields", icon: LandPlot, example: "Football, Fields 1 and 2", plain: "An hour on a court, field or room.", micro: "slots" },
  { id: "flex", name: "Flexible duration", icon: Hourglass, example: "Bowling Lane, from 1 hr", plain: "A lane or table, for as long as they like.", micro: "stretch" },
  { id: "guided", name: "Guided tours", icon: Compass, example: "Heritage Walking Tour, 10:00 and 14:00", plain: "A group, when a guide is free.", micro: "dots", n: 4 },
  { id: "appt", name: "Appointments", icon: UserRound, example: "Deep Tissue Massage, Karim or Nadia", plain: "A person and a time.", micro: "slots" },
  { id: "course", name: "Courses", icon: GraduationCap, example: "Beginner Swim Course, 8 sessions", plain: "One sign-up, many dates.", micro: "steps", n: 8 },
  { id: "credits", name: "Credit packs", icon: Sparkles, example: "10-Class Yoga Pack", plain: "Buy now, spend over time.", micro: "credits" },
  { id: "bundle", name: "Bundles", icon: Layers, example: "Day Pass Bundle, 3 attractions", plain: "Several things, one ticket.", micro: "steps", n: 3 },
  { id: "wait", name: "Waitlists", icon: CalendarDays, example: "Yoga, when a place frees up", plain: "A queue that fills a place when one opens.", micro: "dots", n: 5 },
];

export const wayById = (id: string) => WAYS.find((w) => w.id === id)!;

/* The wizard's own plain questions (BookingSetup), simplified to its main branches. */
export type Q1 = "none" | "date" | "time" | "space" | "person" | "course" | "bundle" | "credits";

export const Q1_OPTIONS: { value: Q1; label: string }[] = [
  { value: "none", label: "No date needed" },
  { value: "date", label: "They pick a date" },
  { value: "time", label: "A date and a time" },
  { value: "space", label: "They rent a space" },
  { value: "person", label: "They book a person" },
  { value: "course", label: "A course, many dates" },
  { value: "bundle", label: "A combo ticket" },
  { value: "credits", label: "A pack of visits" },
];

/** The follow-up question each first answer leads to, if any. */
export const Q2: Partial<Record<Q1, { title: string; options: [string, string] }>> = {
  date: { title: "Is there a limit per day?", options: ["No limit per day", "Limited tickets per day"] },
  time: { title: "Does a guide lead each group?", options: ["No, a set time", "Yes, a guide leads"] },
  space: { title: "How do people book time?", options: ["Set time slots", "They choose how long"] },
};

export const Q3 = { title: "Only one group at a time on each?", options: ["Yes, one at a time", "No, groups can share"] as [string, string] };

/** Derive the kind from the answers, as the wizard does: never a code, always a plain name. */
export function derive(q1: Q1, a2: 0 | 1, a3: 0 | 1): { way: Way; note: string } {
  switch (q1) {
    case "none":
      return { way: wayById("open"), note: "No date to pick. The ticket works any day you are open." };
    case "date":
      return a2 === 0
        ? { way: wayById("date"), note: "A day, with no limit. Sell as many as you like for each day." }
        : { way: wayById("daily"), note: "When a day is full, it stops selling." };
    case "time":
      return a2 === 0
        ? { way: wayById("timed"), note: "Guests choose a time. Every session counts its own seats." }
        : { way: wayById("guided"), note: "Spaces depend on which guide leads the group." };
    case "space":
      if (a2 === 1) return { way: wayById("flex"), note: "A start time and a length, priced for the time they take." };
      return {
        way: wayById("courts"),
        note: a3 === 0 ? "Set start times. Nobody else can book it at the same time." : "Set start times. Several groups can book it at once.",
      };
    case "person":
      return { way: wayById("appt"), note: "Guests book a person for a time, or take whoever is free first." };
    case "course":
      return { way: wayById("course"), note: "One sign-up that covers every date." };
    case "bundle":
      return { way: wayById("bundle"), note: "Several of your bookings, sold as one ticket." };
    default:
      return { way: wayById("credits"), note: "Buy now, book later. Each visit spends a credit." };
  }
}
