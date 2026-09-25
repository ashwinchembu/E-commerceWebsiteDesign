import wordmarkSource from "../../assets/manoir-kits-footballers-wordmark.png";
import estSource from "../../assets/manoir-kits-footballers-est-2026.png";
import classicWordmarkSource from "../../assets/manoir-kits-classic-wordmark.png";
import classicEstSource from "../../assets/manoir-kits-classic-est-2026.png";
import badgePhotoSource from "../../assets/manufacturer-reference/badge-edge.jpeg";
import starsPhotoSource from "../../assets/manufacturer-reference/star-group.jpeg";
import starPhotoSource from "../../assets/manufacturer-reference/star-detail.jpeg";

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

const PAGE_WIDTH = 1754;
const PAGE_HEIGHT = 1240;
const PDF_PAGE_WIDTH = 841.89;
const PDF_PAGE_HEIGHT = 595.28;
const INK = "#202624";
const GOLD = "#ac8534";
const PAPER = "#ffffff";
const WHITE = "#ffffff";
const MUTED = "#77746f";
const BORDER = "#d9ddd7";
const PALE_GOLD = "#f5f6f3";

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
  context.fillStyle = GOLD;
  context.font = "600 19px 'League Spartan', Arial, sans-serif";
  context.fillText("MANOIR KITS", 72, 88);
  context.fillStyle = MUTED;
  context.font = "500 15px 'League Spartan', Arial, sans-serif";
  context.fillText(section.toUpperCase(), 72, 119);
  context.textAlign = "right";
  context.fillText("PRIVATE STUDIO / MANUFACTURER REFERENCE", PAGE_WIDTH - 72, 88);
  context.textAlign = "left";
  context.fillStyle = INK;
  context.font = "500 44px 'League Spartan', Arial, sans-serif";
  context.fillText(title, 72, 188);
  context.fillStyle = MUTED;
  context.font = "400 19px 'League Spartan', Arial, sans-serif";
  context.fillText(subtitle, 72, 224, PAGE_WIDTH - 144);
}

