
import "dotenv/config";

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  renderExternalUrl,
  externalUrlStyles
} from "./externalUrlRenderer.js";

interface CanvasModule {
  id: number;
  name: string;
}

interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  external_url?: string;
}

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

const canvasOrigin = new URL(baseUrl).origin;

async function canvasGetAll<T>(
  apiPath: string
): Promise<T[]> {

  const results: T[] = [];

  const firstUrl = new URL(apiPath, canvasOrigin);
  firstUrl.searchParams.set("per_page", "100");

  let nextUrl: string | null = firstUrl.href;

  while (nextUrl) {

    const url = new URL(nextUrl);

    if (url.origin !== canvasOrigin) {
      throw new Error("Onverwachte API-host.");
    }

    const response = await fetch(url, {
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Canvas API-fout: ${response.status}`
      );
    }

    results.push(...await response.json() as T[]);

    const nextLink = response.headers
      .get("link")
      ?.split(",")
      .find(link => /rel="next"/.test(link));

    nextUrl =
      nextLink?.match(/<([^>]+)>/)?.[1] ?? null;
  }

  return results;
}

async function main() {

  console.log("Externe URL-test gestart...");

  const coursePath =
    `/api/v1/courses/${encodeURIComponent(courseId!)}`;

  const modules = await canvasGetAll<CanvasModule>(
    `${coursePath}/modules`
  );

  const testModule = modules.find(
    module => module.name === "Testmodule PDF Exporter"
  );

  if (!testModule) {
    throw new Error("Testmodule niet gevonden.");
  }

  console.log(`Module gevonden: ${testModule.name}`);

  const items = await canvasGetAll<CanvasModuleItem>(
    `${coursePath}/modules/${testModule.id}/items`
  );

  const externalItems = items.filter(
    item => item.type === "ExternalUrl"
  );

  if (!externalItems.length) {
    throw new Error("Geen externe URL-items gevonden.");
  }

  const renderedItems: string[] = [];

  for (const item of externalItems) {

    console.log(`Titel: ${item.title}`);
    console.log(`URL: ${item.external_url}`);

    renderedItems.push(
      renderExternalUrl(
        item.title,
        item.external_url ?? ""
      )
    );
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
        }

        h1 {
          color: #17365d;
        }

        ${externalUrlStyles}

      </style>
    </head>

    <body>

      <h1>Test externe hyperlinks</h1>

      ${renderedItems.join("\n")}

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
      "canvas-external-url-test.pdf"
    );

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true
    });

    console.log("PDF succesvol gegenereerd!");
    console.log(`Bestand: ${outputPath}`);

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
