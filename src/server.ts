
import express from "express";
import { generatePdf } from "./pdfGenerator.js";

const app = express();
const PORT = 3000;

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="nl">
      <head>
        <meta charset="UTF-8">
        <title>Canvas PDF Exporter</title>
      </head>
      <body>
        <h1>Canvas PDF Exporter</h1>
        <p>Versie 0.2.0</p>
        <a href="/export">
          Download voorbeeldlesboek als PDF
        </a>
      </body>
    </html>
  `);
});

app.get("/export", async (_req, res) => {
  try {
    const pdf = await generatePdf();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="canvas-lesboek.pdf"'
    );

    res.send(pdf);
  } catch (error) {
    console.error("PDF-generatie mislukt:", error);
    res.status(500).send("PDF-generatie mislukt.");
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Canvas PDF Exporter draait op http://localhost:${PORT}`
  );
});
