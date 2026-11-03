import { SaveFailedToast } from "./_components/SaveFailedToast";

// Catalog: tells the operator when this browser could not keep a change.
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SaveFailedToast />
      {children}
    </>
  );
}
