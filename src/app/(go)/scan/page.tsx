"use client";

import { useMediaQuery } from "@/lib/useMedia";
import { RAIL_QUERY } from "../_components/shell/rail";
import { CheckInPageRoot } from "../checkin/_components/CheckInScreen";
import { ScanPanel } from "./_components/ScanPanel";

/* /scan stays a route (a deep link, the phone tab bar). On a desktop it is the
   one combined Check in screen, with the scan panel in focus; below that it is
   the phone scan screen, exactly as before. */
export default function ScanPage() {
  const rail = useMediaQuery(RAIL_QUERY);
  return rail ? <CheckInPageRoot /> : <ScanPanel variant="page" />;
}
