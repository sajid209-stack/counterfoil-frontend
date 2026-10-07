import { Suspense } from "react";
import { OrdersPrint } from "../_components/OrdersPrint";

/** Every order the Orders list's filters match, with the summary above — `/print/orders/list?<the list's own filters>`. */
export default function PrintOrdersListPage() {
  return (
    <Suspense>
      <OrdersPrint kind="list" />
    </Suspense>
  );
}
