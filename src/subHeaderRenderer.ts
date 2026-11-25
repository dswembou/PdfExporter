
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

export function renderSubHeader(title: string): string {

  return `
    <div class="module-subheader">
      <h3>${escapeHtml(title)}</h3>
    </div>
  `;
}

export const subHeaderStyles = `

  .module-subheader {
    margin-top: 30px;
    margin-bottom: 15px;
    padding: 10px 15px;
    background: #edf2f7;
    border-bottom: 2px solid #245a81;
    break-inside: avoid;
    break-after: avoid;
  }

  .module-subheader h3 {
    margin: 0;
    font-size: 18px;
    font-weight: bold;
    color: #17365d;
  }

`;
