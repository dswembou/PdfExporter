
import type {
  CanvasDiscussion
} from "./canvasDiscussions.js";

import type {
  CanvasAssignment
} from "./canvasAssignments.js";

import {
  renderRubric,
  rubricStyles
} from "./rubricRenderer.js";

function escapeHtml(text: string): string {

  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return text.replace(
    /[&<>"']/g,
    character => map[character]
  );
}

function getDiscussionType(
  discussionType: string
): string {

  switch (discussionType) {

    case "threaded":
      return "Discussie met reacties";

    case "side_comment":
      return "Eenvoudige discussie";

    default:
      return "Discussie";
  }
}

export function renderDiscussion(
  discussion: CanvasDiscussion,
  safeMessage: string,
  baseUrl: string,
  courseId: string | number,
  assignment?: CanvasAssignment
): string {

  const canvasOrigin =
    new URL(baseUrl).origin;

  const discussionUrl =
    `${canvasOrigin}/courses/` +
    `${encodeURIComponent(courseId)}/` +
    `discussion_topics/${discussion.id}`;

  const isGraded =
    discussion.assignment_id != null;

  if (
    assignment &&
    assignment.id !== discussion.assignment_id
  ) {

    throw new Error(
      "De opdracht hoort niet bij deze discussie."
    );
  }

  const metadata: string[] = [];

  metadata.push(
    getDiscussionType(
      discussion.discussion_type
    )
  );

  metadata.push(
    isGraded
      ? "Beoordeelde discussie"
      : "Niet beoordeeld"
  );

  if (
    isGraded &&
    assignment?.points_possible != null
  ) {

    metadata.push(
      `Maximaal ${assignment.points_possible} punten`
    );
  }

  const metadataHtml = metadata
    .map(value => `
      <span class="discussion-meta-item">
        ${escapeHtml(value)}
      </span>
    `)
    .join("");

  const instructionsHtml =
    discussion.require_initial_post
      ? `
        <div class="discussion-notice">
          Je moet eerst zelf een reactie
          plaatsen voordat je de reacties
          van anderen kunt bekijken.
        </div>
      `
      : "";

  const lockedHtml =
    discussion.locked ||
    discussion.locked_for_user
      ? `
        <div class="discussion-notice">
          Deze discussie is momenteel
          vergrendeld voor de exporterende
          gebruiker of voor alle deelnemers.
        </div>
      `
      : "";

  const messageHtml = safeMessage.trim()
    ? safeMessage
    : `
      <p class="discussion-empty">
        Geen discussie-instructies beschikbaar.
      </p>
    `;

  const rubricHtml =
    isGraded && assignment?.rubric?.length
      ? `
        <div class="discussion-rubric">
          ${renderRubric(assignment.rubric)}
        </div>
      `
      : "";

  return `
    <section class="discussion">

      <div class="discussion-label">
        DISCUSSIE
      </div>

      <h2 class="discussion-title">
        ${escapeHtml(discussion.title)}
      </h2>

      <div class="discussion-meta">
        ${metadataHtml}
      </div>

      ${instructionsHtml}

      ${lockedHtml}

      <div class="discussion-content">

        <h3>Discussie-instructies</h3>

        <div class="discussion-message">
          ${messageHtml}
        </div>

      </div>

      ${rubricHtml}

      <div class="discussion-link">

        <a href="${escapeHtml(discussionUrl)}">
          Deelnemen aan de discussie in Canvas
        </a>

        <p>
          Voor deelname moet je ingelogd zijn
          in Canvas en toegang hebben tot
          de discussie.
        </p>

      </div>

    </section>
  `;
}

export const discussionStyles = `

  ${rubricStyles}

  .discussion {
    margin: 25px 0;
    padding: 18px;
    border: 1px solid #ccd6e0;
    border-left: 4px solid #245a81;
    background: #f4f7fa;
    overflow-wrap: anywhere;
  }

  .discussion-label {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1.5px;
    color: #245a81;
    break-after: avoid;
  }

  .discussion-title {
    margin: 8px 0 12px;
    font-size: 22px;
    color: #17365d;
    break-after: avoid;
  }

  .discussion-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 18px;
    break-inside: avoid;
  }

  .discussion-meta-item {
    font-size: 11px;
    color: #555;
    padding: 4px 8px;
    background: #e3eaf2;
    border-radius: 3px;
  }

  .discussion-content {
    border-top: 1px solid #ccd6e0;
    padding-top: 12px;
  }

  .discussion-content h3 {
    margin: 0 0 12px;
    font-size: 16px;
    color: #17365d;
    break-after: avoid;
  }

  .discussion-message {
    font-size: 14px;
    line-height: 1.6;
  }

  .discussion-message img {
    max-width: 100%;
    height: auto;
  }

  .discussion-message table {
    width: 100%;
    border-collapse: collapse;
  }

  .discussion-message th,
  .discussion-message td {
    border: 1px solid #aaa;
    padding: 8px;
  }

  .discussion-message pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .discussion-empty {
    color: #777;
    font-style: italic;
  }

  .discussion-notice {
    margin: 12px 0;
    padding: 10px;
    border-left: 3px solid #8b6f32;
    background: #fff8e7;
    font-size: 12px;
    break-inside: avoid;
  }

  .discussion-rubric {
    margin-top: 20px;
  }

  .discussion-link {
    border-top: 1px solid #ccd6e0;
    margin-top: 20px;
    padding-top: 12px;
    break-inside: avoid;
  }

  .discussion-link a {
    color: #245a81;
    font-size: 14px;
    font-weight: bold;
    text-decoration: underline;
  }

  .discussion-link p {
    font-size: 11px;
    color: #666;
    margin: 6px 0 0;
  }

`;
