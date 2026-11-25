
import "dotenv/config";

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
  content_id?: number;
  page_url?: string;
  published?: boolean;
  indent?: number;
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

async function fetchAll<T>(apiPath: string): Promise<T[]> {
  const results: T[] = [];

  const firstUrl = new URL(apiPath, canvasOrigin);
  firstUrl.searchParams.set("per_page", "100");

  let nextUrl: string | null = firstUrl.toString();

  while (nextUrl) {
    const url = new URL(nextUrl);

    if (url.origin !== canvasOrigin) {
      throw new Error("Onveilige API-bestemming.");
    }

    const response = await fetch(url, {
      redirect: "error",
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

    const nextLink = response.headers
      .get("link")
      ?.split(",")
      .find(link => /rel="next"/.test(link));

    nextUrl = nextLink?.match(/<([^>]+)>/)?.[1] ?? null;
  }

  return results;
}

async function main() {
  console.log("Modulestructuur ophalen...");

  const modules = await fetchAll<CanvasModule>(
    `${coursePath}/modules`
  );

  modules.sort((a, b) => a.position - b.position);

  const typeCounts = new Map<string, number>();
  let totalItems = 0;

  for (const module of modules) {
    console.log(`\nMODULE: ${module.name}`);
    console.log(`Gepubliceerd: ${module.published}`);

    const items = await fetchAll<CanvasModuleItem>(
      `${coursePath}/modules/${module.id}/items`
    );

    items.sort((a, b) => a.position - b.position);

    for (const item of items) {
      totalItems++;

      typeCounts.set(
        item.type,
        (typeCounts.get(item.type) ?? 0) + 1
      );

      const indent = "  ".repeat(item.indent ?? 0);

      console.log(
        `${indent}${item.position}. [${item.type}] ${item.title}`
      );

      if (item.type === "Assignment") {
        console.log(
          `${indent}   Assignment ID: ${item.content_id}`
        );
      }
    }
  }

  console.log("\n--- Samenvatting ---");
  console.log(`Aantal modules: ${modules.length}`);
  console.log(`Aantal module-items: ${totalItems}`);

  console.log("\nVerdeling per type:");

  for (const [type, count] of typeCounts) {
    console.log(`${type}: ${count}`);
  }

  console.log("\nAnalyse succesvol afgerond!");
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
