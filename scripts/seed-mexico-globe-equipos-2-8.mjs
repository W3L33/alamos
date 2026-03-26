/**
 * México équipo 2…8: misma lógica que équipo 1 (photos/ + countries-animals.json).
 * - No modifica nada bajo mexico/equipo-1/.
 * - Copia countries-animals.json solo si no existe en el destino.
 * - Copia imágenes desde equipo-1/photos solo si faltan en el destino (no pisa archivos existentes).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../public/grados/1º/mexico");
const sourceTeam = "equipo-1";
const sourcePhotos = path.join(root, sourceTeam, "photos");
const IMAGE_EXT = /\.(avif|gif|jpe?g|png|webp)$/i;

function copyIfMissing(from, to) {
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) return false;
  if (fs.existsSync(to)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function main() {
  const templateJson = path.join(sourcePhotos, "countries-animals.json");
  if (!fs.existsSync(templateJson)) {
    console.error(
      "seed-mexico-globe-equipos-2-8: falta mexico/equipo-1/photos/countries-animals.json"
    );
    process.exit(1);
  }
  const templateText = fs.readFileSync(templateJson, "utf8");

  let wroteJson = 0;
  let copiedImg = 0;

  for (let n = 2; n <= 8; n++) {
    const team = `equipo-${n}`;
    const destPhotos = path.join(root, team, "photos");
    fs.mkdirSync(destPhotos, { recursive: true });

    const destJson = path.join(destPhotos, "countries-animals.json");
    if (!fs.existsSync(destJson)) {
      fs.writeFileSync(destJson, templateText, "utf8");
      wroteJson++;
    }

    if (fs.existsSync(sourcePhotos)) {
      for (const name of fs.readdirSync(sourcePhotos)) {
        if (!IMAGE_EXT.test(name)) continue;
        const from = path.join(sourcePhotos, name);
        const to = path.join(destPhotos, name);
        if (copyIfMissing(from, to)) copiedImg++;
      }
    }
  }

  console.log(
    `[seed-mexico-globe-equipos-2-8] countries-animals.json nuevos=${wroteJson} imágenes copiadas (solo faltantes)=${copiedImg}`
  );
}

main();
