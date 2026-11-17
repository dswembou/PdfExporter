
import "dotenv/config";

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
}

interface CanvasPage {
  title: string;
  body: string | null;
  url: string;
  published: boolean;
}

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

const canvasUrl = baseUrl.replace(/\/+$/, "");

async function canvasGet<T>(path: string): Promise<T> {
  const response = await fetch(`${canvasUrl}${path}`, {
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

  return await response.json() as T;
}

async function main() {
  console.log("Canvas-pagina zoeken...\n");

  const modules = await canvasGet<CanvasModule[]>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/modules?per_page=100`
  );

  modules.sort((a, b) => a.position - b.position);

  let selectedPage: CanvasModuleItem | undefined;

  for (const module of modules) {
    const items = await canvasGet<CanvasModuleItem[]>(
      `/api/v1/courses/${encodeURIComponent(courseId)}` +
      `/modules/${module.id}/items?per_page=100`
    );

    selectedPage = items.find(
      item => item.type === "Page" && item.page_url
    );

    if (selectedPage) {
      console.log(`Module: ${module.name}`);
      break;
    }
  }

  if (!selectedPage?.page_url) {
    console.log("Geen Canvas-pagina gevonden.");
    return;
  }

  const page = await canvasGet<CanvasPage>(
    `/api/v1/courses/${encodeURIComponent(courseId)}` +
    `/pages/${encodeURIComponent(selectedPage.page_url)}`
  );

  console.log(`Titel: ${page.title}`);
  console.log(`URL: ${page.url}`);
  console.log(
    `Gepubliceerd: ${page.published ? "Ja" : "Nee"}`
  );

  console.log("\n--- HTML-INHOUD ---\n");
  console.log(page.body ?? "(Pagina bevat geen inhoud)");
  console.log("\n--- EINDE ---");
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
