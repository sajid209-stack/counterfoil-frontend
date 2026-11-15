"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { controlClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { splitWords, type DetailKey } from "@/lib/sequences";

/**
 * Words with details in them, edited the way they are read: a detail is a chip
 * sitting in the sentence, never `{braces}` the owner has to type correctly.
 *
 * The stored value is still plain text with `{detail}` tokens (the contract in
 * lib/sequences), so this is only a view of it: an editable box whose chips are
 * not editable. The box is rebuilt from the value only when the two disagree
 * (Undo, Discard, another step selected) — never while typing, so the caret
 * stays where the owner put it.
 */
export interface WordsEditorHandle {
  /** Put a detail where the caret is (or at the end), and keep typing after it. */
  insert: (key: DetailKey) => void;
}

const CHIP = "mx-inline inline-block select-none rounded-full border border-line bg-subtle px-tight align-baseline text-xs text-fg";
/** Kept after a chip so the caret has somewhere to stand; never stored. */
const ZW = "​";

function read(node: Node): string {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? "";
    else if (n instanceof HTMLElement) {
      if (n.dataset.detail) out += `{${n.dataset.detail}}`;
      else if (n.tagName === "BR") out += "\n";
      else out += (out && !out.endsWith("\n") ? "\n" : "") + read(n);
    }
  });
  return out;
}
const clean = (s: string) => s.split(ZW).join("");

export const WordsEditor = forwardRef<
  WordsEditorHandle,
  {
    id?: string;
    value: string;
    onChange: (next: string) => void;
    /** The chip's words for a detail. */
    label: (key: DetailKey) => string;
    /** One line (a subject) or several (a message). */
    multiline?: boolean;
    tall?: boolean;
    invalid?: boolean;
    placeholder?: string;
    onFocus?: () => void;
    "aria-label"?: string;
    "aria-labelledby"?: string;
  }
>(function WordsEditor({ id, value, onChange, label, multiline = true, tall = false, invalid, placeholder, onFocus, ...aria }, ref) {
  const box = useRef<HTMLDivElement>(null);

  const chip = (key: DetailKey) => {
    const el = document.createElement("span");
    el.contentEditable = "false";
    el.dataset.detail = key;
    el.className = CHIP;
    el.textContent = label(key);
    return el;
  };

  // Rebuild the box when the value is not what it shows.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || clean(read(el)) === value) return;
    el.replaceChildren(...splitWords(value).map((p) => (p.detail ? chip(p.detail) : document.createTextNode(p.text))));
    // `label` changes identity every render; the words are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = () => {
    const el = box.current;
    if (el) onChange(clean(read(el)));
  };

  const putAtCaret = (node: Node, spaced = false) => {
    const el = box.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    let range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !el.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    if (spaced) {
      // What is written before the caret: a chip after "here:" or after another chip needs a space.
      const before = document.createRange();
      before.selectNodeContents(el);
      before.setEnd(range.startContainer, range.startOffset);
      const lead = clean(read(before.cloneContents()));
      if (lead && !/\s$/.test(lead)) {
        const gap = document.createTextNode(" ");
        range.insertNode(gap);
        range.setStartAfter(gap);
        range.collapse(true);
      }
    }
    range.insertNode(node);
    // A caret straight after a chip has nothing to stand on at the end of the box.
    const after = node.nodeType === Node.TEXT_NODE ? node : node.parentNode!.insertBefore(document.createTextNode(ZW), node.nextSibling);
    const next = document.createRange();
    next.setStart(after, after.textContent?.length ?? 0);
    next.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(next);
    emit();
  };

  useImperativeHandle(ref, () => ({ insert: (key) => putAtCaret(chip(key), true) }));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (multiline) putAtCaret(document.createTextNode("\n"));
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text) putAtCaret(document.createTextNode(multiline ? text : text.replace(/\s+/g, " ")));
  };

  return (
    <div
      id={id}
      ref={box}
      role="textbox"
      aria-multiline={multiline}
      aria-invalid={invalid || undefined}
      data-placeholder={placeholder}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onInput={emit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={onFocus}
      className={cn(
        controlClass(invalid, multiline),
        "h-auto cursor-text whitespace-pre-wrap break-words leading-relaxed empty:before:text-muted empty:before:content-[attr(data-placeholder)]",
        multiline ? (tall ? "min-h-48" : "min-h-28") : "min-h-11 md:min-h-9",
      )}
      {...aria}
    />
  );
});
