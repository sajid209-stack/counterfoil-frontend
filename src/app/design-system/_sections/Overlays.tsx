"use client";

import { Button, ConfirmDialog, Modal, Sheet } from "@/components/ui";
import { useState } from "react";
import { Callout, Code, ComponentDoc, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";

function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const launch = (s: "sm" | "md" | "lg") => {
    setSize(s);
    setOpen(true);
  };
  return (
    <>
      <div className="flex flex-wrap gap-tight">
        {(["sm", "md", "lg"] as const).map((s) => (
          <Button key={s} variant="secondary" onClick={() => launch(s)}>
            Open {s}
          </Button>
        ))}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size={size}
        title="Take a balance"
        description="Collect what is still owed on this order."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Take ৳1,537.50</Button>
          </>
        }
      >
        <p className="text-base">Tab stays inside the dialog, Escape closes it, and focus returns to the button you opened it from.</p>
      </Modal>
    </>
  );
}

function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-tight">
        <Button variant="destructive" onClick={() => { setDone(false); setOpen(true); }}>
          Archive booking
        </Button>
        {done && <span className="text-sm text-muted">Archived (pretend).</span>}
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => { setOpen(false); setDone(true); }}
        title="Archive Winter Exhibition Pass?"
        message="It comes off sale. Past orders keep their record."
        confirmLabel="Archive"
      />
    </>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-tight">
        <Button variant="secondary" onClick={() => { setSide(false); setOpen(true); }}>
          Bottom sheet
        </Button>
        <Button variant="secondary" onClick={() => { setSide(true); setOpen(true); }}>
          Side drawer
        </Button>
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filters"
        closeLabel="Close filters"
        side={side}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
              Clear
            </Button>
            <Button fullWidth onClick={() => setOpen(false)}>
              Show 24 results
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-section p-card text-base">
          <p>Four ways out: the close button, the backdrop, Escape, and dragging the handle down.</p>
          <p className="text-sm text-muted">From md up, side turns it into a drawer on the right so the list stays visible beside it.</p>
        </div>
      </Sheet>
    </>
  );
}

export function OverlaysSection() {
  return (
    <>
      <SectionHeader slug="overlays" />

      <ComponentDoc
        id="modal"
        title="Modal"
        summary="A dialog for one decision. rounded-sheet, level 3, with a focus trap, Escape and a backdrop close; focus returns to the opener."
        demo={
          <Preview label="Three sizes">
            <ModalDemo />
          </Preview>
        }
        importCode={'import { Modal } from "@/components/ui";'}
        props={[
          { prop: "open, onClose", type: "boolean, () => void", description: "Controlled." },
          { prop: "title, description", type: "string", description: "The heading and a sentence under it." },
          { prop: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "Width." },
          { prop: "footer", type: "ReactNode", description: "The buttons: dismissal on the left, the action on the right." },
          { prop: "closeLabel", type: "string", description: "The × button's accessible name. Defaults to the translated “Close”." },
        ]}
        dos={["Ask one thing.", "Put Cancel beside the action, with the action last."]}
        donts={["Stack a dialog on a dialog.", "Use a modal for something a Notice can say."]}
      />

      <ComponentDoc
        id="confirm"
        title="ConfirmDialog"
        summary="A Modal for an irreversible action. Cancel takes the opening focus, never the destructive button: a dialog that opens with Delete under the space bar deletes things by accident. Say what survives."
        demo={
          <Preview label="A destructive confirmation">
            <ConfirmDemo />
          </Preview>
        }
        importCode={'import { ConfirmDialog } from "@/components/ui";'}
        props={[
          { prop: "open, onClose, onConfirm", type: "boolean, () => void, () => void", description: "Controlled." },
          { prop: "title, message", type: "string", description: "The question; what it costs and what survives." },
          { prop: "confirmLabel, cancelLabel", type: "string", default: '"Confirm", “Cancel”', description: "A verb for the action: Archive, Delete." },
          { prop: "destructive, loading", type: "boolean", default: "true, false", description: "Red button; busy state." },
        ]}
        dos={["Name the thing in the title.", "Offer Undo instead when the action is reversible."]}
        donts={["Confirm everything — confirmations people click through protect nobody.", "Use “OK”."]}
      />

      <ComponentDoc
        id="sheet"
        title="Sheet"
        summary="A panel that rises from the bottom of a phone. It offers four ways out — the close button, the backdrop, Escape, and a downward drag on its handle."
        demo={
          <Preview label="Bottom sheet and side drawer">
            <SheetDemo />
          </Preview>
        }
        importCode={'import { Sheet } from "@/components/ui";'}
        props={[
          { prop: "open, onClose", type: "boolean, () => void", description: "Controlled." },
          { prop: "title, closeLabel", type: "string", description: "Both required: the heading and the close button's accessible name." },
          { prop: "side", type: "boolean", default: "false", description: "From md up, a 30rem drawer on the right." },
          { prop: "footer, lead", type: "ReactNode", description: "A pinned footer; a row above the title." },
        ]}
        dos={["Use for a choice made over a list on a phone.", "Keep the primary action pinned in the footer."]}
        donts={["Use a sheet for a desktop popover.", "Remove the handle — it is what says the sheet can be dragged."]}
      />

      <Callout title="Where overlays land">
        <Code>Modal</Code> and <Code>Sheet</Code> draw inside the preview here, so they take its mode and product. <Code>Select</Code> and <Code>Toast</Code> portal to the page, and so follow your site theme.
      </Callout>
    </>
  );
}
