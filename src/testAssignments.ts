
import "dotenv/config";

interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  points_possible: number | null;
  submission_types: string[];
  published: boolean;
  rubric?: unknown[];
}

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

const canvasOrigin = new URL(baseUrl).origin;

async function main() {
  const assignments: CanvasAssignment[] = [];

  let nextUrl: string | null = new URL(
    `/api/v1/courses/${encodeURIComponent(courseId!)}/assignments?per_page=100`,
    canvasOrigin
  ).toString();

  console.log("Canvas-opdrachten ophalen...\n");

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

    const data = await response.json() as CanvasAssignment[];

    assignments.push(...data);

    const nextLink = response.headers
      .get("link")
      ?.split(",")
      .find(link => /rel="next"/.test(link));

    nextUrl = nextLink?.match(/<([^>]+)>/)?.[1] ?? null;
  }

  console.log(`Aantal opdrachten: ${assignments.length}`);

  for (const assignment of assignments) {
    console.log("\n--------------------------------");
    console.log(`ID: ${assignment.id}`);
    console.log(`Naam: ${assignment.name}`);
    console.log(`Punten: ${assignment.points_possible ?? "Niet ingesteld"}`);
    console.log(`Gepubliceerd: ${assignment.published}`);
    console.log(`Inlevermethoden: ${assignment.submission_types.join(", ")}`);
    console.log(`Omschrijving aanwezig: ${Boolean(assignment.description)}`);
    console.log(`Rubric aanwezig: ${Boolean(assignment.rubric?.length)}`);
  }

  console.log("\nAnalyse succesvol afgerond!");
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
