
import type {
  CanvasRubricCriterion
} from "./canvasAssignments.js";

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

export function renderRubric(
  rubric?: CanvasRubricCriterion[]
): string {

  if (!rubric?.length) {
    return "";
  }

  const maxRatings = Math.max(
    1,
    ...rubric.map(
      criterion => criterion.ratings?.length ?? 0
    )
  );

  const totalPoints = rubric.reduce(
    (total, criterion) =>
      total + (
        criterion.ignore_for_scoring
          ? 0
          : criterion.points
      ),
    0
  );

  const rows = rubric.map(criterion => {

    const ratings = criterion.ratings ?? [];

    const ratingCells = ratings.map((rating, index) => {

      const nextRating = ratings[index + 1];

      const pointsLabel =
        criterion.criterion_use_range && nextRating
          ? `>${nextRating.points} – ${rating.points} pt`
          : `${rating.points} pt`;

      return `
        <td class="rubric-rating">
          <div class="rubric-rating-title">
            ${escapeHtml(rating.description)}
          </div>

          ${rating.long_description ? `
            <div class="rubric-description">
              ${escapeHtml(rating.long_description)}
            </div>
          ` : ""}

          <div class="rubric-points">
            ${escapeHtml(pointsLabel)}
          </div>
        </td>
      `;
    });

    while (ratingCells.length < maxRatings) {
      ratingCells.push(`
        <td class="rubric-empty"></td>
      `);
    }

    return `
      <tr>
        <td class="rubric-criterion">

          <strong>
            ${escapeHtml(criterion.description)}
          </strong>

          ${criterion.long_description ? `
            <div class="rubric-description">
              ${escapeHtml(criterion.long_description)}
            </div>
          ` : ""}

          ${criterion.ignore_for_scoring ? `
            <div class="rubric-note">
              Telt niet mee voor de puntentelling
            </div>
          ` : ""}

        </td>

        ${ratingCells.join("")}

        <td class="rubric-max-points">
          ${criterion.ignore_for_scoring
            ? "—"
            : criterion.points}
        </td>
      </tr>
    `;
  });

  return `
    <section class="rubric">

      <h3>Beoordelingsrubric</h3>

      <table class="rubric-table">

        <thead>
          <tr>
            <th>Criteria</th>
            <th colspan="${maxRatings}">
              Beoordelingsniveaus
            </th>
            <th>Max.</th>
          </tr>
        </thead>

        <tbody>
          ${rows.join("")}
        </tbody>

        <tfoot>
          <tr>
            <td colspan="${maxRatings + 1}">
              Totaal aantal rubricpunten
            </td>
            <td>${totalPoints}</td>
          </tr>
        </tfoot>

      </table>

    </section>
  `;
}

export const rubricStyles = `
  .rubric {
    margin-top: 25px;
    margin-bottom: 25px;
  }

  .rubric h3 {
    color: #17365d;
    break-after: avoid;
  }

  .rubric-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 11px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .rubric-table th {
    background: #17365d;
    color: white;
    padding: 10px;
    text-align: left;
  }

  .rubric-table th:first-child {
    width: 28%;
  }

  .rubric-table th:last-child {
    width: 8%;
  }

  .rubric-table td {
    border: 1px solid #b8c2cc;
    padding: 10px;
    vertical-align: top;
  }

  .rubric-table thead {
    display: table-header-group;
  }

  .rubric-table tr {
    break-inside: avoid;
  }

  .rubric-criterion {
    background: #edf2f7;
  }

  .rubric-rating-title {
    font-weight: bold;
  }

  .rubric-description {
    margin-top: 5px;
    white-space: pre-wrap;
    color: #444;
  }

  .rubric-points {
    margin-top: 8px;
    font-weight: bold;
    color: #17365d;
  }

  .rubric-max-points {
    text-align: center;
    font-weight: bold;
  }

  .rubric-empty {
    background: #f5f5f5;
  }

  .rubric-note {
    margin-top: 5px;
    font-style: italic;
    color: #666;
  }

  .rubric-table tfoot td {
    background: #edf2f7;
    font-weight: bold;
    text-align: right;
  }
`;
