import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono, Hind_Siliguri } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ToastProvider } from "@/components/ui";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaSetup } from "@/components/PwaSetup";
import "./globals.css";

// Inter is a variable font — the full weight axis is available without
// enumerating weights. Exposed as a CSS variable for the token layer.
//
// The type spec names Inter for every UI role, so it replaces Manrope as the
// sans face. Its tabular figures are switched on globally in globals.css:
// half this product is money and counts in columns, and Inter's proportional
// figures would let those columns dance as the digits change.
const inter = Inter({
  variable: "--font-inter",
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

// Bangla UI face. Latin glyphs stay on Inter via the --font-sans stack;
// Bengali codepoints fall through to Hind Siliguri per-glyph (no lang switch).
const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["latin", "bengali"],
  weight: ["300", "400", "500", "600", "700"],
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
    { media: "(prefers-color-scheme: light)", color: "#f5f2eb" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${dmMono.variable} ${hindSiliguri.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ToastProvider>{children}</ToastProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
        <PwaSetup />
      </body>
    </html>
  );
}
