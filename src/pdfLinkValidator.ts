import { pdfJsConfig } from "./pdfJsConfig.js";
import {
  getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfInternalLink {
  sourcePage: number;
  targetPage: number | null;
  valid: boolean;
  error?: string;
}

export interface PdfLinkValidationResult {
  pageCount: number;
  totalInternalLinks: number;
  validLinks: number;
  invalidLinks: number;
  links: PdfInternalLink[];
}

export async function validatePdfInternalLinks(
  bytes: Uint8Array
): Promise<PdfLinkValidationResult> {

  const loadingTask = getDocument({
    ...pdfJsConfig,
    data: new Uint8Array(bytes)
  });

  try {

    const pdf = await loadingTask.promise;

    const links: PdfInternalLink[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {

      const page = await pdf.getPage(pageNumber);

      const annotations =
        await page.getAnnotations();

      for (const annotation of annotations) {

        if (annotation.subtype !== "Link") {
          continue;
        }

        // Externe hyperlinks worden hier niet getest.

        if (
          annotation.url ||
          annotation.unsafeUrl
        ) {
          continue;
        }

        if (annotation.dest == null) {
          continue;
        }

        try {

          let destination = annotation.dest;

          if (typeof destination === "string") {

            destination =
              await pdf.getDestination(destination);
          }

          if (
            !Array.isArray(destination) ||
            destination.length === 0
          ) {

            links.push({
              sourcePage: pageNumber,
              targetPage: null,
              valid: false,
              error: "Bestemming ontbreekt."
            });

            continue;
          }

          const pageReference = destination[0];

          let targetPage: number;

          if (typeof pageReference === "number") {

            targetPage = pageReference + 1;

          } else if (
            pageReference &&
            typeof pageReference === "object"
          ) {

            const pageIndex =
              await pdf.getPageIndex(pageReference);

            targetPage = pageIndex + 1;

          } else {

            throw new Error(
              "Ongeldige paginaverwijzing."
            );
          }

          const valid =
            Number.isInteger(targetPage) &&
            targetPage >= 1 &&
            targetPage <= pdf.numPages;

          links.push({
            sourcePage: pageNumber,
            targetPage,
            valid,
            error: valid
              ? undefined
              : "Bestemmingspagina bestaat niet."
          });

        } catch (error) {

          links.push({
            sourcePage: pageNumber,
            targetPage: null,
            valid: false,
            error: error instanceof Error
              ? error.message
              : String(error)
          });
        }
      }
    }

    return {
      pageCount: pdf.numPages,
      totalInternalLinks: links.length,
      validLinks: links.filter(link => link.valid).length,
      invalidLinks: links.filter(link => !link.valid).length,
      links
    };

  } finally {

    await loadingTask.destroy();
  }
}
