
import "dotenv/config";

import {
  getCanvasFile,
  classifyCanvasFile,
  formatFileSize
} from "./canvasFiles.js";

interface CanvasModule {
  id: number;
  name: string;
}

interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  position: number;
  content_id?: number;
  published: boolean;
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

  console.log("Canvas-bestandsanalyse gestart...");

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

  const fileItems = items
    .filter(item =>
      item.type === "File" &&
      typeof item.content_id === "number"
    )
    .sort((a, b) => a.position - b.position);

  console.log(`Aantal bestanden: ${fileItems.length}`);

  let totalSize = 0;

  const categories: Record<string, number> = {};

  for (const item of fileItems) {

    const file = await getCanvasFile(
      baseUrl!,
      token!,
      courseId!,
      item.content_id!
    );

    const category = classifyCanvasFile(file);

    totalSize += file.size;

    categories[category] =
      (categories[category] ?? 0) + 1;

    console.log("\n--------------------------------");
    console.log(`Titel: ${item.title}`);
    console.log(`Bestands-ID: ${file.id}`);
    console.log(`Weergavenaam: ${file.display_name}`);
    console.log(`Bestandsnaam: ${file.filename}`);
    console.log(`MIME-type: ${file["content-type"]}`);
    console.log(`Categorie: ${category}`);
    console.log(`Grootte: ${formatFileSize(file.size)}`);
    console.log(`Gepubliceerd item: ${item.published}`);
    console.log(`Vergrendeld: ${file.locked}`);
    console.log(`Verborgen: ${file.hidden}`);
    console.log(`Vergrendeld voor gebruiker: ${file.locked_for_user}`);
    console.log(`Verborgen voor gebruiker: ${file.hidden_for_user}`);
    console.log(`Download-URL aanwezig: ${Boolean(file.url)}`);
    console.log(`Thumbnail aanwezig: ${Boolean(file.thumbnail_url)}`);
  }

  console.log("\n--- Samenvatting ---");
  console.log(`Aantal bestanden: ${fileItems.length}`);
  console.log(`Totale bestandsgrootte: ${formatFileSize(totalSize)}`);

  console.log("\nVerdeling per categorie:");

  for (const [category, count] of Object.entries(categories)) {
    console.log(`${category}: ${count}`);
  }

  console.log("\nBestandsanalyse succesvol afgerond!");
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
