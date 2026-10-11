"use client";

import { BlockedNotice, Button, Notice, Skeleton, SkeletonText, useToast } from "@/components/ui";
import { useState } from "react";
import { Callout, Code, ComponentDoc, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";

function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-col gap-tight">
      <div className="flex flex-wrap gap-tight">
        <Button variant="secondary" onClick={() => toast.success("Booking put on sale")}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => toast.error("Couldn’t save. Check your connection and try again.")}>
          Error
        </Button>
        <Button variant="secondary" onClick={() => toast.info("2 bookings moved to Friday")}>
          Info
        </Button>
        <Button variant="secondary" onClick={() => toast.success("Booking archived", { label: "Undo", run: () => toast.info("Restored") })}>
          With Undo
        </Button>
      </div>
      <p className="text-xs text-muted">Toasts are drawn by the app at the page edge, so they take the site&rsquo;s theme, not the preview&rsquo;s.</p>
    </div>
  );
}

function BlockedDemo() {
  const [shown, setShown] = useState(true);
  const [released, setReleased] = useState(false);
  return (
    <div className="flex max-w-md flex-col gap-tight">
      {shown ? (
        <BlockedNotice
          message="This session is closed for sales — Private event."
          action={{ label: released ? "Released" : "Release and sell", onPress: () => setReleased(true) }}
          onDismiss={() => setShown(false)}
        />
      ) : (
        <Button variant="secondary" size="sm" onClick={() => { setShown(true); setReleased(false); }}>
          Show it again
        </Button>
      )}
    </div>
  );
}

function NoticeDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-tight">
      <Notice tone="info" title="Heads up">Prices include 15% VAT.</Notice>
      <Notice tone="success" title="Saved">Your changes are live.</Notice>
      <Notice tone="warning" title="Part paid" action={{ label: "Take payment", onClick: () => {} }}>
        ৳1,537.50 is still owed on this order.
      </Notice>
      <Notice tone="danger" title="Couldn’t connect" action={{ label: "Try again", onClick: () => {}, variant: "button" }}>
        Check the tablet&rsquo;s connection.
      </Notice>
      <Notice tone="neutral" size="sm">A small, quiet note.</Notice>
      {open && (
        <Notice tone="info" onDismiss={() => setOpen(false)}>
          This one can be dismissed.
        </Notice>
      )}
    </div>
  );
}

function SkeletonDemo() {
  return (
    <div className="card-surface flex flex-col gap-section p-card" aria-busy="true">
      <div className="flex items-center gap-comfortable">
        <Skeleton w={40} h={40} className="rounded-full" />
        <div className="flex flex-1 flex-col gap-tight">
          <Skeleton h={14} w="45%" />
          <Skeleton h={12} w="25%" />
        </div>
      </div>
      <SkeletonText lines={3} />
      <div className="flex gap-tight">
        <Skeleton h={44} w="30%" />
        <Skeleton h={44} w="30%" />
      </div>
    </div>
  );
}

export function FeedbackSection() {
  return (
    <>
      <SectionHeader slug="feedback" />

      <ComponentDoc
        id="toast"
        title="Toast"
        summary="Transient confirmation of something that already happened. Errors are role=alert (announced assertively); everything else role=status. An action such as Undo keeps it up a little longer."
        demo={
          <Preview label="Press to raise one">
            <ToastDemo />
          </Preview>
        }
        importCode={'import { useToast } from "@/components/ui";'}
        props={[
          { prop: "toast.success / error / info", type: "(message, action?) => void", description: "Raise a toast. Needs ToastProvider, which the root layout supplies." },
          { prop: "action", type: "{ label?, run }", description: "Usually Undo (the label defaults to the translated “Undo”). The toast stays longer, and while it is hovered or focused." },
        ]}
        dos={["Confirm what happened, in a sentence.", "Offer Undo instead of a confirmation dialog for a reversible action.", "Say what to do next in an error."]}
        donts={["Use a toast for something the person must act on — that is a Notice.", "Stack several for one action.", "Cover the primary action: on a phone they appear at the top."]}
      />

      <ComponentDoc
        id="notice"
        title="Notice"
        summary="An inline message about the thing on the page. Not a toast (those are transient and global) and not a banner pinned to the app. The tone shows in the tint and the icon; the text is always full ink. Danger is announced assertively."
        demo={
          <Preview label="Tones, with an action, small, dismissible">
            <NoticeDemo />
          </Preview>
        }
        importCode={'import { Notice } from "@/components/ui";'}
        props={[
          { prop: "tone", type: '"info" | "success" | "warning" | "danger" | "neutral"', default: '"info"', description: "Tint and icon." },
          { prop: "title, children", type: "ReactNode", description: "A bold line and the message." },
          { prop: "action", type: "{ label, onClick | href, variant?, busy? }", description: "A quiet link action, or variant=button for a bordered 44px button." },
          { prop: "onDismiss, dismissLabel", type: "() => void, string", description: "Adds a × (44px)." },
          { prop: "icon, size", type: "ReactNode | null, “sm” | “md”", description: "null removes the icon; sm is denser." },
        ]}
        dos={["Place it next to what it is about.", "Say what to do, and offer the action beside it."]}
        donts={["Use a notice for a confirmation that will be gone in four seconds.", "Use danger for something that is only a warning."]}
      />

      <ComponentDoc
        id="blocked-notice"
        title="BlockedNotice"
        summary="The till's refusal pattern: every blocked interaction names the reason and the way forward. A notice with an action waits to be dealt with; one that only states a fact dismisses itself after three seconds."
        demo={
          <Preview product="go" label="The till's refusal">
            <BlockedDemo />
          </Preview>
        }
        importCode={'import { BlockedNotice } from "@/components/ui";'}
        props={[
          { prop: "message", type: "string", description: "The reason, in plain words." },
          { prop: "action", type: "{ label, onPress, busy? }", description: "The way past the refusal, when there is one." },
          { prop: "onDismiss", type: "() => void", description: "Called on the ×, and after three seconds if there is no action." },
        ]}
        dos={["Name the reason and what to do about it.", "Offer the way past in the notice itself."]}
        donts={["Send a cashier to another screen to fix a refusal mid-queue.", "Refuse with a bare “not allowed”."]}
      />

      <ComponentDoc
        id="skeleton"
        title="Skeleton"
        summary="A placeholder block for content on its way: subtle fill, pulsing, hidden from assistive tech — say that the region is loading once, on the region. The global reduced-motion rule stills the pulse."
        demo={
          <Preview label="A card while it loads">
            <SkeletonDemo />
          </Preview>
        }
        importCode={'import { Skeleton, SkeletonText } from "@/components/ui";'}
        props={[
          { prop: "w, h", type: "string | number", description: "Any CSS length: 96, “60%”, “2rem”." },
          { prop: "className, style", type: "string, CSSProperties", description: "Shape it, e.g. rounded-full for an avatar." },
          { prop: "SkeletonText lines", type: "number", default: "3", description: "A paragraph of lines; the last is shorter." },
        ]}
        dos={["Match the shape and rough size of the real content so nothing jumps.", "Mark the loading region aria-busy."]}
        donts={["Use a spinner for a whole page.", "Show the word “Loading…”; the skeleton is the loading state."]}
      />

      <Callout title="Which one">
        Toast confirms something that has happened. <Code>Notice</Code> says something about the page and stays. <Code>BlockedNotice</Code> refuses at the till. A <Code>Skeleton</Code> stands in for content that has not arrived.
      </Callout>
    </>
  );
}
