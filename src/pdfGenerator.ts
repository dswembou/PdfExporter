
import { chromium } from "playwright";

export async function generatePdf(): Promise<Buffer> {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();

    const html = `
      <!DOCTYPE html>
      <html lang="nl">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #222;
              line-height: 1.6;
              padding: 30px;
            }

            h1 {
              color: #17365d;
              font-size: 32px;
            }

            h2 {
              color: #245a81;
              border-bottom: 1px solid #ddd;
              padding-bottom: 8px;
            }

            .cover {
              text-align: center;
              padding-top: 150px;
              page-break-after: always;
            }

            .chapter {
              break-before: page;
            }

            @page {
              size: A4;
              margin: 20mm;
            }
          </style>
        </head>
        <body>
          <section class="cover">
            <h1>Basis programmeren</h1>
            <p>Software Developer - Leerjaar 1</p>
            <p>Canvas PDF Exporter</p>
          </section>

          <section>
            <h2>Inhoudsopgave</h2>
            <p>1. Introductie programmeren</p>
            <p>2. Variabelen en datatypes</p>
          </section>

          <section class="chapter">
            <h2>1. Introductie programmeren</h2>
            <p>
              In deze les maak je kennis met programmeren.
              Je leert wat een programmeertaal is en hoe
              een computer instructies uitvoert.
            </p>
          </section>

          <section class="chapter">
            <h2>2. Variabelen en datatypes</h2>
            <p>
              Variabelen worden gebruikt om gegevens
              tijdelijk op te slaan.
            </p>
            <pre><code>naam = "Student"
leeftijd = 18
print(naam)</code></pre>
          </section>
        </body>
      </html>
    `;

    await page.setContent(html, {
      waitUntil: "load"
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="
          font-size: 9px;
          width: 100%;
          text-align: center;
          color: #777;
        ">
          Pagina <span class="pageNumber"></span>
        </div>
      `,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "20mm",
        right: "20mm"
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
