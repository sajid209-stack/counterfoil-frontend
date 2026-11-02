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
    <ul ref={ref} data-live={live ? "" : undefined} className={cn("cf-cells grid-cols-2 content-start md:grid-cols-3", className)}>
      {WAYS.map((w) => (
        <li key={w.id} className={cn(s.cell, "flex min-w-0 flex-col gap-3 p-4 md:p-5")}>
          <div className="flex items-center justify-between gap-3">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-ember-wash text-brand-foreground">
              <w.icon size={16} strokeWidth={1.7} />
            </span>
            <TypesMicro way={w} />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-fg">{w.name}</p>
            <p className="mt-1 text-[13px] leading-snug text-muted">{w.example}</p>
          </div>
        </li>
      ))}
      <li aria-hidden style={{ background: "var(--color-brand-50)" }} className="hidden items-end p-5 md:col-span-2 md:flex">
        <span className="text-[13px] font-medium text-brand-foreground">One capacity engine behind all fourteen</span>
      </li>
    </ul>
  );
}
