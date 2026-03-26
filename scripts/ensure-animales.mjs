/**
 * predev: comprueba que exista el bundle del globo embebido (public/animales).
 * No intenta compilar proyecto/ si no hay tooling completo.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const indexHtml = path.join(root, "public", "animales", "index.html");

if (!fs.existsSync(indexHtml)) {
  console.warn(
    "[alamos] Falta public/animales/index.html. El iframe del globo no cargará hasta que exista ese bundle."
  );
  process.exit(0);
}

console.log("[alamos] public/animales listo.");
process.exit(0);
