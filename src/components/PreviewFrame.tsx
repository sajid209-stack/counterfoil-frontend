"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CLONE = "data-cf-preview-clone";

/** Carry the app's stylesheets, theme and fonts into the frame's document. */
function sync(doc: Document) {
  doc.head.querySelectorAll(`[${CLONE}]`).forEach((n) => n.remove());
  document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => {
    const c = n.cloneNode(true) as Element;
    c.setAttribute(CLONE, "");
    doc.head.appendChild(c);
  });
  // Every attribute on <html>: the theme, the contrast and motion prefs, the
  // font variables and the language all live there.
  const src = document.documentElement;
  const dst = doc.documentElement;
  [...dst.attributes].forEach((a) => dst.removeAttribute(a.name));
  [...src.attributes].forEach((a) => dst.setAttribute(a.name, a.value));
  doc.body.className = document.body.className;
  doc.body.style.margin = "0";
}

/**
 * A page drawn at a real device width, inside the editor, from live React state.
 *
 * An iframe, because a preview drawn in a 600px column would answer every
 * `sm:` and `lg:` question with the EDITOR's viewport — a phone preview on a
 * desktop would lay out as a desktop. The frame has its own viewport, so the
 * page's breakpoints fire at the width being previewed.
 *
 * A portal rather than a URL, because the draft is React state and the mock
 * store is memory: a frame that loaded a route would boot a second copy of the
 * app and see neither. Portalled content keeps this tree's context — the
 * locale, the messages — and its events.
 *
 * Scaled to fit the column rather than scrolled sideways: the question a
 * preview answers is "what does it look like", which wants the whole width.
 */
export function PreviewFrame({
  width,
  height,
  title,
  children,
}: {
  /** The device width, in CSS pixels. */
  width: number;
  height: number;
  title: string;
  children: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState(0);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Styles arrive late in development and a theme switch rewrites <html>, so
     the frame follows both rather than copying once. */
  useEffect(() => {
    if (!body) return;
    const doc = body.ownerDocument;
    const mo = new MutationObserver(() => sync(doc));
    mo.observe(document.head, { childList: true });
    mo.observe(document.documentElement, { attributes: true });
    return () => mo.disconnect();
  }, [body]);

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    sync(doc);
    setBody(doc.body);
  };

  const scale = box > 0 ? Math.min(1, box / width) : 0;

  return (
    <div ref={wrap} className="relative w-full overflow-hidden" style={{ height: height * scale }}>
      <iframe
        ref={frame}
        title={title}
        srcDoc="<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>"
        onLoad={onLoad}
        // Out of the tab order: the page inside is a picture of the page, and
        // its controls are not this editor's controls.
        tabIndex={-1}
        className="absolute top-0 border-0 bg-surface"
        style={{
          width,
          height,
          left: Math.max(0, (box - width * scale) / 2),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: scale ? "visible" : "hidden",
        }}
      />
      {body && createPortal(children, body)}
    </div>
  );
}
