import type { Metadata } from "next";
import { Manrope, DM_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import { ThemeProvider } from "@/components/ThemeProvider";
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
      </body>
    </html>
  );
}
