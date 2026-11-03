"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui";
import { fileToStoredImage } from "@/lib/imageUpload";
export interface FormImage {
  id: string;
  url: string;
  alt?: string;
}

// Mock upload — no real storage. Selected files are shrunk to small JPEG data
// URLs so they survive a refresh in this browser; swapping in real storage is a
// lib/api concern later.
export function ImageUploadField({
  images,
  onChange,
}: {
  images: FormImage[];
  onChange: (images: FormImage[]) => void;
}) {
  const t = useTranslations("catalog.fields");
  const tm = useTranslations("catalog.item");
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    /* Convert all first, in the order chosen, then add once: `images` is read after the awaits. */
    const done = await Promise.all(
      files.map(async (f): Promise<FormImage | null> => {
        try {
          return { id: `img_${globalThis.crypto.randomUUID().slice(0, 8)}`, url: await fileToStoredImage(f), alt: f.name };
        } catch {
          return null;
        }
      }),
    );
    const added = done.filter((x): x is FormImage => x !== null);
    if (added.length < files.length) toast.error(tm("imageUnreadable"));
    if (added.length) onChange([...images, ...added]);
  };

  const remove = (id: string) => onChange(images.filter((img) => img.id !== id));

  return (
    <div className="flex flex-col gap-tight">
      <span className="text-sm font-medium text-muted">{t("images")}</span>
      <div className="flex flex-wrap gap-tight">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative h-24 w-24 overflow-hidden rounded-control bg-muted-wash"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={t("removeImage")}
              onClick={() => remove(img.id)}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center md:h-9 md:w-9"
            >
              <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-inverse/70 text-inverse-fg">
                <X size={14} strokeWidth={1.5} />
              </span>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center gap-inline rounded-control border border-dashed border-line text-muted hover:border-strong hover:text-fg"
        >
          <ImagePlus size={20} strokeWidth={1.5} />
          <span className="text-xs">{t("addImage")}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