function drawFooter(context: CanvasRenderingContext2D, page: number, total: number, generatedAt: Date) {
  context.strokeStyle = BORDER;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(72, PAGE_HEIGHT - 76);
  context.lineTo(PAGE_WIDTH - 72, PAGE_HEIGHT - 76);
  context.stroke();
  context.fillStyle = MUTED;
  context.font = "400 14px 'League Spartan', Arial, sans-serif";
  context.fillText(
    `Generated ${generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    72,
    PAGE_HEIGHT - 42,
  );
  context.textAlign = "center";
  context.fillText("MANOIR KITS - MANUFACTURER REFERENCE", PAGE_WIDTH / 2, PAGE_HEIGHT - 42);
  context.textAlign = "right";
  context.fillText(`${page} / ${total}`, PAGE_WIDTH - 72, PAGE_HEIGHT - 42);
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
  context.strokeStyle = BORDER;
  context.strokeRect(x, y, width, height);
  context.fillStyle = MUTED;
  context.font = "500 15px 'League Spartan', Arial, sans-serif";
  context.fillText(label.toUpperCase(), x + 24, y + 35);
  const scale = Math.min((width - 80) / image.width, (height - 100) / image.height);
  const bounds = { x: x + (width - image.width * scale) / 2, y: y + 50 + (height - 58 - image.height * scale) / 2, width: image.width * scale, height: image.height * scale };
  context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height);
  return bounds;
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

function drawNumberMarker(context: CanvasRenderingContext2D, number: number, x: number, y: number) {
  context.fillStyle = INK;
  context.beginPath();
  context.arc(x, y, 18, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = WHITE;
  context.font = "600 17px 'League Spartan', Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), x, y + 1);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}

function drawCallout(
  context: CanvasRenderingContext2D,
  number: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  context.strokeStyle = GOLD;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(fromX, fromY);
  const distance = Math.hypot(toX - fromX, toY - fromY);
  context.lineTo(toX - (toX - fromX) * 23 / distance, toY - (toY - fromY) * 23 / distance);
  context.stroke();
  context.fillStyle = WHITE;
  context.beginPath();
  context.arc(fromX, fromY, 4, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  drawNumberMarker(context, number, toX, toY);
}

function drawDetailCard(
  context: CanvasRenderingContext2D,
  number: number,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = WHITE;
  context.fillRect(x, y, width, height);
  context.strokeStyle = BORDER;
  context.beginPath();
  context.moveTo(x + 70, y + height);
  context.lineTo(x + width, y + height);
  context.stroke();
  drawNumberMarker(context, number, x + 34, y + 34);
  context.fillStyle = MUTED;
  context.font = "500 14px 'League Spartan', Arial, sans-serif";
  context.fillText(label.toUpperCase(), x + 70, y + 30);
  context.fillStyle = INK;
  context.font = "600 20px 'League Spartan', Arial, sans-serif";
  const lines = wrapText(context, value || "None", width - 94);
  lines.slice(0, 2).forEach((line, index) => context.fillText(line, x + 70, y + 58 + index * 23));
}

function drawColorValue(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  color: string,
  x: number,
  y: number,
  width: number,
) {
  context.fillStyle = color;
  context.fillRect(x, y, 44, 44);
  context.strokeStyle = "#aaa49a";
  context.strokeRect(x, y, 44, 44);
  context.fillStyle = MUTED;
  context.font = "500 13px 'League Spartan', Arial, sans-serif";
  context.fillText(label.toUpperCase(), x + 62, y + 16);
  context.fillStyle = INK;
  context.font = "600 18px 'League Spartan', Arial, sans-serif";
  context.fillText(value || "None", x + 62, y + 40, width - 62);
}

function drawNoteBox(
  context: CanvasRenderingContext2D,
  title: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = PALE_GOLD;
  context.fillRect(x, y, width, height);
  context.fillStyle = INK;
  context.font = "600 15px 'League Spartan', Arial, sans-serif";
  context.fillText(title.toUpperCase(), x + 24, y + 34);
  context.font = "400 17px 'League Spartan', Arial, sans-serif";
  const lines = wrapText(context, text, width - 48);
  lines.slice(0, 5).forEach((line, index) => context.fillText(line, x + 24, y + 66 + index * 22));
}

function drawSleeveDetails(context: CanvasRenderingContext2D, values: string[], color: string, x: number, y: number, width: number, height: number) {
  context.fillStyle = MUTED;
  context.font = "500 15px Arial, sans-serif";
  context.fillText("DETAIL", x, y - 20);
  const selected = values.filter(Boolean);
  if (!selected.length) {
    context.font = "400 17px Arial, sans-serif";
    context.fillText("No numbers", x, y + 30);
    return;
  }
  const gap = 14;
  const h = Math.min(120, (height - (selected.length - 1) * gap) / selected.length);
  selected.forEach((value, index) => {
    const top = y + index * (h + gap);
    context.fillStyle = PALE_GOLD;
    context.fillRect(x, top, width, h);
    context.strokeStyle = BORDER;
    context.lineWidth = 1;
    context.strokeRect(x, top, width, h);
    context.font = `600 ${Math.min(52, h * .6)}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.strokeStyle = "#b7ae94";
    context.lineWidth = 1;
    context.strokeText(value, x + width / 2, top + h / 2);
    context.fillStyle = color;
    context.fillText(value, x + width / 2, top + h / 2);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
  });
}

function drawArtwork(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const cropped = cropTransparentImage(image);
  context.fillStyle = PALE_GOLD;
  context.fillRect(x, y, width, height);
  drawContainedImage(context, cropped, cropped.width, cropped.height, x, y, width, height, 12);
}

function markView(context: CanvasRenderingContext2D, number: number, bounds: {x: number; y: number; width: number; height: number}, anchor: number[], marker: number[]) {
  drawCallout(context, number, bounds.x + anchor[0] * bounds.width, bounds.y + anchor[1] * bounds.height,
    bounds.x + marker[0] * bounds.width, bounds.y + marker[1] * bounds.height);
}

