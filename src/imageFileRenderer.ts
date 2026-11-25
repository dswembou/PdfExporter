
import type { CanvasFile } from "./canvasFiles.js";

import {
  formatFileSize
} from "./canvasFiles.js";

import {
  embedCanvasImages
} from "./canvasImages.js";

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

export async function renderImageFile(
  file: CanvasFile,
  baseUrl: string,
  token: string,
  courseId: string | number
): Promise<string> {

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
  ];

  const mimeType = file["content-type"]
    .toLowerCase()
    .split(";")[0]
    .trim();

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error(
      `Niet-ondersteund afbeeldingsformaat: ${mimeType}`
    );
  }

  const maxFileSize = 10 * 1024 * 1024;

  if (file.size > maxFileSize) {
    throw new Error(
      "Afbeelding overschrijdt de limiet van 10 MB."
    );
  }

  const canvasOrigin = new URL(baseUrl).origin;

  const imageUrl =
    `${canvasOrigin}/courses/${encodeURIComponent(courseId)}/files/${file.id}/preview`;

  const apiEndpoint =
    `${canvasOrigin}/api/v1/courses/${encodeURIComponent(courseId)}/files/${file.id}`;

  const imageHtml = `
    <img
      src="${escapeHtml(imageUrl)}"
      data-api-endpoint="${escapeHtml(apiEndpoint)}"
      alt="${escapeHtml(file.display_name)}"
    >
  `;

  const embeddedImage = await embedCanvasImages(
    imageHtml,
    baseUrl,
    token
  );

  if (!/src=["']data:image\/(?:jpeg|png|gif|webp);base64,/i.test(embeddedImage)) {
    throw new Error(
      `Afbeelding kon niet worden ingesloten: ${file.display_name}`
    );
  }

  return `
    <section class="image-file">

      <div class="image-file-label">
        AFBEELDING
      </div>

      <h3>${escapeHtml(file.display_name)}</h3>

      <figure class="image-file-figure">

        ${embeddedImage}

        <figcaption>
          ${escapeHtml(file.display_name)}
          &mdash;
          ${formatFileSize(file.size)}
        </figcaption>

      </figure>

    </section>
  `;
}

export const imageFileStyles = `

  .image-file {
    margin: 25px 0;
    padding: 15px;
    border: 1px solid #ccd6e0;
    border-left: 4px solid #245a81;
    break-inside: avoid;
  }

  .image-file-label {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1.5px;
    color: #245a81;
  }

  .image-file h3 {
    margin: 8px 0 15px;
    font-size: 18px;
    color: #17365d;
  }

  .image-file-figure {
    margin: 0;
    text-align: center;
  }

  .image-file-figure img {
    display: block;
    max-width: 100%;
    max-height: 180mm;
    width: auto;
    height: auto;
    object-fit: contain;
    margin: 0 auto;
  }

  .image-file-figure figcaption {
    margin-top: 10px;
    font-size: 11px;
    color: #666;
    font-style: italic;
    overflow-wrap: anywhere;
  }

`;
