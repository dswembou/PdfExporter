
import {
  PDFDocument,
  PageSizes,
  degrees
} from "pdf-lib";

export interface PdfAppendixInput {
  number: number;
  filename: string;
  bytes: Uint8Array;
  insertAfterPage: number;
}

export interface MergedAppendixInfo {
  number: number;
  filename: string;
  firstPage: number;
  lastPage: number;
  pageCount: number;
}

export interface PdfMergeResult {
  bytes: Uint8Array;
  originalPageCount: number;
  totalPageCount: number;
  appendices: MergedAppendixInfo[];
}

const MAX_APPENDIX_PAGES = 200;

const MARGIN = 36;
const FOOTER_SPACE = 35;

export async function mergePdfAppendices(
  mainPdfBytes: Uint8Array,
  appendices: PdfAppendixInput[]
): Promise<PdfMergeResult> {

  const mainDocument = await PDFDocument.load(
    mainPdfBytes
  );

  const originalPageCount =
    mainDocument.getPageCount();

  const mergedAppendices: MergedAppendixInfo[] = [];

  const sortedAppendices = [...appendices].sort(
    (a, b) => a.insertAfterPage - b.insertAfterPage
  );

  let insertedPages = 0;

  for (const appendix of sortedAppendices) {

    console.log(
      `Bijlage ${appendix.number}: ${appendix.filename}`
    );

    if (
      !Number.isInteger(appendix.insertAfterPage) ||
      appendix.insertAfterPage < 1 ||
      appendix.insertAfterPage > originalPageCount
    ) {
      throw new Error(
        "Ongeldige invoegpositie voor bijlage."
      );
    }

    const sourceDocument = await PDFDocument.load(
      appendix.bytes,
      {
        updateMetadata: false
      }
    );

    const sourcePages = sourceDocument.getPages();

    if (sourcePages.length === 0) {
      throw new Error("Bijlage bevat geen pagina's.");
    }

    if (sourcePages.length > MAX_APPENDIX_PAGES) {
      throw new Error(
        "Bijlage overschrijdt de limiet van 200 pagina's."
      );
    }

    const firstPage =
      appendix.insertAfterPage + insertedPages + 1;

    for (const sourcePage of sourcePages) {

      const cropBox = sourcePage.getCropBox();

      const sourceWidth = cropBox.width;
      const sourceHeight = cropBox.height;

      if (
        !Number.isFinite(sourceWidth) ||
        !Number.isFinite(sourceHeight) ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
      ) {
        throw new Error(
          "Ongeldige pagina-afmetingen."
        );
      }

      const rotation =
        ((sourcePage.getRotation().angle % 360) + 360) % 360;

      if (![0, 90, 180, 270].includes(rotation)) {
        throw new Error(
          "Niet-ondersteunde paginarotatie."
        );
      }

      const rotated =
        rotation === 90 || rotation === 270;

      const effectiveWidth =
        rotated ? sourceHeight : sourceWidth;

      const effectiveHeight =
        rotated ? sourceWidth : sourceHeight;

      const landscape =
        effectiveWidth > effectiveHeight;

      const [a4Width, a4Height] = PageSizes.A4;

      const targetWidth =
        landscape ? a4Height : a4Width;

      const targetHeight =
        landscape ? a4Width : a4Height;

      const availableWidth =
        targetWidth - MARGIN * 2;

      const availableHeight =
        targetHeight - MARGIN * 2 - FOOTER_SPACE;

      const scale = Math.min(
        availableWidth / effectiveWidth,
        availableHeight / effectiveHeight,
        1
      );

      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;

      const visibleWidth = effectiveWidth * scale;
      const visibleHeight = effectiveHeight * scale;

      const left =
        (targetWidth - visibleWidth) / 2;

      const bottom =
        MARGIN +
        FOOTER_SPACE +
        (availableHeight - visibleHeight) / 2;

      const embeddedPage =
        await mainDocument.embedPage(sourcePage, {
          left: cropBox.x,
          bottom: cropBox.y,
          right: cropBox.x + cropBox.width,
          top: cropBox.y + cropBox.height
        });

      const insertIndex =
        appendix.insertAfterPage + insertedPages;

      const targetPage = mainDocument.insertPage(
        insertIndex,
        [targetWidth, targetHeight]
      );

      let x = left;
      let y = bottom;

      // Positie corrigeren voor PDF-paginarotatie.

      switch (rotation) {

        case 90:
          y += drawWidth;
          break;

        case 180:
          x += drawWidth;
          y += drawHeight;
          break;

        case 270:
          x += drawHeight;
          break;
      }

      targetPage.drawPage(embeddedPage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
        rotate: degrees(-rotation)
      });

      insertedPages++;

      console.log(
        `  Pagina ingevoegd: ${insertIndex + 1}`
      );
    }

    mergedAppendices.push({
      number: appendix.number,
      filename: appendix.filename,
      firstPage,
      lastPage: firstPage + sourcePages.length - 1,
      pageCount: sourcePages.length
    });
  }

  const bytes = await mainDocument.save();

  return {
    bytes,
    originalPageCount,
    totalPageCount: mainDocument.getPageCount(),
    appendices: mergedAppendices
  };
}
