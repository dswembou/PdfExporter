
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

    const destinations = await pdf.getDestinations();
    const entries = Object.entries(destinations);

    console.log(`Aantal benoemde bestemmingen: ${entries.length}`);

    const results: {
      id: string;
      page: number;
    }[] = [];

    for (const [id, destination] of entries) {
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

      results.push({
        id,
        page: pageIndex + 1
      });
    }

    results.sort((a, b) => a.page - b.page);

    console.log("\nEerste 25 bestemmingen:");

    for (const result of results.slice(0, 25)) {
      console.log(`${result.id} -> Pagina ${result.page}`);
    }

    console.log(`\nTotaal gevonden: ${results.length}`);
    console.log("Analyse succesvol afgerond!");

  } finally {
    await loadingTask.destroy();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
