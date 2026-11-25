import { pdfJsConfig } from "./pdfJsConfig.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfLinkDestination {
  sourcePage: number;
  targetPage: number;
  x: number;
  y: number;
}

export async function getPdfLinkDestinations(
  pdfBuffer: Uint8Array,
  expectedLinks: number
): Promise<PdfLinkDestination[]> {

  const loadingTask = getDocument({
  ...pdfJsConfig,
  data: new Uint8Array(pdfBuffer)
});

  const pdf = await loadingTask.promise;

  const results: PdfLinkDestination[] = [];

  try {
    // De eerste pagina is het voorblad.
    // De inhoudsopgave begint op pagina 2.

    for (
      let pageNumber = 2;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);
      const annotations = await page.getAnnotations();

      const pageLinks: PdfLinkDestination[] = [];

      for (const annotation of annotations) {
        if (annotation.subtype !== "Link") {
          continue;
        }

        let destination = annotation.dest;

        if (typeof destination === "string") {
          destination = await pdf.getDestination(destination);
        }

        if (!Array.isArray(destination) || !destination.length) {
          continue;
        }

        const pageRef = destination[0];

        let pageIndex: number;

        if (typeof pageRef === "number") {
          pageIndex = pageRef;
        } else if (pageRef && typeof pageRef === "object") {
          pageIndex = await pdf.getPageIndex(pageRef);
        } else {
          continue;
        }

        const rect = annotation.rect ?? [0, 0, 0, 0];

        pageLinks.push({
          sourcePage: pageNumber,
          targetPage: pageIndex + 1,
          x: rect[0],
          y: rect[3]
        });
      }

      // Sorteer links op hun visuele leesvolgorde.
      pageLinks.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 2) {
          return b.y - a.y;
        }

        return a.x - b.x;
      });

      results.push(...pageLinks);

      if (results.length >= expectedLinks) {
        break;
      }
    }

    if (results.length !== expectedLinks) {
      throw new Error(
        `Verwacht: ${expectedLinks} links, gevonden: ${results.length}`
      );
    }

    return results;

  } finally {
    await loadingTask.destroy();
  }
}
