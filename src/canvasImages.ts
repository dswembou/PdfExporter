
import { JSDOM } from "jsdom";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 50;

interface CanvasFile {
  id: number;
  url: string;
  "content-type"?: string;
}

function getCanvasFileId(
  image: HTMLImageElement
): string | null {
  const attachmentId =
    image.getAttribute("data-api-endpoint");

  if (attachmentId) {
    const match = attachmentId.match(/\/files\/(\d+)/);
    if (match) return match[1];
  }

  const src = image.getAttribute("src") ?? "";
  const match = src.match(/\/files\/(\d+)/);

  return match?.[1] ?? null;
}

export async function embedCanvasImages(
  html: string,
  canvasBaseUrl: string,
  token: string
): Promise<string> {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const images = [...document.querySelectorAll("img")];

  if (images.length > MAX_IMAGES) {
    dom.window.close();
    throw new Error(
      `Te veel afbeeldingen: ${images.length}. Maximum: ${MAX_IMAGES}.`
    );
  }

  const canvasOrigin = new URL(canvasBaseUrl).origin;

  try {
    for (const image of images) {
      const fileId = getCanvasFileId(image);

      if (!fileId) {
        image.replaceWith(
          document.createTextNode(
            "[Externe of niet-ondersteunde afbeelding]"
          )
        );
        continue;
      }

      try {
        const metadataResponse = await fetch(
          `${canvasOrigin}/api/v1/files/${fileId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json"
            },
            redirect: "error"
          }
        );

        if (!metadataResponse.ok) {
          throw new Error(
            `Metadata niet beschikbaar: ${metadataResponse.status}`
          );
        }

        const file = await metadataResponse.json() as CanvasFile;
        const imageUrl = new URL(file.url);

        // Alleen bestanden van dezelfde Canvas-host ophalen.
        // Andere opslaglocaties vereisen later een
        // afzonderlijke, gecontroleerde downloadmethode.
        if (
          imageUrl.origin !== canvasOrigin ||
          imageUrl.protocol !== "https:"
        ) {
          throw new Error("Niet-toegestane bestandslocatie");
        }


        const allowedDownloadHosts = new Set([
            new URL(canvasOrigin).hostname,
            "cdn.inst-fs-fra-prod.inscloudgate.net",
            "inst-fs-fra-prod.inscloudgate.net"
            ]);

        function isAllowedDownloadHost(hostname: string): boolean {
        const host = hostname.toLowerCase();

        // De eigen Canvas-omgeving en het eerder
        // gecontroleerde CDN.
        if (allowedDownloadHosts.has(host)) {
            return true;
        }

        // Canvas-bestandsservers met het formaat:
        // a23678-2441.cluster265.canvas-user-content.com
        const canvasFileHost =
            /^a\d+-\d+\.cluster\d+\.canvas-user-content\.com$/;

        return canvasFileHost.test(host);
        }

        let currentUrl = imageUrl;
        let imageResponse: Response | undefined;

        for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
        
        const isHttps = currentUrl.protocol === "https:";
        const isAllowedHost = isAllowedDownloadHost(
            currentUrl.hostname
            );
        const isAllowedPort =
        currentUrl.port === "" || currentUrl.port === "443";

        if (!isHttps || !isAllowedHost || !isAllowedPort) {
        console.warn("Downloadlocatie geweigerd:", {
            hostname: currentUrl.hostname,
            protocol: currentUrl.protocol,
            port: currentUrl.port || "standaard",
            isHttps,
            isAllowedHost,
            isAllowedPort
        });

        throw new Error("Niet-toegestane downloadlocatie");
        }


        imageResponse = await fetch(currentUrl, {
            method: "GET",
            redirect: "manual",
            signal: AbortSignal.timeout(15000)
        });

        if (
            [301, 302, 303, 307, 308].includes(imageResponse.status)
        ) {
            if (redirectCount === 3) {
            await imageResponse.body?.cancel();
            throw new Error("Te veel redirects");
            }

            const location = imageResponse.headers.get("location");
            await imageResponse.body?.cancel();

            if (!location) {
            throw new Error("Redirect zonder locatie");
            }

            currentUrl = new URL(location, currentUrl);
            continue;
        }

        break;
        }

        if (!imageResponse?.ok) {
        throw new Error(
            `Afbeelding niet beschikbaar: ${imageResponse?.status}`
        );
        }

        console.log(
        `Afbeelding ${fileId}: download via ${currentUrl.hostname}`
        );


        if (!imageResponse.ok) {
          throw new Error(
            `Afbeelding niet beschikbaar: ${imageResponse.status}`
          );
        }

        const contentType = imageResponse.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase();

        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/gif",
          "image/webp"
        ];

        if (!contentType || !allowedTypes.includes(contentType)) {
          throw new Error(
            `Niet-ondersteund afbeeldingstype: ${contentType}`
          );
        }

        const contentLength = Number(
          imageResponse.headers.get("content-length") ?? 0
        );

        if (contentLength > MAX_IMAGE_BYTES) {
          throw new Error("Afbeelding is te groot");
        }

        const bytes = Buffer.from(
          await imageResponse.arrayBuffer()
        );

        if (bytes.length > MAX_IMAGE_BYTES) {
          throw new Error("Afbeelding is te groot");
        }

        const base64 = bytes.toString("base64");

        image.setAttribute(
          "src",
          `data:${contentType};base64,${base64}`
        );

        image.removeAttribute("srcset");

        console.log(`Afbeelding ${fileId} toegevoegd`);
      } catch (error) {
        console.warn(
          `Afbeelding ${fileId} overgeslagen:`,
          error instanceof Error ? error.message : error
        );

        image.replaceWith(
          document.createTextNode(
            `[Afbeelding ${fileId} niet beschikbaar]`
          )
        );
      }
    }

    return document.body.innerHTML;
  } finally {
    dom.window.close();
  }
}
