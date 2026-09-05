import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The catalogue is called Bookings now, and the breadcrumb is derived
      // from the path — so the route had to move with the word. Anything
      // already linked or bookmarked at /products still lands.
      { source: "/products", destination: "/bookings", permanent: false },
      { source: "/products/:path*", destination: "/bookings/:path*", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
