
import "dotenv/config";
import { chromium } from "playwright";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { embedCanvasImages } from "./canvasImages.js";

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
  type: string;
  position: number;
  page_url?: string;
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
    let totalPages = 0;

    for (const [moduleIndex, module] of modules.entries()) {
      console.log(
        `\nModule ${moduleIndex + 1}: ${module.name}`
      );

      const items = await fetchAll<CanvasModuleItem>(
        `${coursePath}/modules/${module.id}/items`
      );

      const pageItems = items
        .filter(item => item.type === "Page" && item.page_url)
        .sort((a, b) => a.position - b.position);

      const lessons: string[] = [];

      for (const [pageIndex, item] of pageItems.entries()) {
        const canvasPage = await canvasGet<CanvasPage>(
          `${coursePath}/pages/${encodeURIComponent(item.page_url!)}`
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

        const safeContent = await embedCanvasImages(
          sanitizedContent,
          baseUrl,
          token
        );

        lessons.push(`
          <section class="lesson">
            <h2>${moduleIndex + 1}.${pageIndex + 1}
              ${escapeHtml(canvasPage.title)}</h2>
            <div>${safeContent}</div>
          </section>
        `);

        totalPages++;
        console.log(`  Toegevoegd: ${canvasPage.title}`);
      }

      chapters.push(`
        <section class="chapter">
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
        </style>
      </head>
      <body>
        <section class="cover">
          <h1>${escapeHtml(course.name)}</h1>
          <p>${escapeHtml(course.course_code)}</p>
          <p>Canvas PDF Exporter</p>
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

      const pdf = await page.pdf({
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

      const outputDir = path.join(process.cwd(), "output");
      await mkdir(outputDir, { recursive: true });

      const outputPath = path.join(
        outputDir,
        "canvas-volledige-cursus.pdf"
      );

      await writeFile(outputPath, pdf);

      console.log("\nPDF succesvol gegenereerd!");
      console.log(`Modules verwerkt: ${modules.length}`);
      console.log(`Canvas-pagina's verwerkt: ${totalPages}`);
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
