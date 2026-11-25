
import {
  PDFDocument,
  StandardFonts,
  rgb
} from "pdf-lib";

import {
  mkdir,
  writeFile
} from "node:fs/promises";

import path from "node:path";

async function main() {

  console.log("PDF-lib test gestart...");

  // Eerste PDF-document maken.

  const mainDocument = await PDFDocument.create();

  const mainFont = await mainDocument.embedFont(
    StandardFonts.Helvetica
  );

  const mainPage = mainDocument.addPage([
    595.28,
    841.89
  ]);

  mainPage.drawText("Canvas PDF Exporter", {
    x: 50,
    y: 780,
    size: 24,
    font: mainFont,
    color: rgb(0.09, 0.21, 0.36)
  });

  mainPage.drawText(
    "Dit is het oorspronkelijke lesboek.",
    {
      x: 50,
      y: 740,
      size: 12,
      font: mainFont
    }
  );

  console.log("Hoofddocument aangemaakt.");

  // Tweede PDF-document maken.

  const appendixDocument = await PDFDocument.create();

  const appendixFont = await appendixDocument.embedFont(
    StandardFonts.Helvetica
  );

  for (let i = 1; i <= 2; i++) {

    const appendixPage = appendixDocument.addPage([
      595.28,
      841.89
    ]);

    appendixPage.drawText(
      `Bijlage - pagina ${i}`,
      {
        x: 50,
        y: 780,
        size: 24,
        font: appendixFont,
        color: rgb(0.09, 0.21, 0.36)
      }
    );

    appendixPage.drawText(
      "Dit is inhoud uit een afzonderlijk PDF-document.",
      {
        x: 50,
        y: 740,
        size: 12,
        font: appendixFont
      }
    );
  }

  console.log("Bijlagedocument aangemaakt.");

  // Bijlage opslaan en opnieuw inladen.

  const appendixBytes = await appendixDocument.save();

  const loadedAppendix = await PDFDocument.load(
    appendixBytes
  );

  console.log(
    `Aantal bijlagepagina's: ${loadedAppendix.getPageCount()}`
  );

  // Pagina's kopieren naar het hoofddocument.

  const copiedPages = await mainDocument.copyPages(
    loadedAppendix,
    loadedAppendix.getPageIndices()
  );

  for (const copiedPage of copiedPages) {
    mainDocument.addPage(copiedPage);
  }

  console.log("PDF-documenten samengevoegd.");

  // Doorlopende paginanummers toevoegen.

  const pages = mainDocument.getPages();

  for (const [index, page] of pages.entries()) {

    const { width } = page.getSize();

    const pageNumber =
      `Pagina ${index + 1} van ${pages.length}`;

    const fontSize = 10;

    const textWidth = mainFont.widthOfTextAtSize(
      pageNumber,
      fontSize
    );

    page.drawText(pageNumber, {
      x: (width - textWidth) / 2,
      y: 25,
      size: fontSize,
      font: mainFont,
      color: rgb(0.4, 0.4, 0.4)
    });
  }

  console.log("Paginanummers toegevoegd.");

  // Resultaat opslaan.

  const outputDir = path.join(
    process.cwd(),
    "output"
  );

  await mkdir(outputDir, {
    recursive: true
  });

  const outputPath = path.join(
    outputDir,
    "canvas-pdf-merge-test.pdf"
  );

  const mergedBytes = await mainDocument.save();

  await writeFile(outputPath, mergedBytes);

  // Opgeslagen resultaat valideren.

  const validatedDocument = await PDFDocument.load(
    mergedBytes
  );

  if (validatedDocument.getPageCount() !== 3) {
    throw new Error(
      "Het samengevoegde document bevat niet 3 pagina's."
    );
  }

  console.log("\nPDF succesvol gegenereerd!");

  console.log(
    `Totaal aantal pagina's: ${validatedDocument.getPageCount()}`
  );

  console.log(`Bestand: ${outputPath}`);
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
