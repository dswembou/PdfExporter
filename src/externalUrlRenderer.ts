
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

export function renderExternalUrl(
  title: string,
  externalUrl: string
): string {

  let safeUrl: string;

  try {

    const parsedUrl = new URL(externalUrl);

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      throw new Error("Ongeldig protocol");
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new Error("Inloggegevens in URL");
    }

    safeUrl = parsedUrl.href;

  } catch {

    return `
      <div class="external-url">
        <strong>${escapeHtml(title)}</strong>
        <p>Geen geldige externe URL beschikbaar.</p>
      </div>
    `;
  }

  return `
    <section class="external-url">

      <div class="external-url-label">
        EXTERNE BRON
      </div>

      <h3>${escapeHtml(title)}</h3>

      <p>
        Raadpleeg de onderstaande website voor
        aanvullende informatie of lesmateriaal.
      </p>

      <a href="${escapeHtml(safeUrl)}">
        ${escapeHtml(safeUrl)}
      </a>

    </section>
  `;
}

export const externalUrlStyles = `

  .external-url {
    margin: 20px 0;
    padding: 15px;
    background: #f5f8fa;
    border: 1px solid #ccd6e0;
    border-left: 4px solid #245a81;
    break-inside: avoid;
  }

  .external-url-label {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1.5px;
    color: #245a81;
  }

  .external-url h3 {
    margin: 8px 0;
    font-size: 18px;
    color: #17365d;
  }

  .external-url p {
    font-size: 13px;
    margin: 8px 0;
  }

  .external-url a {
    font-size: 13px;
    color: #245a81;
    text-decoration: underline;
    overflow-wrap: anywhere;
  }

`;
