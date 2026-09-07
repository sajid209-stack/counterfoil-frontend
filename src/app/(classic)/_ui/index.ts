/* The classic till's local primitives.
 *
 * Everything else still comes from `@/components/ui` - only Button and
 * ChoiceCard were changed in ways the classic design should not inherit
 * (the ember CTA went ink -> white, and the card radius moved). Re-exporting
 * the rest here keeps the copied pages' import lines unchanged. */
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";
export { Avatar, ChoiceCard } from "./ChoiceCard";
export {
  Card, LogoMark, Logo, StatusPill, statusTone, Field, FormField, PageShell,
  EmptyState, Modal, ConfirmDialog, ToastProvider, useToast, Tabs, DataTable,
  DurationInput, PercentInput, parsePercent, DiscountInput, parseDiscount,
  TimeInput, BlockedNotice, ResourceTimeline, ProductThumb, Qr, TicketCard,
  AreaChart, BarChart, DonutChart, HBarChart, LineChart,
} from "@/components/ui";
export type {
  PillTone, FieldVariant, SelectOption, TabItem, Column, DataTableProps,
  DiscountMode, TimelineSpan, TicketCardData, ChartPoint,
} from "@/components/ui";
