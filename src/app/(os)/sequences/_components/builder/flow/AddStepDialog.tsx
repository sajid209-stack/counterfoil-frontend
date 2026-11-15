"use client";

import { Modal } from "@/components/ui";
import { blankStep, insertStep, stepKindsFor, type Slot } from "@/lib/sequences";
import { useBuilder } from "../context";
import { StepKindList } from "./Flow";

/** "Add a step": the steps that make sense at this place in the flow. */
export function AddStepDialog({ slot, onClose }: { slot: Slot | null; onClose: () => void }) {
  const { form, tb, change, select } = useBuilder();
  return (
    <Modal open={!!slot} onClose={onClose} title={tb("flow.addTitle")} size="sm">
      {slot && (
        <StepKindList
          kinds={stepKindsFor(form.start, !!slot.parentId)}
          onPick={(k) => {
            const step = blankStep(k);
            change({ steps: insertStep(form.steps, slot, step) });
            select(step.id);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
