
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
  type: string;
  page_url?: string;
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

const canvasUrl = new URL(baseUrl);
const coursePath =
  `/api/v1/courses/${encodeURIComponent(courseId)}`;

async function canvasGet<T>(apiPath: string): Promise<T> {
  const url = new URL(apiPath, canvasUrl.origin);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Canvas API-fout: HTTP ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

async function main() {
  console.log("Canvas-pagina ophalen...");

  const modules = await canvasGet<CanvasModule[]>(
    `${coursePath}/modules?per_page=100`
  );

  modules.sort((a, b) => a.position - b.position);

  let pageUrl: string | undefined;

  for (const module of modules) {
    const items = await canvasGet<CanvasModuleItem[]>(
      `${coursePath}/modules/${module.id}/items?per_page=100`
    );

    pageUrl = items.find(
      item => item.type === "Page" && item.page_url
    )?.page_url;

    if (pageUrl) break;
  }

  if (!pageUrl) {
    throw new Error("Geen Canvas-pagina gevonden.");
  }

  const canvasPage = await canvasGet<CanvasPage>(
    `${coursePath}/pages/${encodeURIComponent(pageUrl)}`
  );

  console.log(`Gevonden: ${canvasPage.title}`);

  // Verwijder potentieel uitvoerbare HTML.
  const window = new JSDOM("").window;
  const purify = createDOMPurify(window);

  const safeContent = purify.sanitize(
    canvasPage.body ?? "",
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
      FORBID_ATTR: ["style", "srcset"]
    }
  );

  const html = `
    <!DOCTYPE html>
    <html lang="nl">
    <head>
      <meta charset="UTF-8">
      <title>Canvas-lesdocument</title>
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

        h1 {
          font-size: 28px;
          color: #17365d;
        }

        h2, h3 {
          color: #245a81;
          break-after: avoid;
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

        a {
          color: #245a81;
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(canvasPage.title)}</h1>
      <main>${safeContent}</main>
    </body>
    </html>
  `;

  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();

    // Voor deze eerste proef blokkeren we alle
    // externe netwerkverzoeken vanuit Chromium.
    // Afbeeldingen worden in een volgende stap
    // via een gecontroleerde route verwerkt.
    await page.route("**/*", async route => {
      await route.abort();
    });

    await page.setContent(html, {
      waitUntil: "load"
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "20mm",
        right: "20mm"
      }
    });

    const outputDir = path.join(
      process.cwd(),
      "output"
    );

    await mkdir(outputDir, { recursive: true });

    const outputPath = path.join(
      outputDir,
      "canvas-testpagina.pdf"
    );

    await writeFile(outputPath, pdf);

    console.log("PDF succesvol gegenereerd!");
    console.log(`Bestand: ${outputPath}`);
  } finally {
    await browser.close();
    window.close();
  }
}

main().catch(error => {
  console.error("Fout:", error);
  process.exitCode = 1;
});
