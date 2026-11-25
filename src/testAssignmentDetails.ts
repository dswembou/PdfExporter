
import "dotenv/config";
import { getCanvasAssignment } from "./canvasAssignments.js";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

async function main() {

  const assignmentIds = [55043, 55044, 55045];

  for (const assignmentId of assignmentIds) {

    const assignment = await getCanvasAssignment(
      baseUrl!,
      token!,
      courseId!,
      assignmentId
    );

    console.log("\n================================");
    console.log(`OPDRACHT: ${assignment.name}`);
    console.log("================================");

    console.log(`ID: ${assignment.id}`);
    console.log(`Punten: ${assignment.points_possible}`);
    console.log(`Gepubliceerd: ${assignment.published}`);
    console.log(`Inlevermethoden: ${assignment.submission_types.join(", ")}`);
    console.log(`Omschrijving aanwezig: ${Boolean(assignment.description)}`);
    console.log(`Rubric voor beoordeling: ${assignment.use_rubric_for_grading}`);

    const rubric = assignment.rubric ?? [];

    console.log(`Aantal beoordelingscriteria: ${rubric.length}`);

    for (const [index, criterion] of rubric.entries()) {

      console.log(
        `\nCriterium ${index + 1}: ${criterion.description}`
      );

      console.log(
        `  Maximale punten: ${criterion.points}`
      );

      console.log(
        `  Toelichting: ${criterion.long_description || "-"}`
      );

      console.log(
        `  Puntenbereik: ${criterion.criterion_use_range ?? false}`
      );

      console.log(
        `  Uitgesloten van puntentelling: ${criterion.ignore_for_scoring ?? false}`
      );

      for (const rating of criterion.ratings ?? []) {

        console.log(
          `  - ${rating.description}: ${rating.points} punten`
        );

        if (rating.long_description) {
          console.log(`    ${rating.long_description}`);
        }
      }
    }
  }

  console.log("\nAnalyse succesvol afgerond!");
}

main().catch(error => {
  console.error("Fout:", error.message);
  process.exitCode = 1;
});
