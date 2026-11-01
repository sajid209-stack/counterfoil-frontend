"use client";

import { useRef } from "react";
import { LOGO_MARK } from "@/components/brand/logoArt";
import { useInView, useReducedMotion } from "../_components/motion";
import css from "./Close.module.css";

/* A Counterfoil ticket on the ember ground. The mark is the real logo path. On
   scrolling into view the stub tears away along the perforation, once, and drifts
   a little. Reduced motion: already torn, still. Decorative, so aria-hidden. */

const MAIN = "M20 0H456A14 14 0 0 0 470 14V266A14 14 0 0 0 456 280H20A20 20 0 0 1 0 260V20A20 20 0 0 1 20 0Z";
const STUB = "M484 0H620A20 20 0 0 1 640 20V260A20 20 0 0 1 620 280H484A14 14 0 0 0 470 266V14A14 14 0 0 0 484 0Z";

export function CloseTicket() {
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInView(ref, { threshold: 0.6, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const torn = seen || reduce;
  const ease = reduce ? "none" : "transform 1500ms var(--w-ease)";

  return (
    <svg ref={ref} aria-hidden viewBox="-10 -30 730 350" className="block h-auto w-full max-w-[640px] overflow-visible drop-shadow-[0_30px_40px_rgb(20_20_19/0.25)]">
      <path d={MAIN} fill="#141413" />
      <g transform="translate(40 70) scale(2.6)" fill="#f94a00">
        <path d={LOGO_MARK} />
      </g>
      <text x="40" y="52" fontSize="13" letterSpacing="3" fill="#f5f2eb" opacity="0.7" fontFamily="var(--font-dm-mono), monospace">
        ADMIT ONE
      </text>
      <text x="40" y="262" fontSize="13" letterSpacing="3" fill="#f5f2eb" opacity="0.7" fontFamily="var(--font-dm-mono), monospace">
        COUNTERFOIL
      </text>
      <line x1="470" x2="470" y1="22" y2="258" stroke="#f5f2eb" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" opacity={torn ? 0 : 0.6} style={{ transition: reduce ? "none" : "opacity 500ms ease" }} />

      <g
        style={{
          transform: torn ? "translate(24px, 4px) rotate(7deg)" : "none",
          transformBox: "view-box",
          transformOrigin: "470px 280px",
          transition: ease,
        }}
      >
        <g className={torn ? css.drift : undefined}>
          <path d={STUB} fill="#f5f2eb" />
          <g fill="#141413">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
              <rect key={k} x={510 + k * 12} y="70" width={k % 3 === 0 ? 7 : 4} height="140" rx="1" />
            ))}
          </g>
          <text x="555" y="248" textAnchor="middle" fontSize="12" letterSpacing="2" fill="#141413" fontFamily="var(--font-dm-mono), monospace">
            STUB
          </text>
        </g>
      </g>
    </svg>
  );
}
