"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button, FormField, useToast } from "@/components/ui";
import { fileToStoredImage } from "@/lib/imageUpload";
import { cn } from "@/lib/cn";
import { externalHref, linkPlatform } from "@/lib/externalLink";
import { BrandIcon } from "@/components/productPage/page/sections/BrandIcon";
import type { ExternalLink } from "@/lib/api/events";
import { newId } from "./pageOps";

/**
 * The small pieces every section editor is built from. One rhythm: the editor
 * is a column with one gap, a list item is a group set off by a hairline (not a
 * box inside the editor's own box), and a section has at most one line of help.
 */

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** A line of read-only text with the one place it is changed. */
export function ReadOnly({ children, action, onAction }: { children: React.ReactNode; action: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col gap-tight">
      <div className="text-sm text-fg">{children}</div>
      {onAction && (
        <Button variant="secondary" size="sm" className="self-start" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} icon={<Plus size={15} strokeWidth={1.5} aria-hidden />} className="w-full">
      {children}
    </Button>
  );
}

/** The remove button of a list item, named for what it removes. */
export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="tertiary" size="icon" aria-label={label} title={label} onClick={onClick} className="shrink-0 text-muted hover:text-danger">
      <Trash2 size={15} strokeWidth={1.5} aria-hidden />
    </Button>
  );
}

/** One editable item in a list: a hairline above it, a title with its remove button, then its fields. */
export function ItemGroup({ title, removeLabel, onRemove, children }: { title: string; removeLabel: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-tight border-t border-hairline pt-comfortable first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-tight">
        <span className="min-w-0 truncate text-sm font-medium text-muted">{title}</span>
        <RemoveButton label={removeLabel} onClick={onRemove} />
      </div>
      {children}
    </div>
  );
}

/** Reads a picked image and reports failure with the same toast everywhere. */
function usePicker(maxSide: number, quality: number | undefined, onChange: (url: string) => void) {
  const tm = useTranslations("catalog.item");
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={file}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) fileToStoredImage(f, maxSide, quality).then(onChange, () => toast.error(tm("imageUnreadable")));
        e.target.value = "";
      }}
    />
  );
  return { open: () => file.current?.click(), input };
}

/**
 * A photo for one item in a list: a person on the bill (`portrait`, tall) or a
 * highlight (`tile`, wide). With photos the page draws them; without, a clean
 * text version, never a placeholder face (docs/product-page.md §3.5). Mock
 * layer: the picked file is shrunk to a JPEG data URL so it is kept with the
 * page, the same way the cover upload works.
 */
export function PortraitField({
  name,
  url,
  onChange,
  shape = "portrait",
}: {
  name: string;
  url?: string;
  onChange: (url: string | undefined) => void;
  shape?: "portrait" | "tile";
}) {
  const t = useTranslations("catalog.page");
  const pick = usePicker(shape === "tile" ? 960 : 640, undefined, onChange);
  return (
    <div className="flex items-center gap-comfortable">
      <span
        aria-hidden
        className={cn("block shrink-0 rounded-inner border border-line bg-muted-wash bg-cover bg-center", shape === "tile" ? "h-14 w-24" : "h-14 w-12")}
        style={url ? { backgroundImage: `url("${url}")` } : undefined}
      />
      <div className="flex flex-wrap gap-tight">
        <Button variant="secondary" size="sm" icon={<ImagePlus size={15} strokeWidth={1.5} aria-hidden />} onClick={pick.open} aria-label={t(url ? "portraitReplaceFor" : "portraitAddFor", { name })}>
          {url ? t("portraitReplace") : t("portraitAdd")}
        </Button>
        {url && (
          <Button variant="secondary" size="sm" onClick={() => onChange(undefined)} aria-label={t("portraitRemoveFor", { name })}>
            {t("portraitRemove")}
          </Button>
        )}
      </div>
      {pick.input}
    </div>
  );
}

/**
 * A sponsor's logo as a small square you press to add or change. Logos are kept
 * at a higher JPEG quality than photos: compression shows on flat colour and
 * thin lines.
 */
export function LogoThumb({ name, url, onChange }: { name: string; url?: string; onChange: (url: string) => void }) {
  const t = useTranslations("catalog.page");
  const pick = usePicker(640, 0.9, onChange);
  return (
    <>
      <button
        type="button"
        onClick={pick.open}
        aria-label={t(url ? "logoReplaceFor" : "logoAddFor", { name })}
        title={t(url ? "logoReplace" : "logoAdd")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-line bg-muted-wash bg-contain bg-center bg-no-repeat text-muted transition-colors duration-quick hover:border-strong"
        style={url ? { backgroundImage: `url("${url}")` } : undefined}
      >
        {!url && <ImagePlus size={16} strokeWidth={1.5} aria-hidden />}
      </button>
      {pick.input}
    </>
  );
}

/** One typed web address. It shows the service it goes to once it reads as one, and says so when it does not. */
export function LinkField({ label, help, placeholder, value, onChange }: { label: string; help?: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("catalog.page");
  const href = externalHref(value);
  return (
    <FormField
      label={label}
      help={help}
      placeholder={placeholder}
      value={value}
      inputMode="url"
      autoComplete="off"
      prefix={<BrandIcon platform={href ? linkPlatform(href) : "website"} size={16} />}
      error={value.trim() && !href ? t("linkInvalid") : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Any number of links for a person or organisation: social accounts, a website. */
export function LinkRows({ links = [], onChange }: { links?: ExternalLink[]; onChange: (links: ExternalLink[]) => void }) {
  const t = useTranslations("catalog.page");
  return (
    <div className="flex flex-col gap-tight">
      <span className="text-sm font-medium text-fg">{t("linksLabel")}</span>
      {links.map((l, i) => (
        <div key={l.id} className="flex items-start gap-tight">
          <div className="min-w-0 flex-1">
            <LinkField
              label={t("linkN", { n: i + 1 })}
              placeholder={t("linkPlaceholder")}
              value={l.url}
              onChange={(url) => onChange(links.map((x) => (x.id === l.id ? { ...x, url } : x)))}
            />
          </div>
          <Button
            variant="tertiary"
            size="icon"
            aria-label={t("removeLink", { n: i + 1 })}
            title={t("removeLink", { n: i + 1 })}
            onClick={() => onChange(links.filter((x) => x.id !== l.id))}
            className="mt-6 shrink-0 text-muted hover:text-danger"
          >
            <Trash2 size={15} strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
      ))}
      <AddButton onClick={() => onChange([...links, { id: newId("ln"), url: "" }])}>{t("addLink")}</AddButton>
    </div>
  );
}
