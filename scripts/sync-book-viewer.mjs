/**
 * Propaga el visor de revistas (main.js, index.html, estilos) a todos los equipos.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gradosRoot = path.join(root, "public/grados");
const mainTemplate = path.join(__dirname, "templates/book-main.js");
const indexTemplate = path.join(__dirname, "templates/book-index.html");
const mobileIndexTemplate = path.join(__dirname, "templates/book-mobile-index.html");
const desktopIndexTemplate = path.join(__dirname, "templates/book-desktop-index.html");
const stylesSnippet = path.join(__dirname, "templates/book-styles-snippet.css");
const STYLE_MARKER = "/* --- Alta calidad revista";

const mainSrc = fs.readFileSync(mainTemplate, "utf8");
const indexSrc = fs.readFileSync(indexTemplate, "utf8");
const mobileIndexSrc = fs.readFileSync(mobileIndexTemplate, "utf8");
const desktopIndexSrc = fs.readFileSync(desktopIndexTemplate, "utf8");
const styleSrc = fs.readFileSync(stylesSnippet, "utf8");

let mainCount = 0;
let indexCount = 0;
let mobileIndexCount = 0;
let desktopIndexCount = 0;
let styleCount = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "book") {
        const indexPath = path.join(full, "index.html");
        const mobilePath = path.join(full, "mobile", "index.html");
        const desktopPath = path.join(full, "desktop", "index.html");
        if (fs.existsSync(indexPath)) {
          fs.writeFileSync(indexPath, indexSrc, "utf8");
          indexCount++;
        }
        if (fs.existsSync(mobilePath)) {
          fs.writeFileSync(mobilePath, mobileIndexSrc, "utf8");
          mobileIndexCount++;
        }
        if (fs.existsSync(desktopPath)) {
          fs.writeFileSync(desktopPath, desktopIndexSrc, "utf8");
          desktopIndexCount++;
        }
      }
      walk(full);
      continue;
    }
    if (ent.name === "main.js" && full.includes(`${path.sep}book${path.sep}`)) {
      const parent = path.basename(path.dirname(full));
      if (parent === "mobile" || parent === "desktop") {
        fs.writeFileSync(full, mainSrc, "utf8");
        mainCount++;
      }
    }
    if (ent.name === "styles.css" && full.includes(`${path.sep}book${path.sep}`)) {
      const parent = path.basename(path.dirname(full));
      if (parent !== "mobile" && parent !== "desktop") continue;
      let css = fs.readFileSync(full, "utf8");
      if (!css.includes(STYLE_MARKER)) {
        css = css.trimEnd() + styleSrc;
        fs.writeFileSync(full, css, "utf8");
        styleCount++;
      }
    }
  }
}

if (!fs.existsSync(gradosRoot)) {
  console.error("[sync-book-viewer] No existe public/grados");
  process.exit(1);
}

walk(gradosRoot);
console.log(
  `[sync-book-viewer] main.js → ${mainCount}, index.html → ${indexCount}, mobile → ${mobileIndexCount}, desktop → ${desktopIndexCount}, styles → ${styleCount}`
);
