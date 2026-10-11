"use client";

import { Button } from "@/components/ui";
import { useState, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { Callout, Code, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview, usePreviewVar } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

const TOKENS: TokenRow[] = [
  { name: "--duration-quick", utility: "duration-quick", note: "120ms. Hover, press." },
  { name: "--duration-standard", utility: "duration-standard", note: "200ms. Panels, fades." },
  { name: "--duration-considered", utility: "duration-considered", note: "320ms. Sheets entering." },
  { name: "--ease-counterfoil", utility: "ease-counterfoil", note: "The one easing." },
];

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function Demo() {
  const [on, setOn] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const ease = usePreviewVar("--ease-counterfoil");
  const tracks: Array<{ name: string; token: string }> = [
    { name: "quick", token: "--duration-quick" },
    { name: "standard", token: "--duration-standard" },
    { name: "considered", token: "--duration-considered" },
  ];
  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-wrap items-center gap-tight">
        <Button variant="secondary" size="sm" icon={<Play size={14} strokeWidth={1.5} aria-hidden />} onClick={() => setOn((v) => !v)}>
          {on ? "Send back" : "Play all three"}
        </Button>
        <p className="text-sm text-muted" aria-live="polite">
          Reduced motion is {reduced ? "on: the squares jump" : "off: the squares glide"}.
        </p>
      </div>
      {tracks.map((t) => (
        <div key={t.name} className="flex flex-col gap-inline">
          <p className="text-xs text-muted">
            {t.name} · <span className="font-mono">{t.token}</span>
          </p>
          <div className="relative h-8 rounded-sm bg-subtle">
            <span
              aria-hidden
              className="absolute top-0 h-8 w-8 rounded-sm bg-ember-solid"
              style={{
                left: on ? "calc(100% - 2rem)" : "0",
                transitionProperty: "left",
                transitionDuration: `var(${t.token})`,
                transitionTimingFunction: ease || "ease-out",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MotionSection() {
  return (
    <>
      <SectionHeader slug="motion" />

      <DocSection id="tokens" title="Durations and easing">
        <P>
          Three durations and one easing. <Code>quick</Code> is for the things you touch, <Code>standard</Code> for panels and fades, <Code>considered</Code> for a sheet entering — the one motion that says where a panel came from. Tailwind v4 has no duration namespace, so these utilities exist because <Code>globals.css</Code> declares them.
        </P>
        <TokenTable rows={TOKENS} sample="none" label="Motion tokens" />
      </DocSection>

      <DocSection id="demo" title="Live">
        <P>The same distance at each speed, using the real tokens and easing.</P>
        <Preview label="Duration × easing">
          <Demo />
        </Preview>
      </DocSection>

      <DocSection id="reduced" title="Reduced motion">
        <P>
          The operating-system setting, and <em>Settings → Display → Reduce motion</em>, collapse every duration to nothing. Nothing is withheld — a state change still happens — it is only not animated. That is why a verdict or a result is never <em>carried</em> by an animation: it is also shape, colour and words.
        </P>
        <Callout>Animate one or two things per view, and keep a response inside about 300ms. Past roughly 400ms a feedback animation stops reading as a response and starts reading as a wait.</Callout>
      </DocSection>
    </>
  );
}
