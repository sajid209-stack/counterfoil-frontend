import { NotFoundScreen } from "@/components/screens/RouteScreens";

/** A record that does not exist (a `notFound()` from a page under the admin).
 *  Rendered inside the frame, so the rail and bar stay where they are. */
export default function OsNotFound() {
  return <NotFoundScreen framed />;
}
