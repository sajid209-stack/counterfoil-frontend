import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The catalogue is called Bookings now, and the breadcrumb is derived
      // from the path — so the route had to move with the word. Anything
      // already linked or bookmarked at /products still lands.
      { source: "/products", destination: "/catalog?kind=bookings", permanent: false },
      { source: "/products/:path*", destination: "/bookings/:path*", permanent: false },
      // Bookings and Events are one feature now, the Catalog — everything the
      // operator sells, in one list with one way to add to it. The old doors
      // stay open: every list, form and record that was linked, bookmarked or
      // remembered under its old name lands in the same place under the new
      // one. Specific paths first, so /bookings/new is not read as a record.
      { source: "/bookings", destination: "/catalog?kind=bookings", permanent: false },
      { source: "/bookings/new", destination: "/catalog/new/booking", permanent: false },
      { source: "/bookings/layouts", destination: "/catalog/layouts", permanent: false },
      { source: "/bookings/layouts/:id", destination: "/catalog/layouts/:id", permanent: false },
      { source: "/bookings/:id", destination: "/catalog/bookings/:id", permanent: false },
      { source: "/events", destination: "/catalog?kind=events", permanent: false },
      { source: "/events/new", destination: "/catalog/new/event", permanent: false },
      { source: "/events/:id", destination: "/catalog/events/:id", permanent: false },
      // The breadcrumb is built from the path, so a record's trail has a
      // "bookings" or "events" crumb — which lands on its tab of the list.
      { source: "/catalog/bookings", destination: "/catalog?kind=bookings", permanent: false },
      { source: "/catalog/events", destination: "/catalog?kind=events", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
