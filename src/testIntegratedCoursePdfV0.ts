import "dotenv/config";
import { chromium } from "playwright";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { embedCanvasImages } from "./canvasImages.js";
import { getPdfLinkDestinations } from "./pdfPageMapper.js";
import { getCanvasAssignment } from "./canvasAssignments.js";

import {
  renderAssignment,
  assignmentStyles
} from "./assignmentRenderer.js";
import {
  renderSubHeader,
  subHeaderStyles
} from "./subHeaderRenderer.js";

import {
  renderExternalUrl,
  externalUrlStyles
} from "./externalUrlRenderer.js";
interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
}

interface CanvasModule {
  id: number;
  name: string;
  position: number;
  published: boolean;
}

interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  position: number;
  page_url?: string;
  content_id?: number;
  external_url?: string;
  html_url?: string;
  indent?: number;
  published: boolean;
}

interface CanvasPage {
  title: string;
  body: string | null;
  published: boolean;
}

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

const canvasOrigin = new URL(baseUrl).origin;
const coursePath =
  `/api/v1/courses/${encodeURIComponent(courseId)}`;

async function canvasGet<T>(apiPath: string): Promise<T> {
  const response = await fetch(
    new URL(apiPath, canvasOrigin),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Canvas API-fout: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchAll<T>(apiPath: string): Promise<T[]> {
  const results: T[] = [];
  const firstUrl = new URL(apiPath, canvasOrigin);
  firstUrl.searchParams.set("per_page", "100");

  let nextUrl: string | null = firstUrl.toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Canvas API-fout: ${response.status}`);
    }

    const data = await response.json() as T[];
    results.push(...data);

    const nextLink = response.headers.get("link")
      ?.split(",")
      .find(link => /rel="next"/.test(link));

    nextUrl = nextLink?.match(/<([^>]+)>/)?.[1] ?? null;
  }

  return results;
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

function isSupportedModuleItem(
  item: CanvasModuleItem
): boolean {

  switch (item.type) {

    case "Page":
      return Boolean(item.page_url);

    case "Assignment":
      return Boolean(item.content_id);

    case "SubHeader":
      return true;

    case "ExternalUrl":
      return Boolean(item.external_url);

    default:
      return false;
  }
}

async function main() {
  console.log("Canvas-cursus ophalen...");

  const course = await canvasGet<CanvasCourse>(
    coursePath
  );

  console.log(`Cursus: ${course.name}`);

  const modules = await fetchAll<CanvasModule>(
    `${coursePath}/modules`
  );

  modules.sort((a, b) => a.position - b.position);

  console.log(`Aantal modules: ${modules.length}`);

  const window = new JSDOM("").window;
  const purify = createDOMPurify(window);

  try {
    const chapters: string[] = [];
    const tocEntries: string[] = [];
    let totalPages = 0;
    let totalAssignments = 0;
    let totalSubHeaders = 0;
    let totalExternalUrls = 0;
    let totalModuleItems = 0;
    let totalSkippedItems = 0;

    const moduleItemStatistics =
      new Map<string, number>();

    for (const [moduleIndex, module] of modules.entries()) {
        tocEntries.push(`
          <li class="toc-chapter">
            <a href="#chapter-${moduleIndex + 1}">
              ${moduleIndex + 1}. ${escapeHtml(module.name)}
            </a>
            <span class="toc-dots"></span>
            <span class="toc-page">000</span>
          </li>
        `);
      console.log(
        `\nModule ${moduleIndex + 1}: ${module.name}`
      );

      const items = await fetchAll<CanvasModuleItem>(
        `${coursePath}/modules/${module.id}/items`
      );

      
      const sortedItems = [...items]
        .sort((a, b) => a.position - b.position);

      const lessons: string[] = [];

      let numberedItemIndex = 0;

      for (const item of sortedItems) {
        totalModuleItems++;

        moduleItemStatistics.set(
          item.type,
          (moduleItemStatistics.get(item.type) ?? 0) + 1
        );
        if (!isSupportedModuleItem(item)) {
          totalSkippedItems++;
          console.log(
            `  Overgeslagen [${item.type}]: ${item.title}`
          );

          continue;
        }
        // CANVAS-TUSSENKOP VERWERKEN

        if (item.type === "SubHeader") {

          lessons.push(
            renderSubHeader(item.title)
          );

          totalSubHeaders++;

          console.log(
            `  Tussenkop toegevoegd: ${item.title}`
          );

          continue;
        }
        numberedItemIndex++;

        const itemNumber =
          `${moduleIndex + 1}.${numberedItemIndex}`;

        const anchorId =
          `lesson-${moduleIndex + 1}-${numberedItemIndex}`;

        // CANVAS-PAGINA VERWERKEN

        if (item.type === "Page" && item.page_url) {

          const canvasPage = await canvasGet<CanvasPage>(
            `${coursePath}/pages/${encodeURIComponent(item.page_url)}`
          );

          const sanitizedContent = purify.sanitize(
            canvasPage.body ?? "",
            {
              FORBID_TAGS: [
                "script", "iframe", "object",
                "embed", "form", "svg", "math"
              ],
              FORBID_ATTR: ["style", "srcset"]
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

          tocEntries.push(`
            <li class="toc-lesson">
              <a href="#${anchorId}">
                ${itemNumber} ${escapeHtml(canvasPage.title)}
              </a>
              <span class="toc-dots"></span>
              <span class="toc-page">000</span>
            </li>
          `);

          lessons.push(`
            <section class="lesson" id="${anchorId}">
              <h2>
                ${itemNumber} ${escapeHtml(canvasPage.title)}
              </h2>
              <div>${safeContent}</div>
            </section>
          `);

          totalPages++;

          console.log(`  Pagina toegevoegd: ${canvasPage.title}`);
        }

        // CANVAS-OPDRACHT VERWERKEN

        else if (item.type === "Assignment" && item.content_id) {

          const assignment = await getCanvasAssignment(
            baseUrl!,
            token!,
            courseId!,
            item.content_id
          );

          const sanitizedContent = purify.sanitize(
            assignment.description ?? "",
            {
              FORBID_TAGS: [
                "script", "iframe", "object",
                "embed", "form", "svg", "math"
              ],
              FORBID_ATTR: ["style", "srcset"]
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

          tocEntries.push(`
            <li class="toc-lesson toc-assignment">
              <a href="#${anchorId}">
                ${itemNumber} ${escapeHtml(assignment.name)}
                [Opdracht]
              </a>
              <span class="toc-dots"></span>
              <span class="toc-page">000</span>
            </li>
          `);

          lessons.push(`
            <section class="lesson" id="${anchorId}">
              ${renderAssignment(assignment, safeContent)}
            </section>
          `);

          totalAssignments++;

          console.log(`  Opdracht toegevoegd: ${assignment.name}`);
        }
        // CANVAS-EXTERNE WEBSITE VERWERKEN

        else if (
          item.type === "ExternalUrl" &&
          item.external_url
        ) {

          const externalUrlHtml = renderExternalUrl(
            item.title,
            item.external_url
          );

          tocEntries.push(`
            <li class="toc-lesson toc-external-url">

              <a href="#${anchorId}">
                ${itemNumber}
                ${escapeHtml(item.title)}
                [Externe bron]
              </a>

              <span class="toc-dots"></span>

              <span class="toc-page">000</span>

            </li>
          `);

          lessons.push(`
            <section class="lesson" id="${anchorId}">

              ${externalUrlHtml}

            </section>
          `);

          totalExternalUrls++;

          console.log(
            `  Externe website toegevoegd: ${item.title}`
          );
        }

      }


      chapters.push(`
        <section class="chapter" id="chapter-${moduleIndex + 1}">
          <h1>Hoofdstuk ${moduleIndex + 1}</h1>
          <h2>${escapeHtml(module.name)}</h2>
          ${lessons.join("\n")}
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
            line-height: 1.6;
            color: #222;
            overflow-wrap: anywhere;
          }

          h1 {
            color: #17365d;
            font-size: 30px;
          }

          h2 {
            color: #245a81;
            break-after: avoid;
          }

          .cover {
            text-align: center;
            padding-top: 150px;
            break-after: page;
          }

          .chapter {
            break-before: page;
          }

          .toc {
            break-before: page;
            break-after: page;
          }

          .toc ol {
            list-style: none;
            padding: 0;
          }

          .toc li {
            margin-bottom: 8px;
          }

          .toc a {
            color: #222;
            text-decoration: none;
          }

          .toc-chapter {
            font-size: 16px;
            font-weight: bold;
            margin-top: 18px;
          }

          .toc-lesson {
            font-size: 13px;
            padding-left: 24px;
          }

          .toc-lesson a {
            color: #555;
          }
          .lesson {
            margin-top: 30px;
          }

          img {
            max-width: 100%;
            height: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            border: 1px solid #aaa;
            padding: 8px;
          }

          pre {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            background: #f1f3f5;
            padding: 12px;
          }

          .toc li {
            display: flex;
            align-items: baseline;
            gap: 8px;
            break-inside: avoid;
          }

          .toc li a {
            min-width: 0;
          }

          .toc-dots {
            flex: 1;
            min-width: 10px;
            border-bottom: 1px dotted #999;
          }

          .toc-page {
            flex: 0 0 45px;
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }
          ${assignmentStyles}
          ${assignmentStyles}
          ${subHeaderStyles}
          ${externalUrlStyles}

          .toc-external-url a {
            font-style: italic;
            color: #245a81;
          }
          .toc-assignment a {
            font-style: italic;
            color: #245a81;
          }
        </style>
      </head>
      <body>
        <section class="cover">
          <h1>${escapeHtml(course.name)}</h1>
          <p>${escapeHtml(course.course_code)}</p>
          <p>Canvas PDF Exporter</p>
        </section>

        <section class="toc">
          <h1>Inhoudsopgave</h1>
          <ol>
            ${tocEntries.join("\n")}
          </ol>
        </section>

        ${chapters.join("\n")}
      </body>
      </html>
    `;

    const browser = await chromium.launch({
      headless: true
    });

    try {
      const page = await browser.newPage();

      // Afbeeldingen zijn al ingebed als data-URL.
      await page.route("**/*", route => route.abort());

      await page.setContent(html, {
        waitUntil: "load"
      });

      
      const pdfOptions = {
        format: "A4" as const,
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
      };

      console.log("\nEerste PDF-generatie...");

      const draftPdf = await page.pdf(pdfOptions);

      console.log("Paginanummers analyseren...");

      const destinations = await getPdfLinkDestinations(
        draftPdf,
        tocEntries.length
      );

      const pageNumbers = destinations.map(
        destination => destination.targetPage
      );

      console.log(
        `Aantal gekoppelde paginanummers: ${pageNumbers.length}`
      );

      // Paginanummers invoegen in de HTML.

      await page.evaluate((numbers: number[]) => {

        const elements = document.querySelectorAll(".toc-page");

        if (elements.length !== numbers.length) {
          throw new Error(
            "Aantal inhoudsopgave-items komt niet overeen."
          );
        }

        elements.forEach((element, index) => {
          element.textContent = String(numbers[index]);
        });

      }, pageNumbers);

      console.log("Tweede PDF-generatie...");

      const pdf = await page.pdf(pdfOptions);

      // Controleer de definitieve paginaverdeling.

      console.log("Paginanummers valideren...");

      const finalDestinations = await getPdfLinkDestinations(
        pdf,
        tocEntries.length
      );

      const isValid = finalDestinations.every(
        (destination, index) =>
          destination.targetPage === pageNumbers[index]
      );

      if (!isValid) {
        throw new Error(
          "Paginaverdeling is gewijzigd tijdens de tweede PDF-generatie."
        );
      }

      console.log("Alle paginanummers zijn correct!");


      const outputDir = path.join(process.cwd(), "output");
      await mkdir(outputDir, { recursive: true });
      console.log(
  "\n--- Moduleonderdelen statistieken ---"
);

for (const [type, count] of moduleItemStatistics) {

  console.log(`${type}: ${count}`);
}

console.log(
  `\nTotaal aangetroffen: ${totalModuleItems}`
);

console.log(
  `Totaal verwerkt: ${totalPages + totalAssignments}`
);

console.log(
  `Totaal overgeslagen: ${totalSkippedItems}`
);

if (
  totalModuleItems !==
  totalPages + totalAssignments + totalSkippedItems
) {

  throw new Error(
    "Moduleonderdelenstatistieken komen niet overeen."
  );
}

console.log(
  "Moduleonderdelenstatistieken gevalideerd."
);
      const outputPath = path.join(
        outputDir,
        "canvas-volledige-cursus.pdf"
      );

      await writeFile(outputPath, pdf);

      console.log("\nPDF succesvol gegenereerd!");
      console.log(`Modules verwerkt: ${modules.length}`);
      console.log(`Canvas-pagina's verwerkt: ${totalPages}`);
      console.log(`Canvas-opdrachten verwerkt: ${totalAssignments}`);
      console.log(
        `Totaal module-items verwerkt: ${totalPages + totalAssignments}`
      );
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
