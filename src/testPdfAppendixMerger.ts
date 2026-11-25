
import {
  readFile,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import { PDFDocument } from "pdf-lib";

import {
  mergePdfAppendices
} from "./pdfAppendixMerger.js";

async function main() {

  console.log("PDF-bijlagen samenvoegen gestart...");

  const outputDir = path.join(
    process.cwd(),
    "output"
  );

  const mainPdfPath = path.join(
    outputDir,
    "canvas-pdf-appendix-test.pdf"
  );

  const appendixPdfPath = path.join(
    outputDir,
    "canvas-downloaded-pdf-test.pdf"
  );

  const mainPdfBytes = await readFile(
    mainPdfPath
  );

  const appendixPdfBytes = await readFile(
    appendixPdfPath
  );

  const mainDocument = await PDFDocument.load(
    mainPdfBytes
  );

  const appendixDocument = await PDFDocument.load(
    appendixPdfBytes
  );

  const mainPageCount =
    mainDocument.getPageCount();

  const appendixPageCount =
    appendixDocument.getPageCount();

  console.log(
    `Pagina's hoofddocument: ${mainPageCount}`
  );

  console.log(
    `Pagina's oorspronkelijke bijlage: ${appendixPageCount}`
  );

  const expectedPageCount =
    mainPageCount + appendixPageCount;

  console.log(
    `Verwacht totaal: ${expectedPageCount}`
  );

  const result = await mergePdfAppendices(
    mainPdfBytes,
    [
      {
        number: 1,
        filename: "canvas-lesboek.pdf",
        bytes: appendixPdfBytes,
        insertAfterPage: 2
      }
    ]
  );

  const outputPath = path.join(
    outputDir,
    "canvas-pdf-appendix-merged-test.pdf"
  );

  await writeFile(
    outputPath,
    result.bytes
  );

  // Het opgeslagen resultaat opnieuw openen.

  const validatedDocument = await PDFDocument.load(
    await readFile(outputPath)
  );

  if (
    validatedDocument.getPageCount() !== expectedPageCount
  ) {
    throw new Error(
      "Aantal pagina's komt niet overeen."
    );
  }

  console.log("\n--- Samenvatting ---");

  console.log(
    `Oorspronkelijke pagina's: ${result.originalPageCount}`
  );

  console.log(
    `Totaal aantal pagina's: ${result.totalPageCount}`
  );

  for (const appendix of result.appendices) {

    console.log(`\nBijlage ${appendix.number}`);

    console.log(`Bestand: ${appendix.filename}`);

    console.log(
      `Eerste pagina: ${appendix.firstPage}`
    );

    console.log(
      `Laatste pagina: ${appendix.lastPage}`
    );

    console.log(
      `Aantal pagina's: ${appendix.pageCount}`
    );
  }

  console.log("\nPDF succesvol samengevoegd!");

  console.log(`Bestand: ${outputPath}`);
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
