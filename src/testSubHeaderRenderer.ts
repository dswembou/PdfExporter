
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  renderSubHeader,
  subHeaderStyles
} from "./subHeaderRenderer.js";

async function main() {

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

        ${subHeaderStyles}

      </style>
    </head>

    <body>

      <h1>Hoofdstuk 1</h1>
      <h2>Testmodule PDF Exporter</h2>

      ${renderSubHeader("testkop")}

      <p>Hieronder komen de bestanden, hyperlinks
      en discussies uit de Canvas-module.</p>

      ${renderSubHeader("tweede testkop")}

      <h2>1.1 Reguliere pagina</h2>

      <p>Dit is een voorbeeld van reguliere
      lesstof onder een tekstkop.</p>

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

    const outputDir = path.join(
      process.cwd(),
      "output"
    );

    await mkdir(outputDir, {
      recursive: true
    });

    const outputPath = path.join(
      outputDir,
      "canvas-subheader-test.pdf"
    );

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true
    });

    console.log("SubHeader-PDF succesvol gegenereerd!");
    console.log(`Bestand: ${outputPath}`);

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
