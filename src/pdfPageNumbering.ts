
import {
  PDFDocument,
  StandardFonts,
  rgb
} from "pdf-lib";

export interface PdfPageNumberingOptions {
  showTotalPages?: boolean;
  fontSize?: number;
  bottomOffset?: number;
  skipCover?: boolean;
}

export async function addPdfPageNumbers(
  bytes: Uint8Array,
  options: PdfPageNumberingOptions = {}
): Promise<Uint8Array> {

  const {
    showTotalPages = true,
    fontSize = 9,
    bottomOffset = 25,
    skipCover = false
  } = options;

  const document = await PDFDocument.load(bytes, {
    updateMetadata: false
  });

  const font = await document.embedFont(
    StandardFonts.Helvetica
  );

  const pages = document.getPages();

  const totalPages = pages.length;

  for (const [index, page] of pages.entries()) {

    if (skipCover && index === 0) {
      continue;
    }

    const pageNumber = index + 1;

    const { width } = page.getSize();

    const label = showTotalPages
      ? `Pagina ${pageNumber} van ${totalPages}`
      : `Pagina ${pageNumber}`;

    const textWidth = font.widthOfTextAtSize(
      label,
      fontSize
    );

    page.drawText(label, {
      x: (width - textWidth) / 2,
      y: bottomOffset,
      size: fontSize,
      font,
      color: rgb(0.47, 0.47, 0.47)
    });
  }

  return document.save();
}
