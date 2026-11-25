import {
  addPdfPageNumbers
} from "./pdfPageNumbering.js";
import {
  PDFDocument,
  StandardFonts,
  PageSizes,
  degrees,
  rgb
} from "pdf-lib";

import { chromium } from "playwright";

import {
  mkdir,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import {
  mergePdfAppendices
} from "./pdfAppendixMerger.js";

import {
  validatePdfInternalLinks
} from "./pdfLinkValidator.js";

import {
  analyzePdf
} from "./pdfAnalyzer.js";

interface TestPage {
  label: string;
  size: [number, number];
  rotation: number;
}

async function createTestAppendix(
  pages: TestPage[]
): Promise<Uint8Array> {

  const document = await PDFDocument.create();

  const font = await document.embedFont(
    StandardFonts.Helvetica
  );

  const boldFont = await document.embedFont(
    StandardFonts.HelveticaBold
  );

  for (const specification of pages) {

    const page = document.addPage(
      specification.size
    );

    page.setRotation(
      degrees(specification.rotation)
    );

    const { width, height } = page.getSize();

    const margin = 20;
    const markerSize = 25;

    // Rode markering: linksboven.

    page.drawRectangle({
      x: margin,
      y: height - margin - markerSize,
      width: markerSize,
      height: markerSize,
      color: rgb(0.86, 0.15, 0.15)
    });

    // Blauwe markering: rechtsboven.

    page.drawRectangle({
      x: width - margin - markerSize,
      y: height - margin - markerSize,
      width: markerSize,
      height: markerSize,
      color: rgb(0.15, 0.39, 0.92)
    });

    // Groene markering: linksonder.

    page.drawRectangle({
      x: margin,
      y: margin,
      width: markerSize,
      height: markerSize,
      color: rgb(0.09, 0.64, 0.29)
    });

    // Gele markering: rechtsonder.

    page.drawRectangle({
      x: width - margin - markerSize,
      y: margin,
      width: markerSize,
      height: markerSize,
      color: rgb(0.92, 0.70, 0.03)
    });

    // Kader om afsnijding te kunnen herkennen.

    page.drawRectangle({
      x: 10,
      y: 10,
      width: width - 20,
      height: height - 20,
      borderWidth: 1,
      borderColor: rgb(0.5, 0.5, 0.5)
    });

    const title = specification.label;

    const titleSize = 20;

    const titleWidth = boldFont.widthOfTextAtSize(
      title,
      titleSize
    );

    page.drawText(title, {
      x: (width - titleWidth) / 2,
      y: height / 2 + 20,
      size: titleSize,
      font: boldFont
    });

    const details =
      `Rotatie: ${specification.rotation} graden`;

    const detailsWidth = font.widthOfTextAtSize(
      details,
      12
    );

    page.drawText(details, {
      x: (width - detailsWidth) / 2,
      y: height / 2 - 10,
      size: 12,
      font
    });

    page.drawText("BOVENKANT", {
      x: width / 2 - 40,
      y: height - 50,
      size: 12,
      font: boldFont
    });

    page.drawText("ONDERKANT", {
      x: width / 2 - 40,
      y: 40,
      size: 12,
      font: boldFont
    });
  }

  return document.save();
}

async function createMainDocument(): Promise<Uint8Array> {

  const html = `
    <!DOCTYPE html>
    <html lang="nl">

    <head>
      <meta charset="UTF-8">

      <style>

        @page {
          size: A4;
          margin: 20mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #222;
        }

        h1 {
          color: #17365d;
        }

        a {
          color: #245a81;
        }

        .appendix-cover {
          break-before: page;
          text-align: center;
          padding-top: 100px;
        }

      </style>
    </head>

    <body>

      <h1>Test meerdere PDF-bijlagen</h1>

      <h2>Inhoudsopgave</h2>

      <p>
        <a href="#appendix-1">
          Ga naar bijlage 1
        </a>
      </p>

      <p>
        <a href="#appendix-2">
          Ga naar bijlage 2
        </a>
      </p>

      <section
        class="appendix-cover"
        id="appendix-1"
      >
        <h1>Bijlage 1</h1>
        <p>Verschillende papierformaten</p>
      </section>

      <section
        class="appendix-cover"
        id="appendix-2"
      >
        <h1>Bijlage 2</h1>
        <p>Verschillende paginarotaties</p>
      </section>

    </body>
    </html>
  `;

  const browser = await chromium.launch({
    headless: true
  });

  try {

    const page = await browser.newPage({
      javaScriptEnabled: false
    });

    await page.route("**/*", route => route.abort());

    await page.setContent(html, {
      waitUntil: "load"
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "20mm",
        right: "20mm"
      }
    });

  } finally {
    await browser.close();
  }
}

