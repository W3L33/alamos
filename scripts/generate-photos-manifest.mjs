/**
 * Genera photos-manifest.json listando imágenes por carpeta de equipo.
 *
 * Grupo escolar + equipo (ej. mexico-equipo-1) ≠ país del animal en el globo 3D.
 * Fotos por país del animal, por ejemplo:
 *   <carpeta-equipo>/china/china-panda-gigante.jpg
 *   <carpeta-equipo>/mexico/mexico-ajolote.jpg
 *
 * Si existe `animals.json` con rutas `photo`, se unen con las imágenes en disco
 * (recursivo, incl. `photos/`). Tras este script suele ejecutarse `sync-team-animals-json.mjs`
 * (npm run photos:manifest) para mantener un animals.json por equipo alineado con las fotos.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { collectAllImageRelPaths } from "./lib/listTeamImageFiles.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../public/grados");

function readAnimalsJsonPhotoPaths(teamDir) {
  const candidates = [path.join(teamDir, "animals.json")];
  for (const fp of candidates) {
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (!Array.isArray(raw)) continue;
      const paths = [];
      for (const row of raw) {
        if (row && typeof row.photo === "string" && row.photo.trim()) {
          paths.push(row.photo.trim());
          continue;
        }
        if (row && typeof row.imageUrl === "string" && row.imageUrl.trim()) {
          const url = row.imageUrl.trim();
          const marker = "/grados/";
          const idx = url.indexOf(marker);
          if (idx >= 0) {
            const tail = url.slice(idx + marker.length);
            const segs = tail.split("/").filter(Boolean);
            if (segs.length >= 4) paths.push(segs.slice(3).join("/"));
          }
        }
      }
      return paths;
    } catch {
      // probar siguiente candidato
    }
  }
  return null;
}

function collectImageRelPaths(teamDir) {
  const fromDisk = collectAllImageRelPaths(teamDir);
  const fromAnimalsJson = readAnimalsJsonPhotoPaths(teamDir);
  if (fromAnimalsJson != null && fromAnimalsJson.length > 0) {
    // Todo lo que está en photos/ sale del escaneo en disco (cualquier nombre .jpg/.png/…).
    // No mezclar rutas "photos/..." del JSON que apunten a archivos ya borrados.
    const jsonExtra = fromAnimalsJson.filter((p) => {
      const norm = String(p).replace(/\\/g, "/").trim();
      return norm && !norm.toLowerCase().startsWith("photos/");
    });
    const set = new Set([...fromDisk, ...jsonExtra]);
    return [...set].sort();
  }
  return fromDisk;
}

function main() {
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  const manifest = {};
  const grades = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);

  for (const grade of grades) {
    const gradeDir = path.join(root, grade);
    const groups = fs
      .readdirSync(gradeDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);

    for (const group of groups) {
      const groupDir = path.join(gradeDir, group);
      if (!fs.existsSync(groupDir) || !fs.statSync(groupDir).isDirectory()) continue;
      const teamDirs = fs
        .readdirSync(groupDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^equipo-\d+$/i.test(d.name))
        .map((d) => d.name);

      for (const teamDirName of teamDirs) {
        const teamNum = teamDirName.replace(/^equipo-/i, "");
        const folderId = `${group}-equipo-${teamNum}`;
        const teamDir = path.join(groupDir, teamDirName);
        const files = collectImageRelPaths(teamDir);
        if (files.length) manifest[`${grade}/${folderId}`] = files;
      }
    }
  }

  fs.writeFileSync(path.join(root, "photos-manifest.json"), JSON.stringify(manifest, null, 2));
}

main();
