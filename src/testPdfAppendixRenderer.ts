
import "dotenv/config";

import { chromium } from "playwright";

import {
  readFile,
  mkdir
} from "node:fs/promises";

import path from "node:path";

import { getCanvasFile } from "./canvasFiles.js";
import { analyzePdf } from "./pdfAnalyzer.js";

import {
  createPdfAppendix,
  renderPdfAppendixReference,
  renderPdfAppendixCover,
  pdfAppendixStyles
} from "./pdfAppendixRenderer.js";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

async function main() {

  console.log("PDF-bijlagetest gestart...");

  const file = await getCanvasFile(
    baseUrl!,
    token!,
    courseId!,
    738767
  );

  console.log(`Bestand: ${file.display_name}`);

  const inputPath = path.join(
    process.cwd(),
    "output",
    "canvas-downloaded-pdf-test.pdf"
  );

  const pdfBytes = await readFile(inputPath);

  const analysis = await analyzePdf(pdfBytes);

  console.log(
    `Aantal oorspronkelijke pagina's: ${analysis.pageCount}`
  );

  const appendix = createPdfAppendix(
    1,
    file,
    analysis,
    "Testmodule PDF Exporter"
  );

  console.log("Bijlagegegevens aangemaakt.");

  const reference = renderPdfAppendixReference(
    appendix
  );

  const cover = renderPdfAppendixCover(
    appendix
  );

  console.log("Bijlageverwijzing gegenereerd.");
  console.log("Bijlagevoorblad gegenereerd.");

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
          line-height: 1.6;
        }

        h1 {
          color: #17365d;
        }

        h2 {
          color: #245a81;
        }

        ${pdfAppendixStyles}

      </style>
    </head>

    <body>

      <h1>Hoofdstuk 1</h1>

      <h2>Testmodule PDF Exporter</h2>

      <p>
        Hieronder staat een PDF-bestand dat
        als bijlage in het lesboek wordt opgenomen.
      </p>

      ${reference}

      ${cover}

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

    const target = page.locator(
      `#${appendix.anchorId}`
    );

    if (await target.count() !== 1) {
      throw new Error(
        "Bijlagevoorblad niet gevonden."
      );
    }

    const link = page.locator(
      `.appendix-reference a[href="#${appendix.anchorId}"]`
    );

    if (await link.count() !== 1) {
      throw new Error(
        "Interne bijlageverwijzing ontbreekt."
      );
    }

    console.log("Interne verwijzing in HTML gecontroleerd.");

    const outputDir = path.join(
      process.cwd(),
      "output"
    );

    await mkdir(outputDir, {
      recursive: true
    });

    const outputPath = path.join(
      outputDir,
      "canvas-pdf-appendix-test.pdf"
    );

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="
          font-size: 9px;
          width: 100%;
          text-align: center;
          color: #777;
        ">
          Pagina <span class="pageNumber"></span>
        </div>
      `,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "20mm",
        right: "20mm"
      }
    });

    console.log("\nPDF succesvol gegenereerd!");
    console.log(`Bestand: ${outputPath}`);

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
