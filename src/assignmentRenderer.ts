
import type {
  CanvasAssignment
} from "./canvasAssignments.js";

import {
  renderRubric,
  rubricStyles
} from "./rubricRenderer.js";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return map[char];
  });
}

function translateSubmissionType(type: string): string {

  const translations: Record<string, string> = {
    none: "Geen inlevering",
    on_paper: "Op papier",
    online_upload: "Bestand uploaden",
    online_text_entry: "Tekstinvoer",
    online_url: "Website-URL",
    media_recording: "Mediaopname",
    student_annotation: "Documentannotatie",
    external_tool: "Externe tool",
    discussion_topic: "Discussiebijdrage",
    online_quiz: "Online toets",
    not_graded: "Niet beoordeeld"
  };

  return translations[type] ?? type;
}

export function renderAssignment(
  assignment: CanvasAssignment,
  safeDescription: string
): string {

  const submissionTypes = assignment.submission_types
    .map(translateSubmissionType)
    .join(", ");

  return `
    <section class="assignment">

      <div class="assignment-label">
        OPDRACHT
      </div>

      <h2 class="assignment-title">
        ${escapeHtml(assignment.name)}
      </h2>

      <div class="assignment-meta">

        <div class="assignment-meta-item">
          <span class="assignment-meta-label">
            Maximaal aantal punten
          </span>

          <strong>
            ${assignment.points_possible ?? "Niet ingesteld"}
          </strong>
        </div>

        <div class="assignment-meta-item">
          <span class="assignment-meta-label">
            Inlevermethode
          </span>

          <strong>
            ${escapeHtml(submissionTypes || "Niet ingesteld")}
          </strong>
        </div>

        <div class="assignment-meta-item">
          <span class="assignment-meta-label">
            Beoordelingsrubric
          </span>

          <strong>
            ${assignment.rubric?.length ? "Aanwezig" : "Niet aanwezig"}
          </strong>
        </div>

      </div>

      <div class="assignment-description">

        <h3>Opdrachtomschrijving</h3>

        ${safeDescription || "<p>Geen opdrachtomschrijving beschikbaar.</p>"}

      </div>

      ${renderRubric(assignment.rubric)}

    </section>
  `;
}

export const assignmentStyles = `

  ${rubricStyles}

  .assignment {
    margin-top: 30px;
    margin-bottom: 30px;
    border-left: 4px solid #245a81;
    padding-left: 16px;
  }

  .assignment-label {
    display: inline-block;
    background: #17365d;
    color: white;
    padding: 5px 12px;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1.5px;
    break-after: avoid;
  }

  .assignment-title {
    color: #17365d;
    font-size: 22px;
    margin-top: 10px;
    break-after: avoid;
  }

  .assignment-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 15px;
    margin: 15px 0 20px 0;
    background: #edf2f7;
    border: 1px solid #ccd6e0;
    break-inside: avoid;
  }

  .assignment-meta-item {
    flex: 1;
    min-width: 100px;
    font-size: 12px;
  }

  .assignment-meta-label {
    display: block;
    font-size: 10px;
    color: #555;
    margin-bottom: 5px;
  }

  .assignment-description {
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .assignment-description h3 {
    color: #17365d;
    break-after: avoid;
  }

  .assignment-description img {
    max-width: 100%;
    height: auto;
  }

  .assignment-description table {
    width: 100%;
    border-collapse: collapse;
  }

  .assignment-description th,
  .assignment-description td {
    border: 1px solid #aaa;
    padding: 8px;
  }

  .assignment-description pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background: #f1f3f5;
    padding: 12px;
  }

`;
