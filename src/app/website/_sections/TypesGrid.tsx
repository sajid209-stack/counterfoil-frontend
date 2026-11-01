"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { useInView } from "../_components/motion";
import { WAYS } from "./TypesData";
import { TypesMicro } from "./TypesMicro";
import s from "./Types.module.css";

/** The fourteen kinds as a hairline grid; each carries a quiet loop while in view. */
export function TypesGrid({ className }: { className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const live = useInView(ref, { once: false, threshold: 0.1, margin: "0px" });
  return (
    <ul ref={ref} data-live={live ? "" : undefined} className={cn("cf-cells grid-cols-2 md:grid-cols-3", className)}>
      {WAYS.map((w) => (
        <li key={w.id} className={cn(s.cell, "flex min-w-0 flex-col gap-3 p-4 md:p-5")}>
          <div className="flex items-center justify-between gap-3">
            <w.icon aria-hidden size={16} strokeWidth={1.7} className="shrink-0 text-[var(--cf-muted)]" />
            <TypesMicro way={w} />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em]">{w.name}</p>
            <p className="mt-1 text-[13px] leading-snug text-[var(--cf-muted)]">{w.example}</p>
          </div>
        </li>
      ))}
      <li aria-hidden className="cf-dots hidden items-end p-5 md:col-span-2 md:flex">
        <span className="cf-label text-[12px]">One capacity engine behind all fourteen</span>
      </li>
    </ul>
  );
}
