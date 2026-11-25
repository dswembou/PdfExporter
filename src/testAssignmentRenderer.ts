
import "dotenv/config";
import { chromium } from "playwright";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  getCanvasAssignment
} from "./canvasAssignments.js";

import {
  embedCanvasImages
} from "./canvasImages.js";

import {
  renderAssignment,
  assignmentStyles
} from "./assignmentRenderer.js";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

async function main() {

  const assignmentIds = [55043, 55044, 55045];

  const window = new JSDOM("").window;
  const purify = createDOMPurify(window);

  try {

    const sections: string[] = [];

    for (const assignmentId of assignmentIds) {

      const assignment = await getCanvasAssignment(
        baseUrl!,
        token!,
        courseId!,
        assignmentId
      );

      console.log(`\nOpdracht verwerken: ${assignment.name}`);

      const sanitizedContent = purify.sanitize(
        assignment.description ?? "",
        {
          FORBID_TAGS: [
            "script",
            "iframe",
            "object",
            "embed",
            "form",
            "svg",
            "math"
          ],
          FORBID_ATTR: [
            "style",
            "srcset"
          ]
        }
      );

      const embeddedContent = await embedCanvasImages(
        sanitizedContent,
        baseUrl!,
        token!
      );

      const safeContent = purify.sanitize(
        embeddedContent,
        {
          FORBID_TAGS: [
            "script", "iframe", "object",
            "embed", "form", "svg", "math"
          ],
          FORBID_ATTR: ["style", "srcset"]
        }
      );

      sections.push(
        renderAssignment(assignment, safeContent)
      );

      console.log("Opdracht succesvol verwerkt.");
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
            overflow-wrap: anywhere;
          }

          .assignment + .assignment {
            break-before: page;
          }

          ${assignmentStyles}

        </style>
      </head>

      <body>
        ${sections.join("\n")}
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
        "canvas-assignment-test.pdf"
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

      console.log("\nOpdrachten-PDF succesvol gegenereerd!");
      console.log(`Aantal opdrachten: ${sections.length}`);
      console.log(`Bestand: ${outputPath}`);

    } finally {
      await browser.close();
    }

  } finally {
    window.close();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
