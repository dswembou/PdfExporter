
import type { CanvasFile } from "./canvasFiles.js";

import {
  classifyCanvasFile,
  formatFileSize
} from "./canvasFiles.js";

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

export function renderFileReference(
  file: CanvasFile,
  baseUrl: string,
  courseId: string | number
): string {

  const category = classifyCanvasFile(file);

  const fileTypes: Record<string, {
    label: string;
    abbreviation: string;
  }> = {

    word: {
      label: "Word-document",
      abbreviation: "DOC"
    },

    powerpoint: {
      label: "PowerPoint-presentatie",
      abbreviation: "PPT"
    },

    excel: {
      label: "Excel-bestand",
      abbreviation: "XLS"
    },

    pdf: {
      label: "PDF-document",
      abbreviation: "PDF"
    },

    image: {
      label: "Afbeelding",
      abbreviation: "IMG"
    },

    video: {
      label: "Videobestand",
      abbreviation: "VID"
    },

    audio: {
      label: "Audiobestand",
      abbreviation: "AUD"
    },

    other: {
      label: "Bestand",
      abbreviation: "FILE"
    }
  };

  const fileType = fileTypes[category] ?? fileTypes.other;

  const canvasOrigin = new URL(baseUrl).origin;

  const canvasFileUrl =
    `${canvasOrigin}/courses/${encodeURIComponent(courseId)}/files/${file.id}`;

  return `
    <section class="file-reference">

      <div class="file-reference-label">
        BIJBEHOREND BESTAND
      </div>

      <div class="file-reference-content">

        <div class="file-reference-icon file-type-${category}">
          ${fileType.abbreviation}
        </div>

        <div class="file-reference-details">

          <h3>${escapeHtml(file.display_name)}</h3>

          <div class="file-reference-meta">
            ${fileType.label}
            &bull;
            ${formatFileSize(file.size)}
          </div>

          <a
            class="file-reference-link"
            href="${escapeHtml(canvasFileUrl)}"
          >
            Bestand openen in Canvas
          </a>

        </div>

      </div>

      <p class="file-reference-note">
        Voor toegang tot dit bestand moet je
        ingelogd zijn in Canvas en beschikken
        over de juiste toegangsrechten.
      </p>

    </section>
  `;
}

export const fileReferenceStyles = `

  .file-reference {
    margin: 20px 0;
    padding: 15px;
    background: #f5f8fa;
    border: 1px solid #ccd6e0;
    border-left: 4px solid #245a81;
    break-inside: avoid;
  }

  .file-reference-label {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1.5px;
    color: #245a81;
    margin-bottom: 12px;
  }

  .file-reference-content {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .file-reference-icon {
    flex: 0 0 55px;
    height: 65px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #64748b;
    color: white;
    border-radius: 4px;
    font-size: 15px;
    font-weight: bold;
  }

  .file-type-word {
    background: #185abd;
  }

  .file-type-powerpoint {
    background: #c43e1c;
  }

  .file-type-excel {
    background: #107c41;
  }

  .file-type-pdf {
    background: #b91c1c;
  }

  .file-reference-details {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .file-reference-details h3 {
    margin: 0 0 5px;
    font-size: 16px;
    color: #17365d;
  }

  .file-reference-meta {
    font-size: 12px;
    color: #555;
    margin-bottom: 8px;
  }

  .file-reference-link {
    color: #245a81;
    font-size: 13px;
    font-weight: bold;
    text-decoration: underline;
  }

  .file-reference-note {
    font-size: 10px;
    color: #666;
    margin: 12px 0 0;
    font-style: italic;
  }

`;
