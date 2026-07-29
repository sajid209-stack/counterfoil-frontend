export const metadata = { title: "Point of Sale · Counterfoil Go" };

// Placeholder for the POS till (built in a later phase). Kept touch-sized so
// the shell reads correctly on a tablet.
export default function PosPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <p className="type-label text-[13px] text-ember">Front of house</p>
      <h1 className="type-h1 text-2xl">Point of Sale</h1>
      <p className="type-body text-neutral-600">
        The POS till is built in a later phase. Staff open a shift, sell at the
        counter, take payment, and issue tickets from here.
      </p>
      <button
        type="button"
        className="flex h-12 items-center justify-center rounded-sm bg-ink px-section text-sm font-medium text-paper"
      >
        Open shift
      </button>
    </main>
  );
}
