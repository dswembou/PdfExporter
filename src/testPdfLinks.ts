
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const pdfPath = path.join(
    process.cwd(),
    "output",
    "canvas-volledige-cursus.pdf"
  );

  console.log("PDF inlezen...");

  const buffer = await readFile(pdfPath);

  const loadingTask = getDocument({
    data: new Uint8Array(buffer)
  });

  const pdf = await loadingTask.promise;

  try {
    console.log(`Aantal PDF-pagina's: ${pdf.numPages}`);

    let totalLinks = 0;
    let resolvedLinks = 0;

    const maxPages = Math.min(5, pdf.numPages);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const annotations = await page.getAnnotations();

      console.log(`\n--- Pagina ${pageNumber} ---`);
      console.log(`Aantal annotaties: ${annotations.length}`);

      for (const annotation of annotations) {
        if (annotation.subtype !== "Link") {
          continue;
        }

        totalLinks++;

        let destination = annotation.dest;

        if (typeof destination === "string") {
          destination = await pdf.getDestination(destination);
        }

        if (!Array.isArray(destination) || !destination.length) {
          if (totalLinks <= 25) {
            console.log("Geen interne bestemming:", annotation.url ?? annotation.dest);
          }
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

        resolvedLinks++;

        if (resolvedLinks <= 25) {
          console.log(
            `Link ${resolvedLinks}: pagina ${pageNumber} -> pagina ${pageIndex + 1}`
          );
        }
      }
    }

    console.log("\n--- Samenvatting ---");
    console.log(`Aantal gevonden links: ${totalLinks}`);
    console.log(`Aantal opgeloste interne links: ${resolvedLinks}`);
    console.log("Analyse succesvol afgerond!");

  } finally {
    await loadingTask.destroy();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