function drawSpecificationRow(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  alternate: boolean,
) {
  context.fillStyle = alternate ? "#eeeae2" : WHITE;
  context.fillRect(x, y, width, 66);
  context.fillStyle = MUTED;
  context.font = "500 14px 'League Spartan', Arial, sans-serif";
  context.fillText(label.toUpperCase(), x + 20, y + 25);
  context.fillStyle = INK;
  context.font = "600 17px 'League Spartan', Arial, sans-serif";
  const lines = wrapText(context, value || "None", width - 270);
  lines.slice(0, 2).forEach((line, index) => context.fillText(line, x + 250, y + 25 + index * 20));
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

function materialFor(input: JacketReferencePdfInput, label: string) {
  return input.materials.find((material) => material.label.toLowerCase() === label.toLowerCase())
    ?? { label, value: "Not specified", color: "#ffffff" };
}

export async function downloadJacketReferencePdf(input: JacketReferencePdfInput) {
  const isFootballers = input.edition.toLowerCase() === "footballers";
  const wordmarkDescription = isFootballers ? "Cursive chest wordmark" : "Classic chest wordmark";
  const estDescription = isFootballers ? "Cursive direct embroidery at the lower back." : "Classic EST. 2026 artwork at the lower back.";
  const [front, back, left, right, neckLabel, oneOfOnePatch, crest, wordmark, est, badgePhoto, starsPhoto, starPhoto] = await Promise.all([
    loadImage(input.captures.front),
    loadImage(input.captures.back),
    loadImage(input.captures.left),
    loadImage(input.captures.right),
    loadImage(input.interiorImages.neckLabel),
    loadImage(input.interiorImages.oneOfOnePatch),
    loadImage(input.interiorImages.crest),
    loadImage(isFootballers ? wordmarkSource : classicWordmarkSource),
    loadImage(isFootballers ? estSource : classicEstSource),
    loadImage(badgePhotoSource),
    loadImage(starsPhotoSource),
    loadImage(starPhotoSource),
  ]);
  const jacketViews = {
    front: cropTransparentImage(front),
    back: cropTransparentImage(back),
    left: cropTransparentImage(left),
    right: cropTransparentImage(right),
  };
  const body = materialFor(input, "Body");
  const sleeves = materialFor(input, "Sleeves");
  const pockets = materialFor(input, "Pockets");
  const snaps = materialFor(input, "Snaps");
  const trim = materialFor(input, "Knit trim");
  const lining = materialFor(input, "Inside lining");
  const backArtwork = materialFor(input, "Back artwork");
  const sleeveArtwork = materialFor(input, "Sleeve numbers");
  const pageCount = 6;
  const pages: HTMLCanvasElement[] = [];

  {
    const { canvas, context } = makePage();
    drawHeader(
      context,
      "01 / Front",
      "Front / materials and chest details",
      `${input.designName} - ${input.edition} edition`,
    );
    const bounds = drawViewCard(context, jacketViews.front, "Front view / wearer-facing reference", 72, 276, 860, 836);
    const detailX = 980;
    const detailWidth = 702;
    const details = [
      { label: wordmarkDescription, value: "Wearer right / viewer left. Direct embroidery.", y: 276, h: 206, anchor: [.26,.31], marker: [0,.31], art: wordmark },
      { label: "MK badge", value: "Wearer left / viewer right. See badge edge on page 5.", y: 502, h: 206, anchor: [.67,.31], marker: [1,.31], art: crest },
      { label: "Body", value: `${body.value} / ${input.bodyMaterial}`, y: 730, h: 108, anchor: [.49,.23], marker: [.49,.07] },
      { label: "Sleeves + pockets", value: `${input.leatherType} leather. Sleeves: ${sleeves.value}. Pockets: ${pockets.value}.`, y: 860, h: 108, anchor: [.86,.61], marker: [1,.61] },
      { label: "Snaps + knit trim", value: `${snaps.value} snaps. ${trim.value} collar, cuffs and waistband.`, y: 990, h: 108, anchor: [.54,.87], marker: [.54,.99] },
    ];
    details.forEach((detail, index) => {
      markView(context, index + 1, bounds, detail.anchor, detail.marker);
      drawDetailCard(context, index + 1, detail.label, detail.value, detailX, detail.y, detailWidth, detail.h);
      if (detail.art) drawArtwork(context, detail.art, detailX + 70, detail.y + 100, detailWidth - 90, 88);
    });
    drawFooter(context, 1, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(
      context,
      "02 / Back",
      "Back / artwork and placement",
      `${input.stars} golden ${input.stars === 1 ? "star" : "stars"} - ${(input.backName || "name").toUpperCase()} - ${input.backNumber || "number"}`,
    );
    const bounds = drawViewCard(context, jacketViews.back, "Back view / placement reference", 72, 276, 860, 836);
    const detailX = 980;
    const detailWidth = 702;
    const details = [
      { label: "Golden stars", value: `${input.stars} star${input.stars === 1 ? "" : "s"} at the top center. Layered applique construction; see page 5.`, y: 286, anchor: [.68,.23] },
      { label: "Back name", value: `${(input.backName || "None").toUpperCase()} / ${backArtwork.value} artwork`, y: 465, anchor: [.65,.30] },
      { label: "Back number", value: `${input.backNumber || "None"} / ${backArtwork.value} artwork`, y: 644, anchor: [.69,.52] },
      { label: "Est. 2026", value: estDescription, y: 823, anchor: [.64,.67] },
    ];
    details.forEach((detail, index) => {
      if ((index !== 0 || input.stars > 0) && (index !== 1 || input.backName) && (index !== 2 || input.backNumber)) {
        markView(context, index + 1, bounds, detail.anchor, [1, detail.anchor[1] + .04]);
      }
      drawDetailCard(context, index + 1, detail.label, detail.value, detailX, detail.y, detailWidth, index === 3 ? 220 : 142);
    });
    drawArtwork(context, est, detailX + 70, 923, detailWidth - 90, 100);
    context.fillStyle = MUTED;
    context.font = "400 17px Arial, sans-serif";
    context.fillText("Top to bottom: stars, name, number, establishment mark.", detailX + 20, 1092);
    drawFooter(context, 2, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(
      context,
      "03 / Sleeves",
      "Sleeves / placement and number details",
      "Wearer-side convention - every number sits on the outside face of the sleeve",
    );
    drawViewCard(context, jacketViews.left, "Wearer-left sleeve / outside", 290, 276, 552, 704);
    drawViewCard(context, jacketViews.right, "Wearer-right sleeve / outside", 912, 276, 552, 704);
    drawSleeveDetails(context, input.leftSleeveNumbers, sleeveArtwork.color, 72, 360, 180, 570);
    drawSleeveDetails(context, input.rightSleeveNumbers, sleeveArtwork.color, 1502, 360, 180, 570);
    context.fillStyle = INK;
    context.font = "400 22px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(input.leftSleeveNumbers.filter(Boolean).join(" / ") || "No numbers", 566, 1020, 552);
    context.fillText(input.rightSleeveNumbers.filter(Boolean).join(" / ") || "No numbers", 1188, 1020, 552);
    context.textAlign = "left";
    context.fillStyle = MUTED;
    context.font = "400 18px Arial, sans-serif";
    context.fillText("Read from shoulder toward cuff. Preserve leading zeros. Numbers appear on the outside of both sleeves and enlarged beside each view.", 72, 1100, 1610);
    drawFooter(context, 3, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(
      context,
      "04 / Interior",
      "Interior / black leather labels",
      "Label artwork, lining reference and required sewn-in proof",
    );
    context.fillStyle = PALE_GOLD;
    context.fillRect(72, 286, 800, 362);
    drawContainedImage(context, neckLabel, neckLabel.naturalWidth, neckLabel.naturalHeight, 112, 326, 720, 245, 16);
    context.fillStyle = INK;
    context.font = "500 14px 'League Spartan', Arial, sans-serif";
    context.fillText("LEATHER NECK LABEL / ARTWORK REFERENCE", 104, 620);
    const patch = compositeInteriorPatch(oneOfOnePatch, crest);
    context.fillStyle = PALE_GOLD;
    context.fillRect(72, 678, 800, 362);
    drawContainedImage(context, patch, patch.width, patch.height, 155, 710, 634, 250, 8);
    context.fillStyle = INK;
    context.fillText("ONE OF ONE / LEGEND'S EDITION LINING PATCH", 104, 1012);

    const detailX = 930;
    drawDetailCard(context, 1, "Neck label", "Black leather with white debossed Manoir Kits text", detailX, 286, 752, 130);
    drawDetailCard(context, 2, "One of one patch", "Black leather patch with crest and edition wording", detailX, 444, 752, 130);
    drawDetailCard(context, 3, "Placement", "Neck label at inside neck; edition patch on interior lining", detailX, 602, 752, 130);
    context.fillStyle = WHITE;
    context.fillRect(detailX, 760, 752, 104);
    context.strokeStyle = BORDER;
    context.strokeRect(detailX, 760, 752, 104);
    drawColorValue(context, "Inside lining", lining.value, lining.color, detailX + 24, 790, 690);
    drawNoteBox(
      context,
      "Physical proof required",
      "Artwork shown here is a placement reference. Add clear sewn-in photos of both labels and confirm final size, leather, stitching and placement before production approval.",
      detailX,
      892,
      752,
      148,
    );
    drawFooter(context, 4, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(
      context,
      "05 / Construction",
      "Applique / construction references",
      "Original supplier-reference photos / embroidered edges and layered applique",
    );
    const photos = [badgePhoto, starsPhoto, starPhoto];
    const labels = ["BADGE / EMBROIDERED EDGE", "STARS / LAYERED CONSTRUCTION", "STAR / CLOSE DETAIL"];
    photos.forEach((photo, index) => {
      const x = 72 + index * 552;
      context.fillStyle = PALE_GOLD;
      context.fillRect(x, 286, 506, 584);
      drawContainedImage(context, photo, photo.naturalWidth, photo.naturalHeight, x + 12, 298, 482, 560);
      context.fillStyle = INK;
      context.font = "500 18px Arial, sans-serif";
      context.fillText(labels[index], x, 908);
    });
    drawNoteBox(context, "Apply the supplied construction references",
      `Original OVO jacket photos supplied by Harnoor. Match the embroidery and layered edge treatment for the badge, stars, names and numbers. This design uses ${input.stars} stars; the red color and five-star arrangement in the photos are examples only. Confirm applique leather, thread and dimensions before production.`,
      72, 950, 1610, 172);
    drawFooter(context, 5, pageCount, input.generatedAt);
    pages.push(canvas);
  }

  {
    const { canvas, context } = makePage();
    drawHeader(
      context,
      "06 / Specification",
      "Specification / manufacturer reference",
      "Complete register for the current Studio configuration",
    );
    const specs = [
      ["Edition", input.edition],
      ["Body construction", input.bodyMaterial],
      ["Body color", body.value],
      ["Sleeve construction", `${input.leatherType} leather`],
      ["Sleeve color", sleeves.value],
      ["Pockets", pockets.value],
      ["Snaps", snaps.value],
      ["Knit trim", trim.value],
      ["Inside lining", lining.value],
      ["Artwork color", backArtwork.value],
      ["Chest wordmark", `${isFootballers ? "Cursive" : "Classic"} Manoir Kits - direct embroidery`],
      ["Crest", "MK crest patch - front chest"],
      ["Back stars", `${input.stars} gold star${input.stars === 1 ? "" : "s"}`],
      ["Back name", (input.backName || "None").toUpperCase()],
      ["Back number", input.backNumber || "None"],
      ["Left sleeve outside", input.leftSleeveNumbers.filter(Boolean).join(" / ") || "None"],
      ["Right sleeve outside", input.rightSleeveNumbers.filter(Boolean).join(" / ") || "None"],
      ["Sleeve artwork color", sleeveArtwork.value],
      ["One of one patch", "Black leather / gold artwork / interior lining"],
      ["Neck label", "Black leather / white debossed text"],
    ];
    const half = Math.ceil(specs.length / 2);
    const columns = [specs.slice(0, half), specs.slice(half)];
    columns.forEach((column, columnIndex) => {
      const x = columnIndex === 0 ? 72 : 912;
      column.forEach(([label, value], rowIndex) => {
        drawSpecificationRow(context, label, value, x, 286 + rowIndex * 66, 770, rowIndex % 2 === 1);
      });
    });
    drawNoteBox(
      context,
      "Sample proof review",
      "Before bulk production, review one physical sample against pages 1-5. Confirm colors, dimensions, placement, sleeve reading direction, leading zeros, label materials and sewn-in label photos.",
      72,
      976,
      1610,
      136,
    );
    drawFooter(context, 6, pageCount, input.generatedAt);
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
