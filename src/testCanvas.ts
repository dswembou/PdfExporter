
import "dotenv/config";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error(
    "Canvas-configuratie ontbreekt. Controleer je .env-bestand."
  );
}

async function testCanvasConnection() {
  const url = new URL(
    `/api/v1/courses/${encodeURIComponent(courseId)}`,
    baseUrl.replace(/\/+$/, "") + "/"
  );

  console.log("Verbinding maken met Canvas...");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Canvas API-fout: HTTP ${response.status} ${response.statusText}`
    );
  }

  const course = await response.json() as {
    id: number;
    name: string;
    course_code: string;
    workflow_state: string;
  };

  console.log("Verbinding geslaagd!");
  console.log("Cursus-ID:", course.id);
  console.log("Cursusnaam:", course.name);
  console.log("Cursuscode:", course.course_code);
  console.log("Status:", course.workflow_state);
}

testCanvasConnection().catch((error) => {
  console.error("Verbinding mislukt:", error.message);
  process.exitCode = 1;
});
