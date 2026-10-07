import { redirect } from "next/navigation";

/** There is no tickets index of its own: every issued ticket is listed, with its
 *  status, at Issued orders. A ticket's record is still /tickets/[id]. */
export default function TicketsIndex() {
  redirect("/issued-orders");
}
