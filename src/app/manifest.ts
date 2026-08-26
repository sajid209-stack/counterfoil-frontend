import type { MetadataRoute } from "next";

// F10 — installable on a venue tablet with no store involved.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Counterfoil",
    short_name: "Counterfoil",
    description:
      "Operator-owned platform for venues, tours, and attractions — timed entry, tickets, and bookings.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f2eb",
    theme_color: "#141413",
    icons: [
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