async function main() {

  console.log("Test meerdere PDF-bijlagen gestart...");

  const [a4Width, a4Height] = PageSizes.A4;

  const appendix1 = await createTestAppendix([
    {
      label: "A4 - Staand",
      size: PageSizes.A4,
      rotation: 0
    },
    {
      label: "A4 - Liggend",
      size: [a4Height, a4Width],
      rotation: 0
    },
    {
      label: "A3 - Staand",
      size: PageSizes.A3,
      rotation: 0
    }
  ]);

  const appendix2 = await createTestAppendix([
    {
      label: "A5 - Staand",
      size: PageSizes.A5,
      rotation: 0
    },
    {
      label: "A4 - Rotatie 90",
      size: PageSizes.A4,
      rotation: 90
    },
    {
      label: "A4 - Rotatie 180",
      size: PageSizes.A4,
      rotation: 180
    },
    {
      label: "A4 - Rotatie 270",
      size: PageSizes.A4,
      rotation: 270
    }
  ]);

  console.log("Twee testbijlagen gegenereerd.");

  const mainPdf = await createMainDocument();

  const originalAnalysis = await analyzePdf(mainPdf);

  if (originalAnalysis.pageCount !== 3) {
    throw new Error(
      "Hoofddocument moet precies 3 pagina's bevatten."
    );
  }

  console.log("Hoofddocument gegenereerd.");

  const result = await mergePdfAppendices(
    mainPdf,
    [
      {
        number: 1,
        filename: "test-formaten.pdf",
        bytes: appendix1,
        insertAfterPage: 2
      },
      {
        number: 2,
        filename: "test-rotaties.pdf",
        bytes: appendix2,
        insertAfterPage: 3
      }
    ]
  );

  console.log("\n--- Bijlagenoverzicht ---");

  for (const appendix of result.appendices) {

    console.log(
      `Bijlage ${appendix.number}: ` +
      `pagina ${appendix.firstPage} t/m ` +
      `${appendix.lastPage}`
    );
  }

  if (result.totalPageCount !== 10) {
    throw new Error(
      "Het resultaat moet 10 pagina's bevatten."
    );
  }

  const analysis = await analyzePdf(result.bytes);

  console.log("\n--- Paginaformaten ---");

  const expectedOrientations = [
    "portrait",
    "portrait",
    "portrait",
    "landscape",
    "portrait",
    "portrait",
    "portrait",
    "landscape",
    "portrait",
    "landscape"
  ];

  for (const page of analysis.pages) {

    console.log(
      `Pagina ${page.pageNumber}: ` +
      `${page.format}, ${page.orientation}`
    );

    if (page.format !== "A4") {
      throw new Error(
        `Pagina ${page.pageNumber} is geen A4.`
      );
    }

    if (
      page.orientation !==
      expectedOrientations[page.pageNumber - 1]
    ) {
      throw new Error(
        `Onjuiste orientatie op pagina ${page.pageNumber}.`
      );
    }
  }

  const links = await validatePdfInternalLinks(
    result.bytes
  );

  console.log("\n--- Hyperlinkvalidatie ---");

  for (const link of links.links) {

    console.log(
      `Pagina ${link.sourcePage} -> ` +
      `pagina ${link.targetPage}`
    );
  }

  if (
    links.totalInternalLinks !== 2 ||
    links.invalidLinks !== 0
  ) {
    throw new Error(
      "Interne hyperlinks zijn niet correct behouden."
    );
  }

  for (const targetPage of [2, 6]) {

    const found = links.links.some(
      link =>
        link.sourcePage === 1 &&
        link.targetPage === targetPage &&
        link.valid
    );

    if (!found) {
      throw new Error(
        `Verwijzing naar pagina ${targetPage} ontbreekt.`
      );
    }
  }

  const outputDir = path.join(
    process.cwd(),
    "output"
  );

  await mkdir(outputDir, {
    recursive: true
  });

  await writeFile(
    path.join(outputDir, "test-appendix-formats.pdf"),
    appendix1
  );

  await writeFile(
    path.join(outputDir, "test-appendix-rotations.pdf"),
    appendix2
  );

  const outputPath = path.join(
    outputDir,
    "canvas-multiple-appendices-test.pdf"
  );

  
console.log("\nDefinitieve paginanummering toevoegen...");

const numberedPdf = await addPdfPageNumbers(
  result.bytes,
  {
    showTotalPages: true,
    fontSize: 9,
    bottomOffset: 25,
    skipCover: false
  }
);

// Hyperlinks na paginanummering opnieuw controleren.

const finalValidation =
  await validatePdfInternalLinks(numberedPdf);

if (
  finalValidation.pageCount !== 10 ||
  finalValidation.totalInternalLinks !== 2 ||
  finalValidation.invalidLinks !== 0
) {
  throw new Error(
    "PDF-validatie na paginanummering mislukt."
  );
}

for (const targetPage of [2, 6]) {

  const found = finalValidation.links.some(
    link =>
      link.sourcePage === 1 &&
      link.targetPage === targetPage &&
      link.valid
  );

  if (!found) {
    throw new Error(
      `Verwijzing naar pagina ${targetPage} ontbreekt.`
    );
  }
}

console.log("Definitieve paginanummering toegevoegd.");
console.log("Interne hyperlinks opnieuw gevalideerd.");

await writeFile(outputPath, numberedPdf);


  console.log("\n--- Acceptatiecontrole ---");
  console.log("Aantal pagina's correct: 10");
  console.log("Alle pagina's zijn A4.");
  console.log("Alle paginaorientaties zijn correct.");
  console.log("Beide interne hyperlinks zijn geldig.");
  console.log("Bijlagevoorbladen correct bereikbaar.");

  console.log("\nAutomatische test geslaagd!");
  console.log(`Bestand: ${outputPath}`);
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
