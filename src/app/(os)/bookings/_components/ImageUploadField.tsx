"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

export interface FormImage {
  id: string;
  url: string;
  alt?: string;
}

// Mock upload — no real storage. Selected files become in-session object URLs
// so previews work; swapping in real storage is a lib/api concern later.
export function ImageUploadField({
  images,
  onChange,
}: {
  images: FormImage[];
  onChange: (images: FormImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added: FormImage[] = Array.from(files).map((f) => ({
      id: `img_${globalThis.crypto.randomUUID().slice(0, 8)}`,
      url: URL.createObjectURL(f),
      alt: f.name,
    }));
    onChange([...images, ...added]);
  };

  const remove = (id: string) => onChange(images.filter((img) => img.id !== id));

  return (
    <div className="flex flex-col gap-tight">
      <span className="type-label text-[12px] text-muted">Images</span>
      <div className="flex flex-wrap gap-tight">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative h-24 w-24 overflow-hidden rounded-sm border border-line bg-subtle"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => remove(img.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-inverse/70 text-inverse-fg"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center gap-inline rounded-sm border border-dashed border-line text-faint hover:border-inverse hover:text-fg"
        >
          <ImagePlus size={20} strokeWidth={1.5} />
          <span className="text-[12px]">Add</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
