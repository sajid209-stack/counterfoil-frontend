"use client";

import { useRef, type ReactNode } from "react";
import { useInView } from "../_components/motion";
import styles from "./Problem.module.css";

/** Pauses every CSS loop inside it while it is off screen. */
export function ProblemLoop({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  return (
    <div ref={ref} data-run={inView ? "true" : "false"} className={`${styles.loop} ${className ?? ""}`} aria-hidden>
      {children}
    </div>
  );
}
