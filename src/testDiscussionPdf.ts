
import "dotenv/config";

import assert from "node:assert/strict";

import {
  mkdir,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import { chromium } from "playwright";

import { JSDOM } from "jsdom";

import createDOMPurify from "dompurify";

import {
  getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  pdfJsConfig
} from "./pdfJsConfig.js";

import {
  getCanvasDiscussion
} from "./canvasDiscussions.js";

import {
  getCanvasAssignment
} from "./canvasAssignments.js";

import {
  embedCanvasImages
} from "./canvasImages.js";

import {
  renderDiscussion,
  discussionStyles
} from "./discussionRenderer.js";

import {
  addPdfPageNumbers
} from "./pdfPageNumbering.js";

const DISCUSSION_ID = 6009;

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {
  throw new Error(
    "Canvas-configuratie ontbreekt."
  );
}

const sanitizeOptions = {

  FORBID_TAGS: [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "svg",
    "math",
    "link",
    "style"
  ],

  FORBID_ATTR: [
    "style",
    "srcset"
  ]
};

async function validateDiscussionPdf(
  bytes: Uint8Array,
  expectedTitle: string,
  expectedUrl: string,
  requireInitialPost: boolean
): Promise<number> {

  const loadingTask = getDocument({
    ...pdfJsConfig,
    data: new Uint8Array(bytes)
  });

  try {

    const document = await loadingTask.promise;

    let fullText = "";

    const externalLinks: string[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= document.numPages;
      pageNumber++
    ) {

      const page = await document.getPage(
        pageNumber
      );

      const content = await page.getTextContent();

      const pageText = content.items
        .map(item =>
          "str" in item ? item.str : ""
        )
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      fullText += ` ${pageText}`;

      // Controleer de paginavoettekst.

      assert.ok(
        pageText.includes(
          `Pagina ${pageNumber} van ${document.numPages}`
        ),
        `Paginavoettekst ontbreekt op pagina ${pageNumber}.`
      );

      // Verzamel externe hyperlinks.

      const annotations =
        await page.getAnnotations();

      for (const annotation of annotations) {

        if (
          annotation.subtype === "Link" &&
          typeof annotation.url === "string"
        ) {

          externalLinks.push(annotation.url);
        }
      }
    }

    assert.ok(
      fullText.includes(expectedTitle),
      "Discussietitel ontbreekt."
    );
    console.log(
    "\n--- Geëxtraheerde PDF-tekst ---"
    );

    console.log(fullText);
    const discussionLabelPattern =
    /\bD\s*I\s*S\s*C\s*U\s*S\s*S\s*I\s*E\b/;

    assert.ok(
    discussionLabelPattern.test(fullText),
    "Discussielabel ontbreekt."
    );

    assert.ok(
      fullText.includes("Discussie-instructies"),
      "Discussie-instructies ontbreken."
    );

    assert.ok(
      externalLinks.includes(expectedUrl),
      "Canvas-hyperlink ontbreekt."
    );

    assert.ok(
      !fullText.includes("mobile.css"),
      "Externe stylesheet zichtbaar in PDF."
    );
    const expectedTexts = [
        "Beoordeelde discussie",
        "Maximaal 10 punten",
        "Gebruiksvriendelijkheid",
        "Programmeermogelijkheden",
        "Grafische mogelijkheden",
        "Prestaties",
        "Argumentatie",
        "Inhoudelijke vergelijking",
        "Onderbouw welke game-engine"
        ];

        for (const expectedText of expectedTexts) {

        assert.ok(
            fullText.includes(expectedText),
            `Verwachte tekst ontbreekt: ${expectedText}`
        );

        console.log(
            `Tekst gevalideerd: ${expectedText}`
        );
        }
    const hasInitialPostInstruction =
        fullText.includes(
            "Je moet eerst zelf een reactie"
        );

        assert.equal(
        hasInitialPostInstruction,
        requireInitialPost,
        "Instructie komt niet overeen met de Canvas-instelling."
        );

        console.log(
        `Verplichte eerste reactie correct verwerkt: ${requireInitialPost}`
        );
    console.log(
      `Aantal PDF-pagina's: ${document.numPages}`
    );

    console.log(
      `Aantal externe linkannotaties: ${externalLinks.length}`
    );

    console.log(
      "Discussietitel gecontroleerd."
    );

    console.log(
      "Discussie-instructies gecontroleerd."
    );

    console.log(
      "Canvas-hyperlink gecontroleerd."
    );

    console.log(
      "Paginanummering gecontroleerd."
    );

    return document.numPages;

  } finally {

    await loadingTask.destroy();
  }
}

async function main() {

  console.log(
    "Canvas Discussion PDF-test gestart..."
  );

  // STAP 1: Discussie ophalen.

  console.log(
    "\n--- Discussie ophalen ---"
  );

  const discussion = await getCanvasDiscussion(
    baseUrl!,
    token!,
    courseId!,
    DISCUSSION_ID
  );

  assert.equal(
    discussion.id,
    DISCUSSION_ID
  );

  console.log(`Titel: ${discussion.title}`);

  console.log(
    `Discussietype: ${discussion.discussion_type}`
  );

  console.log(
    `Gepubliceerd: ${discussion.published}`
  );

  console.log(
    `Beoordeeld: ${discussion.assignment_id != null}`
  );

  // STAP 2: Eventuele beoordeling ophalen.

  const assignment =
    discussion.assignment_id != null
      ? await getCanvasAssignment(
          baseUrl!,
          token!,
          courseId!,
          discussion.assignment_id
        )
      : undefined;

  if (assignment) {
    assert.equal(
    assignment.id,
    55062,
    "Onjuist Assignment-ID."
    );

    assert.equal(
    assignment.points_possible,
    10,
    "Onjuist maximaal aantal punten."
    );

    assert.ok(
    assignment.rubric,
    "Rubric ontbreekt."
    );

    assert.equal(
    assignment.rubric.length,
    2,
    "Onjuist aantal rubriccriteria."
    );

    const rubricTotal = assignment.rubric
    .filter(criterion => !criterion.ignore_for_scoring)
    .reduce(
        (total, criterion) => total + criterion.points,
        0
    );

    assert.equal(
    rubricTotal,
    10,
    "Onjuist totaal aantal rubricpunten."
    );

    assert.equal(
    assignment.use_rubric_for_grading,
    true,
    "Rubric wordt niet gebruikt voor beoordeling."
    );

    console.log(
    "Beoordeling en rubric succesvol gevalideerd."
    );
    console.log(
      "\n--- Beoordeling opgehaald ---"
    );

    console.log(
      `Maximale punten: ${assignment.points_possible}`
    );

    console.log(
      `Rubriccriteria: ${assignment.rubric?.length ?? 0}`
    );

  } else {

    console.log(
      "Geen gekoppelde beoordeling aanwezig."
    );
  }

  // STAP 3: HTML sanitizen.

  console.log(
    "\n--- Discussie-inhoud opschonen ---"
  );

  const window = new JSDOM("").window;

  const purify = createDOMPurify(window);

  try {

    const originalMessage =
      discussion.message ?? "";

    const sanitizedMessage = purify.sanitize(
      originalMessage,
      sanitizeOptions
    );

    console.log(
      `Oorspronkelijke HTML: ${originalMessage.length} tekens`
    );

    console.log(
      `Gesanitized HTML: ${sanitizedMessage.length} tekens`
    );

    // STAP 4: Afbeeldingen insluiten.

    console.log(
      "\n--- Afbeeldingen verwerken ---"
    );

    const embeddedMessage =
      await embedCanvasImages(
        sanitizedMessage,
        baseUrl!,
        token!
      );

    // Na HTML-transformatie opnieuw sanitizen.

    const safeMessage = purify.sanitize(
      embeddedMessage,
      sanitizeOptions
    );

    const messageDom = new JSDOM(safeMessage);

    try {

      const messageDocument =
        messageDom.window.document;

      assert.equal(
        messageDocument.querySelectorAll(
          "link, style, script, iframe"
        ).length,
        0
      );

      const images = [
        ...messageDocument.querySelectorAll("img")
      ];

      const embeddedImages = images.filter(
        image =>
          image.getAttribute("src")
            ?.startsWith("data:image/")
      );
      assert.equal(
  images.length,
  1,
  "Onjuist aantal afbeeldingen."
);

assert.equal(
  embeddedImages.length,
  1,
  "Canvas-afbeelding is niet ingesloten."
);

assert.match(
  embeddedImages[0].getAttribute("src") ?? "",
  /^data:image\/(?:jpeg|png|gif|webp);base64,/i,
  "Ongeldig ingesloten afbeeldingsformaat."
);

assert.equal(
  embeddedImages[0].getAttribute("alt"),
  "Create-2D-amp-3D-Games-In-Unity-Complete-Game.jpg",
  "Alternatieve afbeeldingstekst ontbreekt."
);

console.log(
  "Canvas-afbeelding succesvol gevalideerd."
);

      console.log(
        `Aantal afbeeldingen: ${images.length}`
      );

      console.log(
        `Ingesloten afbeeldingen: ${embeddedImages.length}`
      );

    } finally {

      messageDom.window.close();
    }

    // STAP 5: Discussie renderen.

    console.log(
      "\n--- Discussie renderen ---"
    );

    const discussionHtml = renderDiscussion(
      discussion,
      safeMessage,
      baseUrl!,
      courseId!,
      assignment
    );

    const html = `
      <!DOCTYPE html>
      <html lang="nl">

      <head>

        <meta charset="UTF-8">

        <style>

          @page {
            size: A4;
            margin: 20mm;
          }

          body {
            font-family: Arial, sans-serif;
            color: #222;
            line-height: 1.6;
            overflow-wrap: anywhere;
          }

          h1 {
            color: #17365d;
            font-size: 26px;
          }

          ${discussionStyles}

        </style>

      </head>

      <body>

        <h1>Testmodule PDF Exporter</h1>

        <p>
          Testdocument voor het verwerken
          van Canvas-discussies.
        </p>

        ${discussionHtml}

      </body>

      </html>
    `;

    // STAP 6: PDF genereren.

    console.log(
      "\n--- PDF genereren ---"
    );

    const browser = await chromium.launch({
      headless: true
    });

    try {

      const page = await browser.newPage({
        javaScriptEnabled: false
      });

      await page.route(
        "**/*",
        route => route.abort()
      );

      await page.setContent(html, {
        waitUntil: "load"
      });

      const expectedUrl =
        `${new URL(baseUrl!).origin}/courses/` +
        `${encodeURIComponent(courseId!)}/` +
        `discussion_topics/${discussion.id}`;

      // Controleer de HTML voordat de PDF
      // wordt gegenereerd.

      assert.equal(
        await page.locator(".discussion").count(),
        1
      );

      assert.equal(
        await page.locator(
          ".discussion-link a"
        ).getAttribute("href"),
        expectedUrl
      );

      const renderedMessage =
        await page.locator(
          ".discussion-message"
        ).innerHTML();

      assert.ok(
        !renderedMessage.includes("mobile.css")
      );

      const draftPdf = await page.pdf({

        format: "A4",

        printBackground: true,

        displayHeaderFooter: false,

        margin: {
          top: "20mm",
          bottom: "20mm",
          left: "20mm",
          right: "20mm"
        }
      });

      // STAP 7: Paginanummering toevoegen.

      console.log(
        "\n--- Paginanummering toevoegen ---"
      );

      const finalPdf = await addPdfPageNumbers(
        draftPdf,
        {
          showTotalPages: true,
          skipCover: false
        }
      );

      // STAP 8: PDF valideren.

      console.log(
        "\n--- PDF valideren ---"
      );

      const pageCount =
        await validateDiscussionPdf(
            finalPdf,
            discussion.title,
            expectedUrl,
            discussion.require_initial_post ?? false
        );

      // STAP 9: PDF opslaan.

      const outputDir = path.join(
        process.cwd(),
        "output"
      );

      await mkdir(outputDir, {
        recursive: true
      });

      const outputPath = path.join(
        outputDir,
        "canvas-discussion-test.pdf"
      );

      await writeFile(
        outputPath,
        finalPdf
      );

      console.log(
        "\n--- Eindresultaat ---"
      );

      console.log(
        `Discussie: ${discussion.title}`
      );

      console.log(
        `Aantal pagina's: ${pageCount}`
      );

      console.log(
        "Canvas-hyperlink: geldig"
      );

      console.log(
        "\nCanvas Discussion PDF-test geslaagd!"
      );

      console.log(
        `Bestand: ${outputPath}`
      );

    } finally {

      await browser.close();
    }

  } finally {

    window.close();
  }
}

main().catch(error => {

  console.error("Fout:", error);

  process.exitCode = 1;
});
