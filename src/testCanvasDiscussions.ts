
import "dotenv/config";

import assert from "node:assert/strict";

import {
  getCanvasDiscussion
} from "./canvasDiscussions.js";

interface CanvasModule {
  id: number;
  name: string;
  published: boolean;
}

interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  position: number;
  content_id?: number;
  published: boolean;
}

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;
const courseId = process.env.CANVAS_COURSE_ID;

if (!baseUrl || !token || !courseId) {

  throw new Error(
    "Canvas-configuratie ontbreekt."
  );
}

const canvasOrigin = new URL(baseUrl).origin;

const coursePath =
  `/api/v1/courses/${encodeURIComponent(courseId)}`;

async function fetchAll<T>(
  apiPath: string
): Promise<T[]> {

  const results: T[] = [];

  const firstUrl = new URL(
    apiPath,
    canvasOrigin
  );

  firstUrl.searchParams.set(
    "per_page",
    "100"
  );

  let nextUrl: string | null =
    firstUrl.toString();

  while (nextUrl) {

    const url = new URL(
      nextUrl,
      canvasOrigin
    );

    if (
      url.origin !== canvasOrigin ||
      url.username ||
      url.password
    ) {

      throw new Error(
        "Onveilige Canvas API-verwijzing."
      );
    }

    const response = await fetch(url, {

      redirect: "error",

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {

      throw new Error(
        `Canvas API-fout: ${response.status}`
      );
    }

    const data =
      await response.json() as T[];

    results.push(...data);

    const nextLink = response.headers
      .get("link")
      ?.split(",")
      .find(link => /rel="next"/.test(link));

    nextUrl =
      nextLink?.match(/<([^>]+)>/)?.[1]
      ?? null;
  }

  return results;
}

async function main() {

  console.log(
    "Canvas-discussietest gestart..."
  );

  console.log(
    "\n--- Modules ophalen ---"
  );

  const modules = await fetchAll<CanvasModule>(
    `${coursePath}/modules`
  );

  console.log(
    `Aantal modules: ${modules.length}`
  );

  const testModule = modules.find(
    module =>
      module.name === "Testmodule PDF Exporter"
  );

  assert.ok(
    testModule,
    "Testmodule PDF Exporter niet gevonden."
  );

  console.log(
    `Testmodule: ${testModule.name}`
  );

  console.log(
    `Module-ID: ${testModule.id}`
  );

  console.log(
    `Module gepubliceerd: ${testModule.published}`
  );

  console.log(
    "\n--- Moduleonderdelen ophalen ---"
  );

  const items =
    await fetchAll<CanvasModuleItem>(
      `${coursePath}/modules/${testModule.id}/items`
    );

  const discussionItems = items
    .filter(item => item.type === "Discussion")
    .sort((a, b) => a.position - b.position);

  console.log(
    `Aantal discussies: ${discussionItems.length}`
  );

  assert.ok(
    discussionItems.length > 0,
    "Geen discussies gevonden."
  );

  for (const item of discussionItems) {

    console.log(
      "\n===================================="
    );

    console.log(
      `Moduleonderdeel: ${item.title}`
    );

    console.log(
      "===================================="
    );

    assert.ok(
      item.content_id,
      "Discussie-ID ontbreekt."
    );

    const discussion =
      await getCanvasDiscussion(
        baseUrl!,
        token!,
        courseId!,
        item.content_id
      );

    assert.equal(
      discussion.id,
      item.content_id
    );

    assert.ok(
      discussion.title
    );

    console.log(
      `Discussie-ID: ${discussion.id}`
    );

    console.log(
      `Titel: ${discussion.title}`
    );

    console.log(
      `Discussietype: ${discussion.discussion_type}`
    );

    console.log(
      `Gepubliceerd: ${discussion.published}`
    );

    console.log(
      `Vergrendeld: ${discussion.locked}`
    );

    console.log(
      `Vergrendeld voor gebruiker: ${discussion.locked_for_user}`
    );

    console.log(
      `Eerste reactie verplicht: ${
        discussion.require_initial_post ?? false
      }`
    );

    console.log(
      `Beoordeling gekoppeld: ${
        discussion.assignment_id != null
      }`
    );

    console.log(
      `Assignment-ID: ${
        discussion.assignment_id ?? "Niet aanwezig"
      }`
    );

    console.log(
      `Beschrijving aanwezig: ${
        Boolean(discussion.message?.trim())
      }`
    );

    console.log(
      `Lengte beschrijving: ${
        discussion.message?.length ?? 0
      } tekens`
    );

    console.log(
      `Canvas-link: ${discussion.html_url}`
    );

    console.log(
      "\n--- Beschrijving (HTML) ---"
    );

    console.log(
      discussion.message
        ?? "Geen beschrijving aanwezig."
    );
  }

  console.log(
    "\nCanvas-discussietest succesvol afgerond!"
  );
}

main().catch(error => {

  console.error("Fout:", error.message);

  process.exitCode = 1;
});
