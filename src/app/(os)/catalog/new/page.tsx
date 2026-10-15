import { NewItemPage } from "../_components/wizard/NewItemPage";

/**
 * `/catalog/new`: "Add booking" opens the wizard directly. There is no chooser
 * page and no preset cards (docs/catalog.md §10.3): everything the Catalog sells
 * is a booking, and how people book it is the first question inside it.
 * Addresses from before this (`/catalog/new/<kind>`, `/catalog/new/booking`,
 * `/catalog/new/event`) redirect here from next.config.ts.
 */
export default function NewCatalogItemPage() {
  return <NewItemPage />;
}
