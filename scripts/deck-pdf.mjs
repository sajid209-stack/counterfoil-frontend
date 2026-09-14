/*
 * Builds public/counterfoil-deck.pdf from the deck page itself.
 *
 *   npm run dev            # or any running copy of the app
 *   npm run deck:pdf       # BASE=http://localhost:3000 by default
 *
 * Each page of the PDF is a screenshot of one slide's 1600 × 900 canvas,
 * taken in Chromium at twice its size — the same engine that draws the deck on
 * screen. A vector PDF would keep text selectable, but PDF has no way to draw
 * the deck's blurs, masks and 3D device angles, and the brief is that the PDF
 * and the website are the same deck. So the pages are pictures, sized as
 * standard 16 : 9 slides (13.333 × 7.5 in).
 *
 * CHROME_PATH points at a Chromium binary when Playwright's own is not
 * installed (`npx playwright install chromium`).
 */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "public/counterfoil-deck.pdf";
const DPR = Number(process.env.DPR || 2);
const QUALITY = Number(process.env.QUALITY || 88);

/** Width and height of a baseline or progressive JPEG, from its frame header. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("Not a JPEG this script can read");
}

/** A minimal PDF: one page per JPEG, each drawn edge to edge. */
function buildPdf(images, { title, pageWidth = 960, pageHeight = 540 }) {
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (part) => {
    const buf = typeof part === "string" ? Buffer.from(part, "latin1") : part;
    chunks.push(buf);
    length += buf.length;
  };
  const object = (num, parts) => {
    offsets[num] = length;
    push(`${num} 0 obj\n`);
    for (const part of [].concat(parts)) push(part);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, i) => `${4 + i * 3} 0 R`).join(" ")}] >>`);
  object(3, `<< /Title (${title}) /Producer (Counterfoil) >>`);
  images.forEach((jpeg, i) => {
    const { width, height } = jpegSize(jpeg);
    const draw = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im${i} Do Q`;
    object(4 + i * 3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${i} ${6 + i * 3} 0 R >> >> /Contents ${5 + i * 3} 0 R >>`);
    object(5 + i * 3, [`<< /Length ${draw.length} >>\nstream\n`, draw, "\nendstream"]);
    object(6 + i * 3, [
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      jpeg,
      "\nendstream",
    ]);
  });

  const xref = length;
  push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let n = 1; n < offsets.length; n += 1) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const pdf = Buffer.concat(chunks);
  // Every cross-reference entry has to land on its object, or readers repair the file.
  for (let n = 1; n < offsets.length; n += 1) {
    if (pdf.toString("latin1", offsets[n], offsets[n] + String(n).length + 6) !== `${n} 0 obj`) throw new Error(`xref for object ${n} is wrong`);
  }
  return pdf;
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
// Wide enough that the column is exactly 1600px, so every slide is drawn at scale 1.
const context = await browser.newContext({ viewport: { width: 1780, height: 1100 }, deviceScaleFactor: DPR, reducedMotion: "reduce" });
const page = await context.newPage();
await page.goto(`${BASE}/deck`, { waitUntil: "networkidle", timeout: 120000 });
await page.addStyleTag({ content: "[data-deck-header]{display:none!important} nextjs-portal{display:none!important}" });
await page.evaluate(() => document.fonts.ready);

const scale = await page.evaluate(() => getComputedStyle(document.getElementById("deck-column")).getPropertyValue("--deck-scale").trim());
if (Math.abs(Number(scale) - 1) > 0.001) throw new Error(`slides are drawn at scale ${scale}, not 1 — widen the viewport`);

const slides = page.locator("main section[aria-label]");
const count = await slides.count();
const images = [];
for (let i = 0; i < count; i += 1) {
  const slide = slides.nth(i);
  await slide.scrollIntoViewIfNeeded();
  // next/image loads lazily; wait until every picture on this slide has decoded.
  await page.waitForFunction(
    (index) => {
      const section = document.querySelectorAll("main section[aria-label]")[index];
      return [...section.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth > 0);
    },
    i,
    { timeout: 30000 },
  );
  await page.waitForTimeout(250);
  images.push(await slide.screenshot({ type: "jpeg", quality: QUALITY }));
  process.stdout.write(`slide ${i + 1}/${count}\n`);
}
await browser.close();

const pdf = buildPdf(images, { title: "Counterfoil Deck" });
writeFileSync(OUT, pdf);
console.log(`wrote ${OUT}: ${count} pages, ${(pdf.length / 1024 / 1024).toFixed(1)} MB`);
