import { pdfJsConfig } from "./pdfJsConfig.js";
import assert from "node:assert/strict";

import {
  readFile,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import { chromium } from "playwright";

import {
  getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  getPdfLinkDestinations
} from "./pdfPageMapper.js";

import {
  createPdfPagePositionMap,
  getFinalPageNumber
} from "./pdfPagePositionMapper.js";

import {
  mergePdfAppendices
} from "./pdfAppendixMerger.js";

import {
  addPdfPageNumbers
} from "./pdfPageNumbering.js";

import {
  validatePdfInternalLinks
} from "./pdfLinkValidator.js";

import {
  analyzePdf
} from "./pdfAnalyzer.js";

const tocEntries = [
  {
    id: "chapter-1",
    title: "Hoofdstuk 1"
  },
  {
    id: "appendix-1",
    title: "Bijlage 1"
  },
  {
    id: "appendix-2",
    title: "Bijlage 2"
  }
];

function createHtml(): string {

  return `
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
          line-height: 1.6;
        }

        h1 {
          color: #17365d;
        }

        .cover {
          text-align: center;
          padding-top: 120px;
        }

        .toc,
        .chapter,
        .appendix-cover {
          break-before: page;
        }

        .toc ol {
          list-style: none;
          padding: 0;
        }

        .toc li {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 15px;
          break-inside: avoid;
        }

        .toc a {
          color: #222;
          text-decoration: none;
        }

        .toc-dots {
          flex: 1;
          border-bottom: 1px dotted #999;
        }

        .toc-page {
          flex: 0 0 50px;
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .appendix-cover {
          text-align: center;
          padding-top: 120px;
        }

      </style>
    </head>

    <body>

      <section class="cover">

        <h1>Canvas PDF Exporter</h1>

        <h2>
          Integratietest PDF-bijlagen
        </h2>

        <p>
          Inhoudsopgave en paginanummering
        </p>

      </section>

      <section class="toc">

        <h1>Inhoudsopgave</h1>

        <ol>

          ${tocEntries.map(entry => `
            <li>
              <a href="#${entry.id}">
                ${entry.title}
              </a>

              <span class="toc-dots"></span>

              <span class="toc-page">000</span>
            </li>
          `).join("\n")}

        </ol>

      </section>

      <section class="chapter" id="chapter-1">

        <h1>Hoofdstuk 1</h1>

        <p>
          Dit hoofdstuk bevat verwijzingen
          naar twee PDF-bijlagen.
        </p>

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

      </section>

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
}

async function getPdfPageText(
  bytes: Uint8Array,
  pageNumber: number
): Promise<string> {

    const loadingTask = getDocument({
    ...pdfJsConfig,
    data: new Uint8Array(bytes)
    });

  try {

    const document = await loadingTask.promise;

    const page = await document.getPage(
      pageNumber
    );

    const content = await page.getTextContent();

    return content.items
      .map(item => "str" in item ? item.str : "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  } finally {

    await loadingTask.destroy();
  }
}

async function main() {

  console.log(
    "Integratietest inhoudsopgave gestart..."
  );

  const outputDir = path.join(
    process.cwd(),
    "output"
  );

  const appendix1 = await readFile(
    path.join(
      outputDir,
      "test-appendix-formats.pdf"
    )
  );

  const appendix2 = await readFile(
    path.join(
      outputDir,
      "test-appendix-rotations.pdf"
    )
  );

  const appendix1Analysis =
    await analyzePdf(appendix1);

  const appendix2Analysis =
    await analyzePdf(appendix2);

  assert.equal(appendix1Analysis.pageCount, 3);
  assert.equal(appendix2Analysis.pageCount, 4);

  console.log("Bijlage 1: 3 pagina's");
  console.log("Bijlage 2: 4 pagina's");

  const browser = await chromium.launch({
    headless: true
  });

  try {

    const page = await browser.newPage({
      javaScriptEnabled: false
    });

    await page.route(
      "**/*",
      route => route.abort()
    );

    await page.setContent(createHtml(), {
      waitUntil: "load"
    });

    const pdfOptions = {

      format: "A4" as const,

      printBackground: true,

      displayHeaderFooter: false,

      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "20mm",
        right: "20mm"
      }
    };

    // STAP 1: Eerste PDF-generatie.

    console.log(
      "\n--- Eerste PDF-generatie ---"
    );

    const draftPdf = await page.pdf(pdfOptions);

    const draftAnalysis =
      await analyzePdf(draftPdf);

    assert.equal(draftAnalysis.pageCount, 5);

    const originalDestinations =
      await getPdfLinkDestinations(
        draftPdf,
        tocEntries.length
      );

    const originalPageNumbers =
      originalDestinations.map(
        destination => destination.targetPage
      );

    assert.deepEqual(
      originalPageNumbers,
      [3, 4, 5]
    );

    console.log(
      "Oorspronkelijke bestemmingen:",
      originalPageNumbers
    );

    // STAP 2: Definitieve posities berekenen.

    console.log(
      "\n--- Definitieve posities berekenen ---"
    );

    const placements = [
      {
        number: 1,
        insertAfterPage: originalPageNumbers[1],
        pageCount: appendix1Analysis.pageCount
      },
      {
        number: 2,
        insertAfterPage: originalPageNumbers[2],
        pageCount: appendix2Analysis.pageCount
      }
    ];

    const mapping = createPdfPagePositionMap(
      draftAnalysis.pageCount,
      placements
    );

    const finalPageNumbers =
      originalPageNumbers.map(
        pageNumber => getFinalPageNumber(
          mapping,
          pageNumber
        )
      );

    assert.deepEqual(
      finalPageNumbers,
      [3, 4, 8]
    );

    assert.equal(mapping.totalPageCount, 12);

    console.table(
      tocEntries.map((entry, index) => ({
        title: entry.title,
        original: originalPageNumbers[index],
        final: finalPageNumbers[index]
      }))
    );

    // STAP 3: Inhoudsopgave actualiseren.

    console.log(
      "\n--- Inhoudsopgave actualiseren ---"
    );

    await page.evaluate(
      (numbers: number[]) => {

        const elements =
          document.querySelectorAll(".toc-page");

        if (elements.length !== numbers.length) {

          throw new Error(
            "Aantal inhoudsopgave-items klopt niet."
          );
        }

        elements.forEach((element, index) => {

          element.textContent =
            String(numbers[index]);
        });

      },
      finalPageNumbers
    );

    // STAP 4: Tweede PDF-generatie.

    console.log(
      "\n--- Tweede PDF-generatie ---"
    );

    const correctedPdf =
      await page.pdf(pdfOptions);

    const correctedAnalysis =
      await analyzePdf(correctedPdf);

    assert.equal(
      correctedAnalysis.pageCount,
      draftAnalysis.pageCount
    );

    const correctedDestinations =
      await getPdfLinkDestinations(
        correctedPdf,
        tocEntries.length
      );

    const correctedPageNumbers =
      correctedDestinations.map(
        destination => destination.targetPage
      );

    assert.deepEqual(
      correctedPageNumbers,
      originalPageNumbers,
      "Paginaverdeling is gewijzigd."
    );

    console.log(
      "Oorspronkelijke paginaverdeling behouden."
    );

    // STAP 5: Bijlagen invoegen.

    console.log(
      "\n--- Bijlagen invoegen ---"
    );

    const merged = await mergePdfAppendices(
      correctedPdf,
      [
        {
          number: 1,
          filename: "test-appendix-formats.pdf",
          bytes: appendix1,
          insertAfterPage: placements[0].insertAfterPage
        },
        {
          number: 2,
          filename: "test-appendix-rotations.pdf",
          bytes: appendix2,
          insertAfterPage: placements[1].insertAfterPage
        }
      ]
    );

    assert.equal(
      merged.totalPageCount,
      mapping.totalPageCount
    );

    for (const appendix of merged.appendices) {

      const expected = mapping.appendices.find(
        item => item.number === appendix.number
      );

      assert.ok(expected);

      assert.equal(
        appendix.firstPage,
        expected.firstPage
      );

      assert.equal(
        appendix.lastPage,
        expected.lastPage
      );
    }

    // STAP 6: Definitieve paginanummering.

    console.log(
      "\n--- Paginanummering toevoegen ---"
    );

    const finalPdf = await addPdfPageNumbers(
      merged.bytes,
      {
        showTotalPages: true,
        skipCover: false
      }
    );

    // STAP 7: Inhoudsopgave valideren.

    console.log(
      "\n--- Inhoudsopgave valideren ---"
    );

    const finalDestinations =
      await getPdfLinkDestinations(
        finalPdf,
        tocEntries.length
      );

    const actualPageNumbers =
      finalDestinations.map(
        destination => destination.targetPage
      );

    assert.deepEqual(
      actualPageNumbers,
      finalPageNumbers
    );

    console.log(
      "Verwachte bestemmingen:",
      finalPageNumbers
    );

    console.log(
      "Werkelijke bestemmingen:",
      actualPageNumbers
    );

    // Controleer ook de zichtbare tekst
    // van de inhoudsopgave.

    const tocText = await getPdfPageText(
      finalPdf,
      2
    );

    assert.match(
      tocText,
      /Hoofdstuk 1\s+3\b/
    );

    assert.match(
      tocText,
      /Bijlage 1\s+4\b/
    );

    assert.match(
      tocText,
      /Bijlage 2\s+8\b/
    );

    console.log(
      "Zichtbare paginanummers zijn correct."
    );

    // STAP 8: Alle hyperlinks valideren.

    console.log(
      "\n--- Hyperlinks valideren ---"
    );

    const validation =
      await validatePdfInternalLinks(finalPdf);

    assert.equal(validation.pageCount, 12);

    assert.equal(
      validation.totalInternalLinks,
      5
    );

    assert.equal(validation.invalidLinks, 0);

    for (const link of validation.links) {

      console.log(
        `Pagina ${link.sourcePage} -> ` +
        `pagina ${link.targetPage}`
      );
    }

    // Controleer de verwijzingen
    // vanuit het hoofdstuk.

    for (const targetPage of [4, 8]) {

      assert.ok(
        validation.links.some(
          link =>
            link.sourcePage === 3 &&
            link.targetPage === targetPage &&
            link.valid
        )
      );
    }

    // STAP 9: Paginavoetteksten valideren.

    console.log(
      "\n--- Paginanummering valideren ---"
    );

    for (
      let pageNumber = 1;
      pageNumber <= validation.pageCount;
      pageNumber++
    ) {

      const text = await getPdfPageText(
        finalPdf,
        pageNumber
      );

      const expectedFooter =
        `Pagina ${pageNumber} van 12`;

      assert.ok(
        text.includes(expectedFooter),
        `Paginanummer ontbreekt op pagina ${pageNumber}.`
      );
    }

    console.log(
      "Alle 12 paginavoetteksten zijn correct."
    );

    // STAP 10: Resultaat opslaan.

    const outputPath = path.join(
      outputDir,
      "canvas-toc-appendices-test.pdf"
    );

    await writeFile(outputPath, finalPdf);

    console.log(
      "\n--- Eindresultaat ---"
    );

    console.log("Oorspronkelijke pagina's: 5");
    console.log("Bijlagepagina's: 7");
    console.log("Totaal aantal pagina's: 12");
    console.log("Geldige interne hyperlinks: 5");
    console.log("Ongeldige interne hyperlinks: 0");

    console.log(
      "\nIntegratietest succesvol afgerond!"
    );

    console.log(`Bestand: ${outputPath}`);

  } finally {

    await browser.close();
  }
}

main().catch(error => {

  console.error("Fout:", error);

  process.exitCode = 1;
});
