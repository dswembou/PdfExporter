
import "dotenv/config";

const baseUrl = process.env.CANVAS_BASE_URL;
const token = process.env.CANVAS_API_TOKEN;

if (!baseUrl || !token) {
  throw new Error("Canvas-configuratie ontbreekt.");
}

const fileId = 2441;
const canvasOrigin = new URL(baseUrl).origin;

async function main() {
  console.log(`Canvas-bestand ${fileId} onderzoeken...\n`);

  const metadataUrl =
    `${canvasOrigin}/api/v1/files/${fileId}`;

  console.log("Stap A: Metadata ophalen");

  const response = await fetch(metadataUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    },
    redirect: "error"
  });

  console.log("HTTP-status:", response.status);

  if (!response.ok) {
    throw new Error(
      `Metadata ophalen mislukt: HTTP ${response.status}`
    );
  }

  const file = await response.json() as {
    id: number;
    display_name?: string;
    "content-type"?: string;
    url?: string;
    size?: number;
  };

  console.log("Bestandsnaam:", file.display_name);
  console.log("Content-type:", file["content-type"]);
  console.log("Bestandsgrootte:", file.size);

  if (!file.url) {
    throw new Error("Canvas heeft geen download-URL teruggegeven.");
  }

  const downloadUrl = new URL(file.url);

  // We tonen bewust niet de volledige URL:
  // deze kan een tijdelijk toegangstoken bevatten.
  console.log(
    "Downloadhost:",
    downloadUrl.hostname
  );

  console.log(
    "Zelfde host als Canvas:",
    downloadUrl.origin === canvasOrigin
      ? "Ja"
      : "Nee"
  );

  console.log("\nStap B: Downloadverbinding testen");

const downloadResponse = await fetch(downloadUrl, {
  method: "GET",
  redirect: "follow",
  signal: AbortSignal.timeout(15000)
});

console.log("HTTP-status:", downloadResponse.status);

console.log(
  "Uiteindelijke downloadhost:",
  new URL(downloadResponse.url).hostname
);

console.log(
  "Content-type:",
  downloadResponse.headers.get("content-type")
);

const bytes = Buffer.from(
  await downloadResponse.arrayBuffer()
);

console.log("Gedownloade bytes:", bytes.length);

console.log(
  "Is JPEG:",
  bytes.length >= 3 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[2] === 0xff
    ? "Ja"
    : "Nee"
);

  console.log("\nDiagnose voltooid.");
}

main().catch(error => {
  console.error("\nFout:", error.message);

  if (error.cause) {
    const cause = error.cause as {
      code?: string;
      message?: string;
    };

    console.error("Oorzaakcode:", cause.code ?? "Onbekend");
    console.error("Oorzaak:", cause.message ?? "Onbekend");
  }

  process.exitCode = 1;
});
