
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  validatePdfInternalLinks
} from "./pdfLinkValidator.js";

async function main() {

  console.log("PDF-hyperlinkvalidatie gestart...");

  const outputDir = path.join(
    process.cwd(),
    "output"
  );

  const originalBytes = await readFile(
    path.join(
      outputDir,
      "canvas-pdf-appendix-test.pdf"
    )
  );

  const mergedBytes = await readFile(
    path.join(
      outputDir,
      "canvas-pdf-appendix-merged-test.pdf"
    )
  );

  console.log("\n--- Oorspronkelijk document ---");

  const originalResult =
    await validatePdfInternalLinks(originalBytes);

  console.log(
    `Aantal pagina's: ${originalResult.pageCount}`
  );

  console.log(
    `Interne hyperlinks: ${originalResult.totalInternalLinks}`
  );

  console.log(
    `Geldige hyperlinks: ${originalResult.validLinks}`
  );

  console.log(
    `Ongeldige hyperlinks: ${originalResult.invalidLinks}`
  );

  for (const link of originalResult.links) {

    console.log(
      `Pagina ${link.sourcePage} -> pagina ${link.targetPage}`
    );
  }

  console.log("\n--- Samengevoegd document ---");

  const mergedResult =
    await validatePdfInternalLinks(mergedBytes);

  console.log(
    `Aantal pagina's: ${mergedResult.pageCount}`
  );

  console.log(
    `Interne hyperlinks: ${mergedResult.totalInternalLinks}`
  );

  console.log(
    `Geldige hyperlinks: ${mergedResult.validLinks}`
  );

  console.log(
    `Ongeldige hyperlinks: ${mergedResult.invalidLinks}`
  );

  for (const link of mergedResult.links) {

    console.log(
      `Pagina ${link.sourcePage} -> pagina ${link.targetPage}`
    );

    if (link.error) {
      console.log(`  Fout: ${link.error}`);
    }
  }

  console.log("\n--- Acceptatiecontrole ---");

  if (originalResult.totalInternalLinks !== 1) {

    throw new Error(
      "Oorspronkelijk document moet één interne hyperlink bevatten."
    );
  }

  if (originalResult.invalidLinks > 0) {

    throw new Error(
      "Oorspronkelijk document bevat ongeldige hyperlinks."
    );
  }

  if (
    originalResult.totalInternalLinks !==
    mergedResult.totalInternalLinks
  ) {

    throw new Error(
      "Aantal interne hyperlinks is gewijzigd."
    );
  }

  if (mergedResult.invalidLinks > 0) {

    throw new Error(
      "Samengevoegd document bevat ongeldige hyperlinks."
    );
  }

  const appendixLink = mergedResult.links.find(
    link =>
      link.sourcePage === 1 &&
      link.targetPage === 2 &&
      link.valid
  );

  if (!appendixLink) {

    throw new Error(
      "Bijlageverwijzing navigeert niet naar het juiste voorblad."
    );
  }

  console.log("Aantal hyperlinks behouden.");
  console.log("Alle interne hyperlinks zijn geldig.");
  console.log("Bijlageverwijzing navigeert naar pagina 2.");

  console.log("\nPDF-hyperlinkvalidatie succesvol afgerond!");
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
