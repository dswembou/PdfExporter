
import type { CanvasFile } from "./canvasFiles.js";
import type { PdfAnalysis } from "./pdfAnalyzer.js";

import { formatFileSize } from "./canvasFiles.js";

export interface PdfAppendix {
  number: number;
  file: CanvasFile;
  analysis: PdfAnalysis;
  sourceModule: string;
  anchorId: string;
}

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

export function createPdfAppendix(
  number: number,
  file: CanvasFile,
  analysis: PdfAnalysis,
  sourceModule: string
): PdfAppendix {

  if (analysis.encrypted) {
    throw new Error(
      "Versleutelde PDF kan niet worden opgenomen."
    );
  }

  if (analysis.pageCount < 1) {
    throw new Error(
      "PDF bevat geen bruikbare pagina's."
    );
  }

  return {
    number,
    file,
    analysis,
    sourceModule,
    anchorId: `appendix-${number}`
  };
}

export function renderPdfAppendixReference(
  appendix: PdfAppendix
): string {

  return `
    <section class="appendix-reference">

      <div class="appendix-reference-label">
        BIJLAGE ${appendix.number}
      </div>

      <div class="appendix-reference-content">

        <div class="appendix-reference-icon">
          PDF
        </div>

        <div class="appendix-reference-details">

          <h3>
            ${escapeHtml(appendix.file.display_name)}
          </h3>

          <p class="appendix-reference-meta">
            PDF-document
            &bull;
            ${appendix.analysis.pageCount} pagina's
            &bull;
            ${formatFileSize(appendix.file.size)}
          </p>

          <p>
            Dit document is volledig opgenomen
            achteraan het lesboek.
          </p>

          <a href="#${appendix.anchorId}">
            Ga naar bijlage ${appendix.number}
          </a>

        </div>

      </div>

    </section>
  `;
}

export function renderPdfAppendixCover(
  appendix: PdfAppendix
): string {

  return `
    <section
      class="appendix-cover"
      id="${appendix.anchorId}"
    >

      <div class="appendix-cover-label">
        BIJLAGE
      </div>

      <div class="appendix-cover-number">
        ${appendix.number}
      </div>

      <h1>
        ${escapeHtml(appendix.file.display_name)}
      </h1>

      <div class="appendix-cover-line"></div>

      <div class="appendix-cover-meta">

        <p>
          <strong>Afkomstig uit module</strong><br>
          ${escapeHtml(appendix.sourceModule)}
        </p>

        <p>
          <strong>Bestandstype</strong><br>
          PDF-document
        </p>

        <p>
          <strong>Aantal oorspronkelijke pagina's</strong><br>
          ${appendix.analysis.pageCount}
        </p>

        <p>
          <strong>Bestandsgrootte</strong><br>
          ${formatFileSize(appendix.file.size)}
        </p>

      </div>

      <p class="appendix-cover-note">
        Op de volgende pagina's wordt de inhoud
        van het oorspronkelijke PDF-document
        weergegeven.
      </p>

    </section>
  `;
}

export const pdfAppendixStyles = `

  .appendix-reference {
    margin: 20px 0;
    padding: 15px;
    background: #f5f8fa;
    border: 1px solid #ccd6e0;
    border-left: 4px solid #245a81;
    break-inside: avoid;
  }

  .appendix-reference-label {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1.5px;
    color: #245a81;
    margin-bottom: 12px;
  }

  .appendix-reference-content {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .appendix-reference-icon {
    flex: 0 0 55px;
    height: 65px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #b91c1c;
    color: white;
    border-radius: 4px;
    font-weight: bold;
  }

  .appendix-reference-details {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .appendix-reference-details h3 {
    margin: 0;
    color: #17365d;
    font-size: 16px;
  }

  .appendix-reference-details p {
    font-size: 12px;
    margin: 6px 0;
  }

  .appendix-reference-meta {
    color: #666;
  }

  .appendix-reference-details a {
    color: #245a81;
    font-size: 13px;
    font-weight: bold;
    text-decoration: underline;
  }

  .appendix-cover {
    break-before: page;
    break-after: page;
    text-align: center;
    padding-top: 35mm;
    overflow-wrap: anywhere;
  }

  .appendix-cover-label {
    font-size: 16px;
    font-weight: bold;
    letter-spacing: 5px;
    color: #245a81;
  }

  .appendix-cover-number {
    font-size: 80px;
    font-weight: bold;
    color: #17365d;
    line-height: 1.2;
  }

  .appendix-cover h1 {
    font-size: 26px;
    color: #17365d;
    margin: 20px 0;
  }

  .appendix-cover-line {
    width: 60%;
    height: 2px;
    background: #245a81;
    margin: 25px auto;
  }

  .appendix-cover-meta {
    font-size: 13px;
    line-height: 1.6;
  }

  .appendix-cover-meta p {
    margin: 15px 0;
  }

  .appendix-cover-note {
    margin-top: 35px;
    font-size: 11px;
    color: #666;
    font-style: italic;
  }

`;
