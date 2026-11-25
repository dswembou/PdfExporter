
import "dotenv/config";

import {
  mkdir,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import {
  getCanvasFile,
  classifyCanvasFile,
  formatFileSize
} from "./canvasFiles.js";

import {
  downloadCanvasFile,
  hasPdfSignature
} from "./canvasFileDownloader.js";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error(
    "Canvas-configuratie ontbreekt."
  );
}

async function main() {

  console.log("Canvas PDF-downloadtest gestart...");

  const fileId = 738767;

  console.log(
    `Bestandsmetadata ophalen: ${fileId}`
  );

  const file = await getCanvasFile(
    baseUrl!,
    token!,
    courseId!,
    fileId
  );

  console.log(`Bestand: ${file.display_name}`);
  console.log(`MIME-type: ${file["content-type"]}`);

  console.log(
    `Verwachte grootte: ${formatFileSize(file.size)}`
  );

  if (classifyCanvasFile(file) !== "pdf") {
    throw new Error(
      "Het geselecteerde bestand is geen PDF."
    );
  }

  console.log("\nPDF-bestand downloaden...");

  const pdfBytes = await downloadCanvasFile(
    file,
    baseUrl!,
    token!
  );

  console.log("Download voltooid.");

  console.log(
    `Gedownloade grootte: ${formatFileSize(pdfBytes.byteLength)}`
  );

  if (!hasPdfSignature(pdfBytes)) {
    throw new Error(
      "Het gedownloade bestand heeft geen geldige PDF-signatuur."
    );
  }

  console.log("PDF-signatuur gecontroleerd: geldig.");

  if (pdfBytes.byteLength !== file.size) {
    throw new Error(
      "Gedownloade bestandsgrootte wijkt af van de metadata."
    );
  }

  console.log("Bestandsgrootte komt overeen.");

  const outputDir = path.join(
    process.cwd(),
    "output"
  );

  await mkdir(outputDir, {
    recursive: true
  });

  const outputPath = path.join(
    outputDir,
    "canvas-downloaded-pdf-test.pdf"
  );

  await writeFile(
    outputPath,
    pdfBytes
  );

  console.log("\nPDF succesvol gedownload!");
  console.log(`Bestand: ${outputPath}`);
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
