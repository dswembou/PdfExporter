
import { readFile } from "node:fs/promises";
import path from "node:path";

import { analyzePdf } from "./pdfAnalyzer.js";

function translateOrientation(
  orientation: string
): string {

  const translations: Record<string, string> = {
    portrait: "Staand",
    landscape: "Liggend",
    square: "Vierkant"
  };

  return translations[orientation] ?? orientation;
}

async function main() {

  console.log("PDF-analyse gestart...");

  const inputPath = path.join(
    process.cwd(),
    "output",
    "canvas-downloaded-pdf-test.pdf"
  );

  console.log(`Bestand: ${inputPath}`);

  const bytes = await readFile(inputPath);

  const analysis = await analyzePdf(bytes);

  console.log("\n--- Documentinformatie ---");

  console.log(
    `Versleuteld: ${analysis.encrypted}`
  );

  if (analysis.encrypted) {
    throw new Error(
      "Versleutelde PDF wordt niet als bijlage verwerkt."
    );
  }

  console.log(`Aantal pagina's: ${analysis.pageCount}`);

  console.log(
    `Titel: ${analysis.title ?? "Niet ingesteld"}`
  );

  console.log(
    `Auteur: ${analysis.author ?? "Niet ingesteld"}`
  );

  console.log(
    `Onderwerp: ${analysis.subject ?? "Niet ingesteld"}`
  );

  console.log(
    `Creator: ${analysis.creator ?? "Niet ingesteld"}`
  );

  console.log(
    `Producer: ${analysis.producer ?? "Niet ingesteld"}`
  );

  console.log("\n--- Pagina-analyse ---");

  for (const page of analysis.pages) {

    console.log(`\nPagina ${page.pageNumber}`);

    console.log(
      `Afmetingen: ${page.widthMm} x ${page.heightMm} mm`
    );

    console.log(`Formaat: ${page.format}`);

    console.log(
      `Orientatie: ${translateOrientation(page.orientation)}`
    );

    console.log(`Rotatie: ${page.rotation} graden`);
  }

  console.log("\n--- Samenvatting ---");

  console.log(
    `Paginaformaten: ${analysis.formats.join(", ")}`
  );

  console.log(
    `Verschillende paginaformaten: ${analysis.mixedPageFormats}`
  );

  console.log(
    `Verschillende orientaties: ${analysis.mixedOrientations}`
  );

  console.log("\nPDF-analyse succesvol afgerond!");
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
