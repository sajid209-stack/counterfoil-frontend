"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A device preview that fits its column without lying about its own width.
 *
 * There are two ways to make a 1180px page fit a 900px panel and only one of
 * them is honest. **Narrowing the frame** to 900 is a lie: the template then
 * lays out at 900, reports 900 to its own breakpoints, and hides exactly the
 * wrapping and overflow bugs a preview exists to catch. **Scaling** it is not:
 * `transform: scale()` is a paint-time operation, so the DOM inside is still
 * genuinely 1180 wide and every media query still resolves as it will in
 * production. Only the pixels get smaller.
 *
 * So the inner frame keeps its declared width and the wrapper measures itself
 * and scales to fit — never above 1, because blowing a 390px phone frame up to
 * fill a desktop column would be its own kind of lie.
 */
export function PreviewFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  const measure = useCallback(() => {
    const avail = outer.current?.clientWidth ?? width;
    const k = Math.min(1, avail / width);
    setScale(k);
    setHeight((inner.current?.offsetHeight ?? 0) * k);
  }, [width]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height: height || undefined }}>
      <div
        ref={inner}
        style={{
          width,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
