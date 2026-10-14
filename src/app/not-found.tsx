import { NotFoundScreen } from "@/components/screens/RouteScreens";

/** A URL that matches nothing. Next serves it as a 404 with the root layout
 *  around it, so the theme, language and fonts are already right. */
export default function NotFound() {
  return <NotFoundScreen />;
}
