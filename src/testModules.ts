
import "dotenv/config";

interface CanvasModule {
  id: number;
  name: string;
  position: number;
  published: boolean;
  items_count: number;
}

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

async function getModules(): Promise<CanvasModule[]> {
  const modules: CanvasModule[] = [];

  let nextUrl: string | null =
    `${baseUrl.replace(/\/+$/, "")}/api/v1/courses/${courseId}/modules?per_page=100`;

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

    const data = await response.json() as CanvasModule[];
    modules.push(...data);

    const linkHeader = response.headers.get("link");
    const nextLink = linkHeader
      ?.split(",")
      .find(link => link.includes('rel="next"'));

    const match = nextLink?.match(/<([^>]+)>/);
    nextUrl = match ? match[1] : null;
  }

  return modules.sort(
    (a, b) => a.position - b.position
  );
}

async function main() {
  console.log("Canvas-modules ophalen...\n");

  const modules = await getModules();

  console.log(`Aantal modules: ${modules.length}\n`);

  for (const module of modules) {
    console.log(
      `${module.position}. ${module.name}`
    );
    console.log(`   Module-ID: ${module.id}`);
    console.log(`   Onderdelen: ${module.items_count}`);
    console.log(
      `   Gepubliceerd: ${module.published ? "Ja" : "Nee"}\n`
    );
  }
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
