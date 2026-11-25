
import "dotenv/config";

import assert from "node:assert/strict";

import {
  mkdir,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import { chromium } from "playwright";

import {
  getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  pdfJsConfig
} from "./pdfJsConfig.js";

import {
  getCanvasFile,
  classifyCanvasFile
} from "./canvasFiles.js";

import {
  downloadCanvasFile,
  hasPdfSignature
} from "./canvasFileDownloader.js";

import {
  analyzePdf
} from "./pdfAnalyzer.js";

import {
  createPdfAppendix,
  renderPdfAppendixReference,
  renderPdfAppendixCover,
  pdfAppendixStyles
} from "./pdfAppendixRenderer.js";

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

const FILE_ID = 738767;

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error(
    "Canvas-configuratie ontbreekt."
  );
}

function escapeHtml(text: string): string {

  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return text.replace(
    /[&<>"']/g,
    character => map[character]
  );
}

async function getPdfPageTexts(
  bytes: Uint8Array
): Promise<string[]> {

  const loadingTask = getDocument({
    ...pdfJsConfig,
    data: new Uint8Array(bytes)
  });

  try {

    const document = await loadingTask.promise;

    const texts: string[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= document.numPages;
      pageNumber++
    ) {

      const page = await document.getPage(
        pageNumber
      );

      const content = await page.getTextContent();

      const text = content.items
        .map(item =>
          "str" in item ? item.str : ""
        )
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      texts.push(text);
    }

    return texts;

  } finally {

    await loadingTask.destroy();
  }
}

async function main() {

  console.log(
    "Integrale Canvas-bijlagetest gestart..."
  );

  // STAP 1: Bestandsmetadata ophalen.

  console.log(
    "\n--- Canvas-bestand ophalen ---"
  );

  const file = await getCanvasFile(
    baseUrl!,
    token!,
    courseId!,
    FILE_ID
  );

  assert.equal(file.id, FILE_ID);

  assert.equal(
    classifyCanvasFile(file),
    "pdf"
  );

  console.log(`Bestand: ${file.display_name}`);
  console.log(`Bestands-ID: ${file.id}`);
  console.log(`Bestandsgrootte: ${file.size} bytes`);

  // STAP 2: PDF downloaden.

  console.log(
    "\n--- PDF downloaden ---"
  );

  const appendixBytes =
    await downloadCanvasFile(
      file,
      baseUrl!,
      token!
    );

  assert.ok(
    hasPdfSignature(appendixBytes),
    "Ongeldige PDF-signatuur."
  );

  assert.equal(
    appendixBytes.length,
    file.size,
    "Bestandsgrootte komt niet overeen."
  );

  console.log(
    "PDF succesvol gedownload."
  );

  // STAP 3: PDF analyseren.

  console.log(
    "\n--- PDF analyseren ---"
  );

  const appendixAnalysis =
    await analyzePdf(appendixBytes);

  assert.equal(
    appendixAnalysis.encrypted,
    false
  );

  assert.ok(
    appendixAnalysis.pageCount > 0
  );

  console.log(
    `Aantal pagina's: ${appendixAnalysis.pageCount}`
  );

  console.log(
    `Formaten: ${appendixAnalysis.formats.join(", ")}`
  );

  // STAP 4: Bijlage voorbereiden.

  console.log(
    "\n--- Bijlage voorbereiden ---"
  );

  const appendix = createPdfAppendix(
    1,
    file,
    appendixAnalysis,
    "Testmodule PDF Exporter"
  );

  const referenceHtml =
    renderPdfAppendixReference(appendix);

  const coverHtml =
    renderPdfAppendixCover(appendix);

  const tocEntries = [
    {
      id: "chapter-1",
      title: "Hoofdstuk 1 - Testmodule"
    },
    {
      id: appendix.anchorId,
      title: `Bijlage 1 - ${file.display_name}`
    },
    {
      id: "chapter-2",
      title: "Hoofdstuk 2 - Nacontrole"
    }
  ];

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
          line-height: 1.6;
          color: #222;
          overflow-wrap: anywhere;
        }

        h1 {
          color: #17365d;
        }

        .cover {
          text-align: center;
          padding-top: 120px;
        }

        .toc,
        .chapter {
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

        ${pdfAppendixStyles}

      </style>

    </head>

    <body>

      <section class="cover">

        <h1>Canvas PDF Exporter</h1>

        <h2>Integrale acceptatietest</h2>

        <p>
          PDF-bijlagen vanuit Canvas
        </p>

      </section>

      <section class="toc">

        <h1>Inhoudsopgave</h1>

        <ol>

          ${tocEntries.map(entry => `
            <li>

              <a href="#${entry.id}">
                ${escapeHtml(entry.title)}
              </a>

              <span class="toc-dots"></span>

              <span class="toc-page">000</span>

            </li>
          `).join("\n")}

        </ol>

      </section>

      <section
        class="chapter"
        id="chapter-1"
      >

        <h1>Hoofdstuk 1 - Testmodule</h1>

        <p>
          Het onderstaande PDF-bestand is
          rechtstreeks opgehaald uit Canvas.
        </p>

        ${referenceHtml}

      </section>

      ${coverHtml}

      <section
        class="chapter"
        id="chapter-2"
      >

        <h1>Hoofdstuk 2 - Nacontrole</h1>

        <p>
          Dit hoofdstuk bevindt zich achter
          de ingevoegde PDF-bijlage.
        </p>

        <p>
          Hiermee controleren we of ook
          reguliere hoofdstukken correct
          verschuiven na het invoegen van
          een PDF-document.
        </p>

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

    await page.route(
      "**/*",
      route => route.abort()
    );

    await page.setContent(html, {
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

    // STAP 5: Eerste PDF-generatie.

    console.log(
      "\n--- Eerste PDF-generatie ---"
    );

    const draftPdf =
      await page.pdf(pdfOptions);

    const draftAnalysis =
      await analyzePdf(draftPdf);

    assert.equal(
      draftAnalysis.pageCount,
      5
    );

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

    // STAP 6: Definitieve posities berekenen.

    console.log(
      "\n--- Definitieve posities berekenen ---"
    );

    const placements = [
      {
        number: 1,
        insertAfterPage: originalPageNumbers[1],
        pageCount: appendixAnalysis.pageCount
      }
    ];

    const mapping =
      createPdfPagePositionMap(
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
      [
        3,
        4,
        5 + appendixAnalysis.pageCount
      ]
    );

    console.table(
      tocEntries.map((entry, index) => ({
        title: entry.title,
        original: originalPageNumbers[index],
        final: finalPageNumbers[index]
      }))
    );

    // STAP 7: Inhoudsopgave actualiseren.

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

    assert.deepEqual(
      correctedDestinations.map(
        destination => destination.targetPage
      ),
      originalPageNumbers
    );

    // STAP 8: Canvas-bijlage invoegen.

    console.log(
      "\n--- Canvas-bijlage invoegen ---"
    );

    const merged = await mergePdfAppendices(
      correctedPdf,
      [
        {
          number: 1,
          filename: file.display_name,
          bytes: appendixBytes,
          insertAfterPage:
            placements[0].insertAfterPage
        }
      ]
    );

    assert.equal(
      merged.totalPageCount,
      mapping.totalPageCount
    );

    assert.equal(
      merged.appendices.length,
      1
    );

    assert.equal(
      merged.appendices[0].firstPage,
      mapping.appendices[0].firstPage
    );

    assert.equal(
      merged.appendices[0].lastPage,
      mapping.appendices[0].lastPage
    );

    // STAP 9: Definitieve paginanummering.

    console.log(
      "\n--- Paginanummering toevoegen ---"
    );

    const finalPdf =
      await addPdfPageNumbers(
        merged.bytes,
        {
          showTotalPages: true,
          skipCover: false
        }
      );

    // STAP 10: Eindvalidatie.

    console.log(
      "\n--- Eindvalidatie ---"
    );

    const finalDestinations =
      await getPdfLinkDestinations(
        finalPdf,
        tocEntries.length
      );

    assert.deepEqual(
      finalDestinations.map(
        destination => destination.targetPage
      ),
      finalPageNumbers
    );

    const validation =
      await validatePdfInternalLinks(
        finalPdf
      );

    assert.equal(
      validation.pageCount,
      mapping.totalPageCount
    );

    assert.equal(
      validation.totalInternalLinks,
      4
    );

    assert.equal(
      validation.invalidLinks,
      0
    );

    assert.ok(
      validation.links.some(
        link =>
          link.sourcePage === 3 &&
          link.targetPage === 4 &&
          link.valid
      )
    );

    for (const link of validation.links) {

      console.log(
        `Pagina ${link.sourcePage} -> ` +
        `pagina ${link.targetPage}`
      );
    }

    // STAP 11: Zichtbare tekst controleren.

    const pageTexts =
      await getPdfPageTexts(finalPdf);

    const tocText = pageTexts[1];

    assert.match(
      tocText,
      /Hoofdstuk 1 - Testmodule\s+3\b/
    );

    assert.ok(
      tocText.includes(
        `Bijlage 1 - ${file.display_name} 4`
      )
    );

    assert.ok(
      tocText.includes(
        `Hoofdstuk 2 - Nacontrole ${finalPageNumbers[2]}`
      )
    );

    assert.ok(
      pageTexts[finalPageNumbers[2] - 1]
        .includes("Hoofdstuk 2 - Nacontrole")
    );

    for (
      let index = 0;
      index < pageTexts.length;
      index++
    ) {

      const expectedFooter =
        `Pagina ${index + 1} van ${mapping.totalPageCount}`;

      assert.ok(
        pageTexts[index].includes(expectedFooter),
        `Paginavoettekst ontbreekt op pagina ${index + 1}.`
      );
    }

    console.log(
      "Inhoudsopgave en paginavoetteksten correct."
    );

    // STAP 12: Bestanden opslaan.

    const outputDir = path.join(
      process.cwd(),
      "output"
    );

    await mkdir(outputDir, {
      recursive: true
    });

    await writeFile(
      path.join(
        outputDir,
        "canvas-appendix-original.pdf"
      ),
      appendixBytes
    );

    const outputPath = path.join(
      outputDir,
      "canvas-appendix-integration-test.pdf"
    );

    await writeFile(
      outputPath,
      finalPdf
    );

    console.log(
      "\n--- Eindresultaat ---"
    );

    console.log(
      `Oorspronkelijke pagina's: ${mapping.originalPageCount}`
    );

    console.log(
      `Bijlagepagina's: ${mapping.insertedPageCount}`
    );

    console.log(
      `Totaal aantal pagina's: ${mapping.totalPageCount}`
    );

    console.log(
      `Geldige hyperlinks: ${validation.validLinks}`
    );

    console.log(
      `Ongeldige hyperlinks: ${validation.invalidLinks}`
    );

    console.log(
      "\nIntegrale Canvas-bijlagetest geslaagd!"
    );

    console.log(
      `Bestand: ${outputPath}`
    );

  } finally {

    await browser.close();
  }
}

main().catch(error => {

  console.error("Fout:", error);

  process.exitCode = 1;
});
