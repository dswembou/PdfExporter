
import assert from "node:assert/strict";

import { JSDOM } from "jsdom";

import createDOMPurify from "dompurify";

import type {
  CanvasDiscussion
} from "./canvasDiscussions.js";

import {
  renderDiscussion
} from "./discussionRenderer.js";

const baseUrl =
  "https://mboutrecht.instructure.com";

const courseId = 654;

const discussion: CanvasDiscussion = {

  id: 6008,

  title: "testDiscussie",

  message: `
    <link rel="stylesheet"
      href="https://example.com/mobile.css">

    <link rel="stylesheet"
      href="https://example.com/mobile.css">

    <p>
      welke engine is het beste, Unity of Unreal.
    </p>
  `,

  html_url:
    `${baseUrl}/courses/654/discussion_topics/6008`,

  discussion_type: "threaded",

  published: false,

  locked: false,

  locked_for_user: false,

  require_initial_post: false,

  assignment_id: null
};

function main() {

  console.log(
    "Discussion Renderer testen..."
  );

  const window = new JSDOM("").window;

  const purify = createDOMPurify(window);

  try {

    // TEST 1: HTML sanitizen.

    console.log(
      "\n--- Test 1: HTML sanitizen ---"
    );

    const safeMessage = purify.sanitize(
      discussion.message ?? "",
      {
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
      }
    );

    assert.ok(
      !safeMessage.includes("<link")
    );

    assert.ok(
      !safeMessage.includes("mobile.css")
    );

    assert.ok(
      safeMessage.includes("Unity of Unreal")
    );

    console.log("Test 1 geslaagd.");

    // TEST 2: Reguliere discussie.

    console.log(
      "\n--- Test 2: Reguliere discussie ---"
    );

    const html = renderDiscussion(
      discussion,
      safeMessage,
      baseUrl,
      courseId
    );

    assert.ok(
      html.includes("testDiscussie")
    );

    assert.ok(
      html.includes("Niet beoordeeld")
    );

    assert.ok(
      html.includes("Unity of Unreal")
    );

    assert.ok(
      html.includes(
        `${baseUrl}/courses/654/discussion_topics/6008`
      )
    );

    console.log("Test 2 geslaagd.");

    // TEST 3: Eerste reactie verplicht.

    console.log(
      "\n--- Test 3: Eerste reactie verplicht ---"
    );

    const initialPostHtml = renderDiscussion(
      {
        ...discussion,
        require_initial_post: true
      },
      safeMessage,
      baseUrl,
      courseId
    );

    assert.ok(
      initialPostHtml.includes(
        "Je moet eerst zelf een reactie"
      )
    );

    console.log("Test 3 geslaagd.");

    // TEST 4: Vergrendelde discussie.

    console.log(
      "\n--- Test 4: Vergrendelde discussie ---"
    );

    const lockedHtml = renderDiscussion(
      {
        ...discussion,
        locked: true
      },
      safeMessage,
      baseUrl,
      courseId
    );

    assert.ok(
      lockedHtml.includes("vergrendeld")
    );

    console.log("Test 4 geslaagd.");

    // TEST 5: Lege beschrijving.

    console.log(
      "\n--- Test 5: Lege beschrijving ---"
    );

    const emptyHtml = renderDiscussion(
      discussion,
      "",
      baseUrl,
      courseId
    );

    assert.ok(
      emptyHtml.includes(
        "Geen discussie-instructies beschikbaar."
      )
    );

    console.log("Test 5 geslaagd.");

    // TEST 6: HTML-injectie in de titel.

    console.log(
      "\n--- Test 6: HTML-injectie ---"
    );

    const escapedHtml = renderDiscussion(
      {
        ...discussion,
        title: "<script>alert(1)</script>"
      },
      safeMessage,
      baseUrl,
      courseId
    );

    assert.ok(
      !escapedHtml.includes("<script>")
    );

    assert.ok(
      escapedHtml.includes("&lt;script&gt;")
    );

    console.log("Test 6 geslaagd.");

    // TEST 7: Beoordeelde discussie.

    console.log(
      "\n--- Test 7: Beoordeelde discussie ---"
    );

    const gradedHtml = renderDiscussion(
      {
        ...discussion,
        assignment_id: 12345
      },
      safeMessage,
      baseUrl,
      courseId,
      {
        id: 12345,
        name: "Beoordeelde discussie",
        description: null,
        points_possible: 10,
        submission_types: [
          "discussion_topic"
        ],
        published: false,
        due_at: null,
        html_url: "",
        rubric: [
          {
            id: "criterion-1",
            description: "Argumentatie",
            points: 10,
            ratings: [
              {
                id: "rating-1",
                description: "Voldoende",
                points: 10
              },
              {
                id: "rating-2",
                description: "Onvoldoende",
                points: 0
              }
            ]
          }
        ]
      }
    );

    assert.ok(
      gradedHtml.includes(
        "Beoordeelde discussie"
      )
    );

    assert.ok(
      gradedHtml.includes(
        "Maximaal 10 punten"
      )
    );

    assert.ok(
      gradedHtml.includes("Argumentatie")
    );

    console.log("Test 7 geslaagd.");

    console.log(
      "\nAlle 7 Discussion Renderer-tests geslaagd!"
    );

  } finally {

    window.close();
  }
}

try {

  main();

} catch (error) {

  console.error("Fout:", error);

  process.exitCode = 1;
}
