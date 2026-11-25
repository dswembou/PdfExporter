
import { PDFDocument } from "pdf-lib";

export interface PdfPageInfo {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  format: string;
  orientation: "portrait" | "landscape" | "square";
  rotation: number;
}

export interface PdfAnalysis {
  pageCount: number;
  encrypted: boolean;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  pages: PdfPageInfo[];
  formats: string[];
  mixedPageFormats: boolean;
  mixedOrientations: boolean;
}

function pointsToMillimeters(points: number): number {
  return points * 25.4 / 72;
}

function detectPageFormat(
  width: number,
  height: number
): string {

  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  const tolerance = 3;

  const formats = [
    { name: "A0", width: 841, height: 1189 },
    { name: "A1", width: 594, height: 841 },
    { name: "A2", width: 420, height: 594 },
    { name: "A3", width: 297, height: 420 },
    { name: "A4", width: 210, height: 297 },
    { name: "A5", width: 148, height: 210 },
    { name: "A6", width: 105, height: 148 },
    { name: "Letter", width: 215.9, height: 279.4 },
    { name: "Legal", width: 215.9, height: 355.6 }
  ];

  const match = formats.find(format =>
    Math.abs(shortSide - format.width) <= tolerance &&
    Math.abs(longSide - format.height) <= tolerance
  );

  return match?.name ?? "Afwijkend formaat";
}

export async function analyzePdf(
  bytes: Uint8Array
): Promise<PdfAnalysis> {

  const document = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false
  });

  // Versleutelde documenten niet verder verwerken.

  if (document.isEncrypted) {

    return {
      pageCount: 0,
      encrypted: true,
      pages: [],
      formats: [],
      mixedPageFormats: false,
      mixedOrientations: false
    };
  }

  const pages: PdfPageInfo[] = [];

  for (const [index, page] of document.getPages().entries()) {

    const { width, height } = page.getSize();

    const rotation =
      ((page.getRotation().angle % 360) + 360) % 360;

    const rotated =
      rotation === 90 || rotation === 270;

    const effectiveWidth = rotated ? height : width;
    const effectiveHeight = rotated ? width : height;

    const widthMm =
      pointsToMillimeters(effectiveWidth);

    const heightMm =
      pointsToMillimeters(effectiveHeight);

    let orientation: PdfPageInfo["orientation"];

    if (Math.abs(widthMm - heightMm) < 1) {
      orientation = "square";
    } else if (widthMm > heightMm) {
      orientation = "landscape";
    } else {
      orientation = "portrait";
    }

    pages.push({
      pageNumber: index + 1,
      widthPt: effectiveWidth,
      heightPt: effectiveHeight,
      widthMm: Number(widthMm.toFixed(1)),
      heightMm: Number(heightMm.toFixed(1)),
      format: detectPageFormat(widthMm, heightMm),
      orientation,
      rotation
    });
  }

  const formats = [
    ...new Set(pages.map(page => page.format))
  ];

  const orientations = [
    ...new Set(pages.map(page => page.orientation))
  ];

  const mixedPageFormats = pages.some(page => {

    const first = pages[0];

    const shortSide = Math.min(page.widthMm, page.heightMm);
    const longSide = Math.max(page.widthMm, page.heightMm);

    const firstShort = Math.min(first.widthMm, first.heightMm);
    const firstLong = Math.max(first.widthMm, first.heightMm);

    return (
      Math.abs(shortSide - firstShort) > 3 ||
      Math.abs(longSide - firstLong) > 3
    );
  });

  return {
    pageCount: document.getPageCount(),
    encrypted: false,
    title: document.getTitle(),
    author: document.getAuthor(),
    subject: document.getSubject(),
    creator: document.getCreator(),
    producer: document.getProducer(),
    pages,
    formats,
    mixedPageFormats,
    mixedOrientations: orientations.length > 1
  };
}
