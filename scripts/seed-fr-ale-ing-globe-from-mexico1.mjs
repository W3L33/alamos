/**
 * Réplica el patrón México equipo-1 (photos/ + countries-animals.json + imágenes)
 * en Francia, Alemania e Inglaterra, équipos 1…8.
 *
 * - Lee solo public/grados/1º/mexico/equipo-1/photos/ (plantilla). No escribe bajo mexico/.
 * - Solo crea/modifica public/grados/1º/{francia,alemania,inglaterra}/equipo-n/photos/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gradeDir = path.join(__dirname, "../public/grados/1º");
const templatePhotos = path.join(gradeDir, "mexico", "equipo-1", "photos");
const GROUPS = ["francia", "alemania", "inglaterra"];
const IMAGE_EXT = /\.(avif|gif|jpe?g|png|webp)$/i;

function copyIfMissing(from, to) {
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) return false;
  if (fs.existsSync(to)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function main() {
  const templateJson = path.join(templatePhotos, "countries-animals.json");
  if (!fs.existsSync(templateJson)) {
    console.error(
      "seed-fr-ale-ing-globe: falta plantilla public/grados/1º/mexico/equipo-1/photos/countries-animals.json"
    );
    process.exit(1);
  }
  const templateText = fs.readFileSync(templateJson, "utf8");

  let wroteJson = 0;
  let copiedImg = 0;

  for (const group of GROUPS) {
    for (let n = 1; n <= 8; n++) {
      const destPhotos = path.join(gradeDir, group, `equipo-${n}`, "photos");
      fs.mkdirSync(destPhotos, { recursive: true });

      const destJson = path.join(destPhotos, "countries-animals.json");
      if (!fs.existsSync(destJson)) {
        fs.writeFileSync(destJson, templateText, "utf8");
        wroteJson++;
      }

      for (const name of fs.readdirSync(templatePhotos)) {
        if (!IMAGE_EXT.test(name)) continue;
        const from = path.join(templatePhotos, name);
        const to = path.join(destPhotos, name);
        if (copyIfMissing(from, to)) copiedImg++;
      }
    }
  }

  console.log(
    `[seed-fr-ale-ing-globe] countries-animals.json nuevos=${wroteJson} imágenes copiadas (solo faltantes)=${copiedImg}`
  );
}

main();
