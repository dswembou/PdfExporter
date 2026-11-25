
import "dotenv/config";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  getCanvasAssignment
} from "./canvasAssignments.js";

import {
  renderRubric,
  rubricStyles
} from "./rubricRenderer.js";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return map[char];
  });
}

async function main() {

  const assignmentIds = [55043, 55044, 55045];

  const sections: string[] = [];

  for (const assignmentId of assignmentIds) {

    const assignment = await getCanvasAssignment(
      baseUrl!,
      token!,
      courseId!,
      assignmentId
    );

    console.log(`Rubric verwerken: ${assignment.name}`);

    sections.push(`
      <section class="assignment-test">

        <h1>${escapeHtml(assignment.name)}</h1>

        <p>
          Maximaal te behalen opdrachtpunten:
          ${assignment.points_possible ?? "Niet ingesteld"}
        </p>

        ${renderRubric(assignment.rubric)}

      </section>
    `);
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
          line-height: 1.5;
        }

        h1 {
          color: #17365d;
          font-size: 24px;
        }

        .assignment-test + .assignment-test {
          break-before: page;
        }

        ${rubricStyles}

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

    const page = await browser.newPage();

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
      "canvas-rubric-test.pdf"
    );

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true
    });

    console.log("\nRubric-PDF succesvol gegenereerd!");
    console.log(`Aantal opdrachten: ${sections.length}`);
    console.log(`Bestand: ${outputPath}`);

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
