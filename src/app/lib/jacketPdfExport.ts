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
const INK = "#111111";
const GOLD = "#c9a84c";
const PAPER = "#f6f4ef";
const WHITE = "#ffffff";
const MUTED = "#77746f";
const BORDER = "#d8d3c9";
const PALE_GOLD = "#eee6d1";

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
  context.fillRect(72, 48, 74, 5);
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
  context.font = "600 48px 'League Spartan', Arial, sans-serif";
  context.fillText(title, 72, 188);
  context.fillStyle = MUTED;
  context.font = "400 19px 'League Spartan', Arial, sans-serif";
  context.fillText(subtitle, 72, 224);
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

function drawNumberMarker(context: CanvasRenderingContext2D, number: number, x: number, y: number) {
  context.fillStyle = GOLD;
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
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX - 24, toY);
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
  context.strokeRect(x, y, width, height);
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

function drawSequence(
  context: CanvasRenderingContext2D,
  label: string,
  values: string[],
  x: number,
  y: number,
  width: number,
) {
  context.fillStyle = WHITE;
  context.fillRect(x, y, width, 154);
  context.strokeStyle = BORDER;
  context.strokeRect(x, y, width, 154);
  context.fillStyle = MUTED;
  context.font = "500 14px 'League Spartan', Arial, sans-serif";
  context.fillText(label.toUpperCase(), x + 24, y + 31);
  const selected = values.filter(Boolean);
  if (!selected.length) {
    context.fillStyle = INK;
    context.font = "600 20px 'League Spartan', Arial, sans-serif";
    context.fillText("No numbers selected", x + 24, y + 89);
    return;
  }
  let chipX = x + 24;
  selected.forEach((value, index) => {
    context.fillStyle = INK;
    context.fillRect(chipX, y + 56, 82, 64);
    context.fillStyle = GOLD;
    context.font = "600 29px 'League Spartan', Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(value, chipX + 41, y + 98);
    context.textAlign = "left";
    chipX += 104;
    if (index < selected.length - 1) {
      context.fillStyle = MUTED;
      context.font = "500 18px Arial, sans-serif";
      context.fillText("/", chipX - 15, y + 94);
    }
  });
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
    drawViewCard(context, jacketViews.front, "Front view / placement reference", 72, 276, 800, 836);
    const detailX = 970;
    const detailWidth = 712;
    const cardHeight = 116;
    const details = [
      { label: "Chest wordmark", value: "Manoir Kits script - direct embroidery", y: 286, fromX: 390, fromY: 505 },
      { label: "MK crest", value: "Crest patch - placement follows front rendering", y: 430, fromX: 552, fromY: 518 },
      { label: "Body", value: `${input.bodyMaterial} - ${body.value}`, y: 574, fromX: 470, fromY: 710 },
      { label: "Sleeves and pockets", value: `${input.leatherType} leather - ${sleeves.value} / ${pockets.value}`, y: 718, fromX: 272, fromY: 748 },
      { label: "Snaps and knit trim", value: `${snaps.value} snaps - ${trim.value} trim`, y: 862, fromX: 475, fromY: 936 },
    ];
    details.forEach((detail, index) => {
      drawCallout(context, index + 1, detail.fromX, detail.fromY, detailX + 34, detail.y + 34);
      drawDetailCard(context, index + 1, detail.label, detail.value, detailX, detail.y, detailWidth, cardHeight);
    });
    drawNoteBox(
      context,
      "Front approval note",
      "Use this page for placement and proportion. Confirm physical color swatches, artwork dimensions and stitch proofs before production.",
      detailX,
      1010,
      detailWidth,
      102,
    );
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
    drawViewCard(context, jacketViews.back, "Back view / placement reference", 72, 276, 800, 836);
    const detailX = 970;
    const detailWidth = 712;
    const details = [
      { label: "Gold star arc", value: `${input.stars} star${input.stars === 1 ? "" : "s"} centered above the name`, y: 310, fromX: 470, fromY: 430 },
      { label: "Back name", value: (input.backName || "None").toUpperCase(), y: 470, fromX: 470, fromY: 600 },
      { label: "Back number", value: input.backNumber || "None", y: 630, fromX: 470, fromY: 760 },
      { label: "Lower-back mark", value: "EST. 2026 - centered below the number", y: 790, fromX: 470, fromY: 935 },
    ];
    details.forEach((detail, index) => {
      drawCallout(context, index + 1, detail.fromX, detail.fromY, detailX + 34, detail.y + 34);
      drawDetailCard(context, index + 1, detail.label, detail.value, detailX, detail.y, detailWidth, 128);
    });
    drawNoteBox(
      context,
      "Placement order",
      "Keep the star arc, name, number and EST. 2026 mark in this fixed top-to-bottom order. Match the rendered spacing and proportions.",
      detailX,
      968,
      detailWidth,
      144,
    );
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
    drawViewCard(context, jacketViews.left, "Wearer-left sleeve / outside face", 72, 276, 770, 548);
    drawViewCard(context, jacketViews.right, "Wearer-right sleeve / outside face", 912, 276, 770, 548);
    drawSequence(context, "Wearer-left - top to bottom", input.leftSleeveNumbers, 72, 854, 770);
    drawSequence(context, "Wearer-right - top to bottom", input.rightSleeveNumbers, 912, 854, 770);
    drawNoteBox(
      context,
      "Sleeve production rule",
      "Place the sequences on the exterior of both sleeves in the order shown. Preserve leading zeros and confirm reading direction on the sewn sample.",
      72,
      1036,
      1610,
      82,
    );
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
    context.fillStyle = "#171717";
    context.fillRect(72, 286, 800, 362);
    drawContainedImage(context, neckLabel, neckLabel.naturalWidth, neckLabel.naturalHeight, 112, 326, 720, 245, 16);
    context.fillStyle = WHITE;
    context.font = "500 14px 'League Spartan', Arial, sans-serif";
    context.fillText("LEATHER NECK LABEL / ARTWORK REFERENCE", 104, 620);
    const patch = compositeInteriorPatch(oneOfOnePatch, crest);
    context.fillStyle = "#171717";
    context.fillRect(72, 678, 800, 362);
    drawContainedImage(context, patch, patch.width, patch.height, 155, 710, 634, 250, 8);
    context.fillStyle = WHITE;
    context.fillText("ONE OF ONE / LEGEND'S EDITION LINING PATCH", 104, 1012);

    const detailX = 930;
    drawDetailCard(context, 1, "Neck label", "Black leather label with supplied gold Manoir Kits artwork", detailX, 286, 752, 130);
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
      "Artwork intent and build method for manufacturer confirmation",
    );
    const cardY = 286;
    const cardWidth = 500;
    const artHeight = 500;
    const artCards = [72, 627, 1182];
    artCards.forEach((x) => {
      context.fillStyle = WHITE;
      context.fillRect(x, cardY, cardWidth, artHeight);
      context.strokeStyle = BORDER;
      context.strokeRect(x, cardY, cardWidth, artHeight);
    });

    context.fillStyle = "#171717";
    context.fillRect(94, cardY + 56, 456, 350);
    drawContainedImage(context, crest, crest.naturalWidth, crest.naturalHeight, 128, cardY + 90, 388, 282, 12);
    context.fillStyle = MUTED;
    context.font = "500 14px 'League Spartan', Arial, sans-serif";
    context.fillText("CREST / STAR / PATCH DETAILS", 96, cardY + 452);

    context.fillStyle = "#171717";
    context.fillRect(649, cardY + 56, 456, 350);
    drawContainedImage(context, oneOfOnePatch, oneOfOnePatch.naturalWidth, oneOfOnePatch.naturalHeight, 675, cardY + 96, 404, 270, 10);
    context.fillStyle = MUTED;
    context.fillText("INTERIOR PATCH CONSTRUCTION", 651, cardY + 452);

    context.fillStyle = "#171717";
    context.fillRect(1204, cardY + 56, 456, 350);
    context.fillStyle = GOLD;
    context.textAlign = "center";
    context.font = "600 34px 'League Spartan', Arial, sans-serif";
    context.fillText((input.backName || "NAME").toUpperCase(), 1432, cardY + 155);
    context.font = "600 128px 'League Spartan', Arial, sans-serif";
    context.fillText(input.backNumber || "00", 1432, cardY + 300);
    context.font = "500 24px 'League Spartan', Arial, sans-serif";
    context.fillText("EST. 2026", 1432, cardY + 354);
    context.textAlign = "left";
    context.fillStyle = MUTED;
    context.font = "500 14px 'League Spartan', Arial, sans-serif";
    context.fillText("BACK AND SLEEVE APPLIQUE", 1206, cardY + 452);

    drawNoteBox(
      context,
      "Chest artwork",
      "Use direct embroidery for the cursive Manoir Kits wordmark. Confirm thread color, stitch density, backing and exact size from the artwork file.",
      72,
      818,
      cardWidth,
      226,
    );
    drawNoteBox(
      context,
      "Patches and stars",
      "Use embroidered or applique construction for the crest, stars and interior patch. Manufacturer must confirm edge finish, layers and attachment method.",
      627,
      818,
      cardWidth,
      226,
    );
    drawNoteBox(
      context,
      "Names and numbers",
      "Use applique or embroidery for the back name, back number and outside sleeve numbers. Preserve the selected color and all leading zeros.",
      1182,
      818,
      cardWidth,
      226,
    );
    context.fillStyle = MUTED;
    context.font = "400 15px 'League Spartan', Arial, sans-serif";
    context.fillText("Final dimensions, stitch files, materials and physical construction samples require manufacturer approval.", 72, 1096);
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
      ["Chest wordmark", "Manoir Kits script - direct embroidery"],
      ["Crest", "MK crest patch - front chest"],
      ["Back stars", `${input.stars} gold star${input.stars === 1 ? "" : "s"}`],
      ["Back name", (input.backName || "None").toUpperCase()],
      ["Back number", input.backNumber || "None"],
      ["Left sleeve outside", input.leftSleeveNumbers.filter(Boolean).join(" / ") || "None"],
      ["Right sleeve outside", input.rightSleeveNumbers.filter(Boolean).join(" / ") || "None"],
      ["Sleeve artwork color", sleeveArtwork.value],
      ["One of one patch", "Black leather / gold artwork / interior lining"],
      ["Neck label", "Black leather / gold Manoir Kits artwork"],
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
