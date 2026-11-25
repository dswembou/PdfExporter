
import type { CanvasFile } from "./canvasFiles.js";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT = 30_000;

export async function downloadCanvasFile(
  file: CanvasFile,
  baseUrl: string,
  token: string
): Promise<Uint8Array> {

  const canvasOrigin = new URL(baseUrl).origin;

  const allowedDownloadHosts = new Set([
    new URL(canvasOrigin).hostname,
    "cdn.inst-fs-fra-prod.inscloudgate.net",
    "inst-fs-fra-prod.inscloudgate.net"
  ]);

  function isAllowedDownloadHost(
    hostname: string
  ): boolean {

    const host = hostname.toLowerCase();

    if (allowedDownloadHosts.has(host)) {
      return true;
    }

    const canvasFileHost =
      /^a\d+-\d+\.cluster\d+\.canvas-user-content\.com$/;

    return canvasFileHost.test(host);
  }

  if (!file.url) {
    throw new Error("Geen download-URL beschikbaar.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "Bestand overschrijdt de limiet van 25 MB."
    );
  }

  let currentUrl = new URL(file.url);

  const signal = AbortSignal.timeout(
    DOWNLOAD_TIMEOUT
  );

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount++
  ) {

    if (currentUrl.protocol !== "https:") {
      throw new Error(
        "Alleen HTTPS-downloads zijn toegestaan."
      );
    }

    if (
      currentUrl.port &&
      currentUrl.port !== "443"
    ) {
      throw new Error(
        "Niet-toegestane downloadpoort."
      );
    }

    if (currentUrl.username || currentUrl.password) {
      throw new Error(
        "Inloggegevens in download-URL."
      );
    }

    if (!isAllowedDownloadHost(currentUrl.hostname)) {
      throw new Error(
        `Downloadhost niet toegestaan: ${currentUrl.hostname}`
      );
    }

    console.log(
      `Downloadhost: ${currentUrl.hostname}`
    );

    const headers: Record<string, string> = {
      Accept: "*/*"
    };

    // API-token uitsluitend naar de eigen Canvas-omgeving.

    if (currentUrl.origin === canvasOrigin) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(currentUrl, {
      headers,
      redirect: "manual",
      signal
    });

    // Redirects handmatig verwerken.

    if (
      [301, 302, 303, 307, 308].includes(response.status)
    ) {

      const location = response.headers.get(
        "location"
      );

      await response.body?.cancel();

      if (!location) {
        throw new Error(
          "Redirect zonder bestemmingsadres."
        );
      }

      if (redirectCount === MAX_REDIRECTS) {
        throw new Error(
          "Maximaal aantal redirects bereikt."
        );
      }

      currentUrl = new URL(
        location,
        currentUrl
      );

      continue;
    }

    if (!response.ok) {

      await response.body?.cancel();

      throw new Error(
        `Download mislukt: HTTP ${response.status}`
      );
    }

    const contentLength = Number(
      response.headers.get("content-length") ?? 0
    );

    if (contentLength > MAX_FILE_SIZE) {

      await response.body?.cancel();

      throw new Error(
        "Download overschrijdt de bestandsgroottelimiet."
      );
    }

    if (!response.body) {
      throw new Error("Download bevat geen inhoud.");
    }

    // Bestand streamend downloaden.

    const reader = response.body.getReader();

    const chunks: Uint8Array[] = [];

    let totalBytes = 0;

    try {

      while (true) {

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        totalBytes += value.byteLength;

        if (totalBytes > MAX_FILE_SIZE) {
          throw new Error(
            "Download afgebroken: bestand te groot."
          );
        }

        chunks.push(value);
      }

    } finally {

      await reader.cancel();
      reader.releaseLock();
    }

    if (totalBytes === 0) {
      throw new Error("Gedownload bestand is leeg.");
    }

    const result = new Uint8Array(totalBytes);

    let offset = 0;

    for (const chunk of chunks) {

      result.set(chunk, offset);

      offset += chunk.byteLength;
    }

    return result;
  }

  throw new Error("Bestand kon niet worden gedownload.");
}

export function hasPdfSignature(
  bytes: Uint8Array
): boolean {

  const header = new TextDecoder().decode(
    bytes.subarray(0, 5)
  );

  return header === "%PDF-";
}
