
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPdfLinkDestinations } from "./pdfPageMapper.js";

async function main() {

  const pdfPath = path.join(
    process.cwd(),
    "output",
    "canvas-volledige-cursus.pdf"
  );

  const buffer = await readFile(pdfPath);

  const destinations = await getPdfLinkDestinations(
    buffer,
    93
  );

  console.log("Paginamapping succesvol uitgevoerd!");
  console.log(`Aantal bestemmingen: ${destinations.length}`);

  console.log("\nEerste 15 bestemmingen:");

  destinations.slice(0, 15).forEach((destination, index) => {
    console.log(
      `${index + 1}. Inhoudsopgave pagina ${destination.sourcePage}` +
      ` -> Lesboek pagina ${destination.targetPage}`
    );
  });

  console.log("\nLaatste 5 bestemmingen:");

  destinations.slice(-5).forEach((destination, index) => {
    console.log(
      `${destinations.length - 4 + index}. ` +
      `Inhoudsopgave pagina ${destination.sourcePage}` +
      ` -> Lesboek pagina ${destination.targetPage}`
    );
  });
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});