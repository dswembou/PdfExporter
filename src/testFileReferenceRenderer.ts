
import "dotenv/config";

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  getCanvasFile,
  classifyCanvasFile
} from "./canvasFiles.js";

import {
  renderFileReference,
  fileReferenceStyles
} from "./fileReferenceRenderer.js";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

async function main() {

  console.log("Bestandsverwijzing-test gestart...");

  const fileIds = [
    738772,
    738773
  ];

  const renderedFiles: string[] = [];

  for (const fileId of fileIds) {

    console.log(`\nBestandsmetadata ophalen: ${fileId}`);

    const file = await getCanvasFile(
      baseUrl!,
      token!,
      courseId!,
      fileId
    );

    console.log(`Bestand: ${file.display_name}`);
    console.log(`Categorie: ${classifyCanvasFile(file)}`);

    const renderedFile = renderFileReference(
      file,
      baseUrl!,
      courseId!
    );

    renderedFiles.push(renderedFile);

    console.log("Bestandsverwijzing gegenereerd.");
  }

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

        ${fileReferenceStyles}

      </style>
    </head>

    <body>

      <h1>Test bestandsverwijzingen</h1>

      ${renderedFiles.join("\n")}

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

    const links = await page
      .locator(".file-reference-link")
      .count();

    if (links !== fileIds.length) {
      throw new Error(
        "Aantal bestandsverwijzingen komt niet overeen."
      );
    }

    console.log(`\nAantal hyperlinks: ${links}`);

    const outputDir = path.join(
      process.cwd(),
      "output"
    );

    await mkdir(outputDir, {
      recursive: true
    });

    const outputPath = path.join(
      outputDir,
      "canvas-file-reference-test.pdf"
    );

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true
    });

    console.log("PDF succesvol gegenereerd!");
    console.log(`Bestand: ${outputPath}`);

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
