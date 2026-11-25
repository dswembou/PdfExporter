
import "dotenv/config";

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { getCanvasFile } from "./canvasFiles.js";

import {
  renderImageFile,
  imageFileStyles
} from "./imageFileRenderer.js";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

async function main() {

  console.log("Afbeeldingsbestand-test gestart...");

  const fileId = 738771;

  console.log(`Bestandsmetadata ophalen: ${fileId}`);

  const file = await getCanvasFile(
    baseUrl!,
    token!,
    courseId!,
    fileId
  );

  console.log(`Bestand: ${file.display_name}`);
  console.log(`MIME-type: ${file["content-type"]}`);

  console.log("Afbeelding downloaden en insluiten...");

  const renderedImage = await renderImageFile(
    file,
    baseUrl!,
    token!,
    courseId!
  );

  console.log("Afbeelding succesvol ingesloten.");

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

        ${imageFileStyles}

      </style>
    </head>

    <body>

      <h1>Test afbeeldingsbestanden</h1>

      ${renderedImage}

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

    // Geen externe netwerkverzoeken toestaan.
    await page.route("**/*", route => route.abort());

    await page.setContent(html, {
      waitUntil: "load"
    });

    const image = page.locator(
      ".image-file-figure img"
    );

    const imageLoaded = await image.evaluate(
      (element: HTMLImageElement) =>
        element.complete &&
        element.naturalWidth > 0
    );

    if (!imageLoaded) {
      throw new Error(
        "Afbeelding kon niet worden weergegeven."
      );
    }

    console.log("Afbeelding is correct geladen.");

    const outputDir = path.join(
      process.cwd(),
      "output"
    );

    await mkdir(outputDir, {
      recursive: true
    });

    const outputPath = path.join(
      outputDir,
      "canvas-image-file-test.pdf"
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
