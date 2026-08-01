import type { Metadata, Viewport } from "next";
import { Manrope, DM_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaSetup } from "@/components/PwaSetup";
import "./globals.css";

// Manrope is a variable font — the full weight axis (300–800) is available
// without enumerating weights. Exposed as a CSS variable for the token layer.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

// DM Mono is a static font — weights must be declared. The guidelines use 400
// and 500 for booking refs, status codes, IDs and BT codes.
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Counterfoil",
  description:
    "Operator-owned platform for venues, tours, and attractions — timed entry, tickets, and bookings.",
  applicationName: "Counterfoil",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Counterfoil" },
};

// F10 app readiness: draw under the notch/home indicator (safe-area insets
// handle the overlap) and stop input-focus zoom — Go runs as an app, not a page.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${dmMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <PwaSetup />
      </body>
    </html>
  );
}
