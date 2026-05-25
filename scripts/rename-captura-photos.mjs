/**
 * Renombra fotos "Captura de pantalla *" en photos/ para que Git las pueda versionar.
 * Nuevo nombre: {grupo}-equipo-{N}.{ext}
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gradosRoot = path.join(__dirname, "../public/grados");

const PREFIX = "Captura de pantalla";
let renamed = 0;
let skipped = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!ent.name.startsWith(".")) walk(full);
      continue;
    }
    if (!ent.name.startsWith(PREFIX)) continue;

    const photosDir = path.dirname(full);
    if (path.basename(photosDir) !== "photos") {
      skipped++;
      continue;
    }

    const teamDir = path.dirname(photosDir);
    const grupo = path.basename(path.dirname(teamDir));
    const equipoDir = path.basename(teamDir);
    const m = equipoDir.match(/^equipo-(\d+)$/i);
    if (!m) {
      console.warn("[skip] sin equipo-N:", full);
      skipped++;
      continue;
    }

    const ext = path.extname(ent.name).toLowerCase() || ".jpg";
    const newName = `${grupo}-equipo-${m[1]}${ext}`;
    const dest = path.join(photosDir, newName);

    if (fs.existsSync(dest)) {
      console.warn("[skip] ya existe:", dest);
      skipped++;
      continue;
    }

    fs.renameSync(full, dest);
    console.log(`${path.relative(gradosRoot, full)} -> ${newName}`);
    renamed++;
  }
}

if (!fs.existsSync(gradosRoot)) {
  console.error("No existe public/grados");
  process.exit(1);
}

walk(gradosRoot);
console.log(`\n[rename-captura] renombrados=${renamed} omitidos=${skipped}`);
