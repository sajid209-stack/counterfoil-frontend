/* Turns a chosen photo into something that can be kept. An object URL dies with
   the tab; a small JPEG data URL can be saved in the browser and shown again
   after a refresh. Shrunk because localStorage holds only about 5 MB. */

const decode = async (file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to an <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** A JPEG data URL, its longest side at most `maxSide` (never enlarged), at JPEG
 *  `quality` (0 to 1; logos pass a higher one because compression shows on flat
 *  colour and thin lines). Rejects if the file is not a readable image. */
export async function fileToStoredImage(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new Error("Empty image");
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.fillStyle = "#ffffff"; // ds-exception: JPEG has no transparency, so a canvas is flattened on white
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    img.close();
  }
}
