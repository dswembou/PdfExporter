
import "dotenv/config";

interface CanvasModule {
  id: number;
  name: string;
  position: number;
  published: boolean;
}

interface CanvasModuleItem {
  id: number;
  module_id: number;
  position: number;
  title: string;
  type: string;
  published: boolean;
  page_url?: string;
  content_id?: number;
  external_url?: string;
}

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

const canvasUrl = baseUrl.replace(/\/+$/, "");

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const results: T[] = [];

  let nextUrl: string | null =
    `${canvasUrl}${path}${path.includes("?") ? "&" : "?"}per_page=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
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

    const data = await response.json() as T[];

    if (!Array.isArray(data)) {
      throw new Error("Onverwacht API-antwoord.");
    }

    results.push(...data);

    const linkHeader = response.headers.get("link");

    const nextLink = linkHeader
      ?.split(",")
      .find(link => /rel="next"/.test(link));

    const match = nextLink?.match(/<([^>]+)>/);

    nextUrl = match ? match[1] : null;
  }

  return results;
}

async function main() {
  console.log("Canvas-cursusstructuur ophalen...\n");

  const modules = await fetchAllPages<CanvasModule>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/modules`
  );

  modules.sort((a, b) => a.position - b.position);

  let totalItems = 0;

  for (const module of modules) {
    console.log(`\n${"=".repeat(55)}`);
    console.log(`MODULE ${module.position}: ${module.name}`);
    console.log(`Gepubliceerd: ${module.published ? "Ja" : "Nee"}`);
    console.log("=".repeat(55));

    const items = await fetchAllPages<CanvasModuleItem>(
      `/api/v1/courses/${encodeURIComponent(courseId)}` +
      `/modules/${module.id}/items`
    );

    items.sort((a, b) => a.position - b.position);

    for (const item of items) {
      totalItems++;

      console.log(
        `  ${item.position}. [${item.type}] ${item.title}`
      );

      console.log(
        `     Gepubliceerd: ${item.published ? "Ja" : "Nee"}`
      );

      if (item.type === "Page") {
        console.log(`     Page URL: ${item.page_url ?? "Onbekend"}`);
      }

      if (item.type === "Assignment" || item.type === "Quiz") {
        console.log(`     Content ID: ${item.content_id ?? "Onbekend"}`);
      }

      if (item.type === "ExternalUrl") {
        console.log(`     Externe URL: ${item.external_url ?? "Onbekend"}`);
      }
    }

    console.log(`\nAantal onderdelen: ${items.length}`);
  }

  console.log(`\n${"=".repeat(55)}`);
  console.log(`Totaal modules: ${modules.length}`);
  console.log(`Totaal onderdelen: ${totalItems}`);
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
