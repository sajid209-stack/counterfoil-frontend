"use client";

import { CheckInPageRoot } from "../checkin/_components/CheckInScreen";

/* /scan stays a route (a deep link). It is the one Check in screen: on a
   desktop the scan panel beside the arrivals, on a phone the Scan half of the
   Scan | Arrivals switch. */
export default function ScanPage() {
  return <CheckInPageRoot forceMode="scan" />;
}
