import { Suspense } from "react";
import { OrdersPrint } from "../_components/OrdersPrint";

/** The Orders list's Summary, on A4 — `/print/orders/summary?<the list's own filters>`. */
export default function PrintOrdersSummaryPage() {
  return (
    <Suspense>
      <OrdersPrint kind="summary" />
    </Suspense>
  );
}
