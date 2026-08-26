// Type-safe translation keys: `useTranslations("ns")` / `t()` autocomplete
// against the English catalog (source of truth); unknown keys are type errors.
// One entry per namespace file under src/messages/en/.
type Messages = {
  common: typeof import("./messages/en/common.json");
  nav: typeof import("./messages/en/nav.json");
  enums: typeof import("./messages/en/enums.json");
  errors: typeof import("./messages/en/errors.json");
  auth: typeof import("./messages/en/auth.json");
  dashboard: typeof import("./messages/en/dashboard.json");
  calendar: typeof import("./messages/en/calendar.json");
  customers: typeof import("./messages/en/customers.json");
  orders: typeof import("./messages/en/orders.json");
  reports: typeof import("./messages/en/reports.json");
  products: typeof import("./messages/en/products.json");
  resources: typeof import("./messages/en/resources.json");
  settings: typeof import("./messages/en/settings.json");
  profile: typeof import("./messages/en/profile.json");
  pos: typeof import("./messages/en/pos.json");
  scan: typeof import("./messages/en/scan.json");
  checkin: typeof import("./messages/en/checkin.json");
  shift: typeof import("./messages/en/shift.json");
  quickpass: typeof import("./messages/en/quickpass.json");
  schedule: typeof import("./messages/en/schedule.json");
  moneysetup: typeof import("./messages/en/moneysetup.json");
  seatmaps: typeof import("./messages/en/seatmaps.json");
  promotions: typeof import("./messages/en/promotions.json");
  ticket: typeof import("./messages/en/ticket.json");
  pricing: typeof import("./messages/en/pricing.json");
  bookingRules: typeof import("./messages/en/bookingRules.json");
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}

export {};
