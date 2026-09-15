export type JacketCaptureView = "front" | "back" | "left" | "right";

export interface JacketReferencePdfInput {
  designName: string;
  generatedAt: Date;
  edition: string;
  bodyMaterial: string;
  leatherType: string;
  backName: string;
  backNumber: string;
  stars: number;
  leftSleeveNumbers: string[];
  rightSleeveNumbers: string[];
  materials: Array<{ label: string; value: string; color: string }>;
  captures: Record<JacketCaptureView, string>;
  interiorImages: {
    neckLabel: string;
    oneOfOnePatch: string;
    crest: string;
  };
}

export interface PdfJpegPage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const INK = "#111111";
const GOLD = "#c9a84c";
const PAPER = "#f3f0ea";
const WHITE = "#ffffff";
const MUTED = "#77746f";

function asciiBytes(value: string) {
  return new TextEncoder().encode(value);
}

function concatenateBytes(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function assemblePdfFromJpegs(pages: PdfJpegPage[]) {
  if (!pages.length) throw new Error("At least one PDF page is required.");
  const objectCount = 2 + pages.length * 3;
  const objects: Uint8Array[] = Array.from({ length: objectCount + 1 }, () => new Uint8Array());
  objects[1] = asciiBytes("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjectIds = pages.map((_, index) => 3 + index * 3);
  objects[2] = asciiBytes(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((page, index) => {
    const pageObjectId = 3 + index * 3;
    const imageObjectId = pageObjectId + 1;
    const contentObjectId = pageObjectId + 2;
    const imageName = `Im${index + 1}`;
    objects[pageObjectId] = asciiBytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] `
      + `/Resources << /XObject << /${imageName} ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects[imageObjectId] = concatenateBytes([
      asciiBytes(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} `
        + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
      ),
      page.bytes,
      asciiBytes("\nendstream"),
    ]);
    const content = `q\n${PDF_PAGE_WIDTH} 0 0 ${PDF_PAGE_HEIGHT} 0 0 cm\n/${imageName} Do\nQ\n`;
    objects[contentObjectId] = asciiBytes(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  });

  const parts = [asciiBytes("%PDF-1.4\n%MK\n")];
  const offsets = Array<number>(objectCount + 1).fill(0);
  let currentOffset = parts[0].length;
  for (let id = 1; id <= objectCount; id += 1) {
    const objectBytes = concatenateBytes([
      asciiBytes(`${id} 0 obj\n`),
      objects[id],
      asciiBytes("\nendobj\n"),
    ]);
    offsets[id] = currentOffset;
    parts.push(objectBytes);
    currentOffset += objectBytes.length;
  }

  const xrefOffset = currentOffset;
  const xref = [
    `xref\n0 ${objectCount + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");
  parts.push(asciiBytes(xref));
  return concatenateBytes(parts);
}

function makePage() {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF canvas is unavailable.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = PAPER;
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { canvas, context };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A reference image could not be loaded."));
    image.src = source;
  });
}

function cropTransparentImage(image: HTMLImageElement) {
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext("2d")!;
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
  const background = [pixels[0], pixels[1], pixels[2], pixels[3]];
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      const alpha = pixels[index + 3];
      const alphaDifference = Math.abs(alpha - background[3]);
      const colorDifference = Math.abs(pixels[index] - background[0])
        + Math.abs(pixels[index + 1] - background[1])
        + Math.abs(pixels[index + 2] - background[2]);
      if (alpha <= 8 || (alphaDifference <= 8 && colorDifference <= 36)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return source;
  const padding = Math.max(8, Math.round(Math.max(maxX - minX, maxY - minY) * 0.035));
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const width = Math.min(source.width - x, maxX - minX + 1 + padding * 2);
  const height = Math.min(source.height - y, maxY - minY + 1 + padding * 2);
  const cropped = document.createElement("canvas");
  cropped.width = width;
  cropped.height = height;
  cropped.getContext("2d")!.drawImage(source, x, y, width, height, 0, 0, width, height);
  return cropped;
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 0,
) {
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  context.drawImage(
    image,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
}

function drawHeader(context: CanvasRenderingContext2D, section: string, title: string, subtitle: string) {
  context.fillStyle = INK;
  context.fillRect(0, 0, PAGE_WIDTH, 160);
  context.fillStyle = GOLD;
  context.font = "600 22px 'League Spartan', sans-serif";
  context.fillText("MANOIR KITS", 72, 58);
  context.fillStyle = WHITE;
  context.font = "500 18px 'League Spartan', sans-serif";
  context.fillText(section.toUpperCase(), 72, 105);
  context.textAlign = "right";
  context.fillStyle = "#bdb9b1";
  context.fillText("PRIVATE STUDIO EXPORT", PAGE_WIDTH - 72, 58);
  context.textAlign = "left";

  context.fillStyle = INK;
  context.font = "600 58px 'League Spartan', sans-serif";
  context.fillText(title, 72, 245);
  context.fillStyle = MUTED;
  context.font = "400 23px 'League Spartan', sans-serif";
  context.fillText(subtitle, 72, 286);
}

function drawFooter(context: CanvasRenderingContext2D, page: number, total: number, generatedAt: Date) {
  context.strokeStyle = "#d5d0c7";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(72, PAGE_HEIGHT - 88);
  context.lineTo(PAGE_WIDTH - 72, PAGE_HEIGHT - 88);
  context.stroke();
  context.fillStyle = MUTED;
  context.font = "400 16px 'League Spartan', sans-serif";
  context.fillText(`Generated ${generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 72, PAGE_HEIGHT - 50);
  context.textAlign = "right";
  context.fillText(`MANOIR KITS  |  ${page} / ${total}`, PAGE_WIDTH - 72, PAGE_HEIGHT - 50);
  context.textAlign = "left";
}

function drawViewCard(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = WHITE;
  context.fillRect(x, y, width, height);
  context.strokeStyle = "#d7d2ca";
  context.strokeRect(x, y, width, height);
  context.fillStyle = MUTED;
  context.font = "500 17px 'League Spartan', sans-serif";
  context.fillText(label.toUpperCase(), x + 24, y + 35);
  drawContainedImage(context, image, image.width, image.height, x + 8, y + 50, width - 16, height - 58, 10);
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSpecRow(context: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number) {
  context.fillStyle = MUTED;
  context.font = "500 16px 'League Spartan', sans-serif";
  context.fillText(label.toUpperCase(), x, y);
  context.fillStyle = INK;
  context.font = "600 26px 'League Spartan', sans-serif";
  const lines = wrapText(context, value || "None", width);
  lines.slice(0, 2).forEach((line, index) => context.fillText(line, x, y + 34 + index * 30));
  context.strokeStyle = "#d7d2ca";
  context.beginPath();
  context.moveTo(x, y + 83);
  context.lineTo(x + width, y + 83);
  context.stroke();
}

function compositeInteriorPatch(patch: HTMLImageElement, crest: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = patch.naturalWidth;
  canvas.height = patch.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(patch, 0, 0);
  context.fillStyle = "#0f0e09";
  context.fillRect(canvas.width * 0.3, canvas.height * 0.25, canvas.width * 0.4, canvas.height * 0.31);
  const crestWidth = canvas.width * 0.35;
  const crestHeight = crestWidth * (crest.naturalHeight / crest.naturalWidth);
  context.drawImage(crest, (canvas.width - crestWidth) / 2, canvas.height * 0.26, crestWidth, crestHeight);
  return canvas;
}

async function canvasToJpegPage(canvas: HTMLCanvasElement): Promise<PdfJpegPage> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("A PDF page could not be rendered.")), "image/jpeg", 0.92);
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  };
}

function filenamePart(value: string) {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "Custom-Jacket";
}

export async function downloadJacketReferencePdf(input: JacketReferencePdfInput) {
  const [front, back, left, right, neckLabel, oneOfOnePatch, crest] = await Promise.all([
    loadImage(input.captures.front),
    loadImage(input.captures.back),
    loadImage(input.captures.left),
    loadImage(input.captures.right),
    loadImage(input.interiorImages.neckLabel),
    loadImage(input.interiorImages.oneOfOnePatch),
    loadImage(input.interiorImages.crest),
  ]);
  const jacketViews = {
    front: cropTransparentImage(front),
    back: cropTransparentImage(back),
    left: cropTransparentImage(left),
    right: cropTransparentImage(right),
  };
  const pageCount = 5;
  const pages: HTMLCanvasElement[] = [];

  {
    const { canvas, context } = makePage();
    drawHeader(context, "Manufacturer reference", input.backName.toUpperCase() || "CUSTOM JACKET", input.designName);
    drawViewCard(context, jacketViews.front, "Front view", 72, 345, 525, 1180);
    drawViewCard(context, jacketViews.back, "Back view", 643, 345, 525, 1180);
    drawFooter(context, 1, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(context, "Artwork and placement", "Back design", "Approved layout applied to the current studio configuration");
    drawViewCard(context, jacketViews.back, "Back reference", 72, 345, 700, 1230);
    const specsX = 824;
    drawSpecRow(context, "Back name", input.backName.toUpperCase(), specsX, 390, 344);
    drawSpecRow(context, "Back number", input.backNumber || "None", specsX, 505, 344);
    drawSpecRow(context, "Gold stars", `${input.stars} of 10`, specsX, 620, 344);
    drawSpecRow(context, "Edition", input.edition, specsX, 735, 344);
    context.fillStyle = "#ebe3cf";
    context.fillRect(specsX, 890, 344, 250);
    context.fillStyle = INK;
    context.font = "600 18px 'League Spartan', sans-serif";
    context.fillText("PLACEMENT NOTE", specsX + 24, 930);
    context.font = "400 19px 'League Spartan', sans-serif";
    const noteLines = wrapText(
      context,
      "Keep the star arc, name, number and EST. 2026 mark in the approved order and proportions shown here.",
      296,
    );
    noteLines.forEach((line, index) => context.fillText(line, specsX + 24, 974 + index * 28));
    drawFooter(context, 2, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(context, "Artwork and placement", "Outer sleeve numbers", "Numbers sit on the exterior face of each sleeve");
    drawViewCard(context, jacketViews.left, "Wearer left sleeve", 72, 345, 525, 1030);
    drawViewCard(context, jacketViews.right, "Wearer right sleeve", 643, 345, 525, 1030);
    context.fillStyle = WHITE;
    context.fillRect(72, 1415, 1096, 190);
    context.strokeStyle = "#d7d2ca";
    context.strokeRect(72, 1415, 1096, 190);
    drawSpecRow(
      context,
      "Left sleeve - top to bottom",
      input.leftSleeveNumbers.filter(Boolean).join("  /  ") || "No numbers selected",
      105,
      1460,
      465,
    );
    drawSpecRow(
      context,
      "Right sleeve - top to bottom",
      input.rightSleeveNumbers.filter(Boolean).join("  /  ") || "No numbers selected",
      670,
      1460,
      465,
    );
    drawFooter(context, 3, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(context, "Construction", "Materials and colors", `${input.edition} edition - ${input.bodyMaterial} body - ${input.leatherType} leather`);
    drawViewCard(context, jacketViews.front, "Color reference", 72, 345, 560, 1150);
    const startX = 700;
    let y = 385;
    input.materials.forEach((material) => {
      context.fillStyle = material.color;
      context.fillRect(startX, y, 56, 56);
      context.strokeStyle = "#bdb8af";
      context.strokeRect(startX, y, 56, 56);
      context.fillStyle = MUTED;
      context.font = "500 15px 'League Spartan', sans-serif";
      context.fillText(material.label.toUpperCase(), startX + 78, y + 18);
      context.fillStyle = INK;
      context.font = "600 23px 'League Spartan', sans-serif";
      context.fillText(material.value, startX + 78, y + 46);
      y += 118;
    });
    drawFooter(context, 4, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(context, "Interior branding", "Interior label artwork", "Reference artwork for planned neck and lining placements");
    context.fillStyle = "#171717";
    context.fillRect(72, 345, 1096, 570);
    drawContainedImage(context, neckLabel, neckLabel.naturalWidth, neckLabel.naturalHeight, 120, 410, 1000, 400, 20);
    context.fillStyle = WHITE;
    context.font = "500 17px 'League Spartan', sans-serif";
    context.fillText("LEATHER NECK LABEL", 104, 870);
    const patch = compositeInteriorPatch(oneOfOnePatch, crest);
    context.fillStyle = "#171717";
    context.fillRect(72, 965, 1096, 470);
    drawContainedImage(context, patch, patch.width, patch.height, 200, 1015, 840, 320, 8);
    context.fillStyle = WHITE;
    context.fillText("ONE OF ONE - LEGEND'S EDITION LINING PATCH", 104, 1390);
    context.fillStyle = MUTED;
    context.font = "400 19px 'League Spartan', sans-serif";
    const lines = wrapText(
      context,
      "Concept reference. Confirm final dimensions, materials, embroidery files, placement and physical label proofs before production.",
      1040,
    );
    lines.forEach((line, index) => context.fillText(line, 72, 1495 + index * 28));
    drawFooter(context, 5, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  const jpegPages = await Promise.all(pages.map(canvasToJpegPage));
  const pdfBytes = assemblePdfFromJpegs(jpegPages);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const fileName = `Manoir-Kits-${filenamePart(input.designName || input.backName)}-Manufacturer-Reference.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return { blob, fileName, pageCount };
}
