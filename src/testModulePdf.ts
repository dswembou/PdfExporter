import { embedCanvasImages } from "./canvasImages.js";
import "dotenv/config";
import { chromium } from "playwright";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface CanvasModule {
  id: number;
  name: string;
  position: number;
}

interface CanvasModuleItem {
  id: number;
  title: string;
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

async function canvasGet<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Canvas API-fout: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchAll<T>(apiPath: string): Promise<T[]> {
  const results: T[] = [];
  const url = new URL(apiPath, canvasOrigin);
  url.searchParams.set("per_page", "100");

  let nextUrl: string | null = url.toString();

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

    const linkHeader = response.headers.get("link");
    const nextLink = linkHeader
      ?.split(",")
      .find(link => /rel="next"/.test(link));

    nextUrl =
      nextLink?.match(/<([^>]+)>/)?.[1] ?? null;
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
  console.log("Canvas-modules ophalen...");

  const modules = await fetchAll<CanvasModule>(
    `${coursePath}/modules`
  );

  modules.sort((a, b) => a.position - b.position);

  const firstModule = modules[0];

  if (!firstModule) {
    throw new Error("Geen modules gevonden.");
  }

  console.log(`Module: ${firstModule.name}`);

  const items = await fetchAll<CanvasModuleItem>(
    `${coursePath}/modules/${firstModule.id}/items`
  );

  const pageItems = items
    .filter(item => item.type === "Page" && item.page_url)
    .sort((a, b) => a.position - b.position);

  console.log(`Aantal Canvas-pagina's: ${pageItems.length}`);

  if (pageItems.length === 0) {
    throw new Error("Deze module bevat geen Canvas-pagina's.");
  }

  const window = new JSDOM("").window;
  const purify = createDOMPurify(window);

  try {
    const sections: string[] = [];

    for (const [index, item] of pageItems.entries()) {
      const canvasPage = await canvasGet<CanvasPage>(
        `${canvasOrigin}${coursePath}/pages/` +
        encodeURIComponent(item.page_url!)
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

      sections.push(`
        <section class="lesson">
          <h2>${index + 1}. ${escapeHtml(canvasPage.title)}</h2>
          <div>${safeContent}</div>
        </section>
      `);

      console.log(`Toegevoegd: ${canvasPage.title}`);
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
            border-bottom: 1px solid #ddd;
            padding-bottom: 8px;
            break-after: avoid;
          }

          .chapter-cover {
            text-align: center;
            padding-top: 100px;
            break-after: page;
          }

          .lesson {
            break-before: page;
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
        <section class="chapter-cover">
          <h1>${escapeHtml(firstModule.name)}</h1>
          <p>Canvas PDF Exporter</p>
        </section>

        ${sections.join("\n")}
      </body>
      </html>
    `;

    const browser = await chromium.launch({
      headless: true
    });

    try {
      const page = await browser.newPage();

      // Externe netwerkverzoeken blijven geblokkeerd.
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
        "canvas-module.pdf"
      );

      await writeFile(outputPath, pdf);

      console.log("\nPDF succesvol gegenereerd!");
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
