
import { createRequire } from "node:module";
import path from "node:path";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);

const packagePath = require.resolve(
  "pdfjs-dist/package.json"
);

const packageDirectory = path.dirname(
  packagePath
);

const standardFontsDirectory = path.join(
  packageDirectory,
  "standard_fonts"
);

if (!existsSync(standardFontsDirectory)) {
  throw new Error(
    "PDF.js standard_fonts map niet gevonden."
  );
}

export const pdfJsConfig = {
  standardFontDataUrl:
    standardFontsDirectory.replace(/\\/g, "/") + "/",

  isEvalSupported: false
};
