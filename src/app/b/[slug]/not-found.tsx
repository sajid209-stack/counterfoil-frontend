import { LocalItem } from "../_components/LocalItem";

/**
 * What /b/<slug> answers, with HTTP 404, when the server has nothing a visitor may
 * book at the link: the same words for an unknown address, a draft, an archived item
 * and one not sold online, so nothing leaks about what exists but is not for sale.
 * Unless this browser made the item, in which case `LocalItem` draws it.
 */
export default function ItemNotFound() {
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <LocalItem />
    </>
  );
}
