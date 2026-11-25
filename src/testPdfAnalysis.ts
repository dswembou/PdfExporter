
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

    const maxPages = Math.min(5, pdf.numPages);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const text = content.items
        .map(item => {
          if ("str" in item) {
            return item.str + (item.hasEOL ? "\n" : " ");
          }
          return "";
        })
        .join("");

      console.log(`\n--- Pagina ${pageNumber} ---`);
      console.log(text.substring(0, 500));
    }

    console.log("\nPDF-analyse succesvol afgerond!");
  } finally {
    await loadingTask.destroy();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
