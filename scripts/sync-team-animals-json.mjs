/**
 * Mantiene public/grados/<grado>/<grupo>/<equipo>/animals.json por carpeta de equipo:
 * une las fotos que hay en disco con el JSON existente
 * y rellena photo, animal, globeCountry y campos vacíos. No borra textos que ya pusiste.
 *
 * Ejecutar: npm run team:animals
 * (también se lanza tras npm run photos:manifest)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { collectAllImageRelPaths } from "./lib/listTeamImageFiles.mjs";
import { GRADE1_SLUGS } from "../src/countries.js";
import { relativeTeamDirFromFolderId } from "./lib/teamStoragePaths.mjs";
import {
  inferAnimalLabelFromPhotoPath,
  inferGlobeCountryFromPhotoPath,
} from "../proyecto/src/utils/teamGlobeFromManifest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../public/grados");

/** No regenerar animals.json: globo + JSON propio gestionado a mano. */
const SKIP_ANIMALS_SYNC_FOLDER_IDS = new Set(["mexico-equipo-1"]);
const COUNTRY_LAT_LON = {
  Mexico: { lat: 23.6345, lon: -102.5528 },
  Peru: { lat: -9.19, lon: -75.0152 },
  Brasil: { lat: -14.235, lon: -51.9253 },
  Australia: { lat: -25.2744, lon: 133.7751 },
  India: { lat: 20.5937, lon: 78.9629 },
  Canada: { lat: 56.1304, lon: -106.3468 },
  Kenia: { lat: -0.0236, lon: 37.9062 },
  Japon: { lat: 36.2048, lon: 138.2529 },
  Argentina: { lat: -38.4161, lon: -63.6167 },
  Egipto: { lat: 26.8206, lon: 30.8025 },
  Espana: { lat: 40.4637, lon: -3.7492 },
  China: { lat: 35.8617, lon: 104.1954 },
  "Estados Unidos": { lat: 37.0902, lon: -95.7129 },
};
function readExistingAnimals(teamDir) {
  const candidates = [path.join(teamDir, "animals.json")];
  for (const fp of candidates) {
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (Array.isArray(raw)) return raw;
    } catch {
      // probar siguiente
    }
  }
  return [];
}

function stubEntry(photoRel) {
  const p = String(photoRel).trim();
  const globeCountry = inferGlobeCountryFromPhotoPath(p);
  const coords = COUNTRY_LAT_LON[globeCountry] || null;
  return {
    photo: p,
    globeCountry,
    country: globeCountry,
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    animal: inferAnimalLabelFromPhotoPath(p),
    animalDescription: "",
    countryDescription: "",
    habitat: "",
    diet: "",
    size: "",
    interestingFact: "",
  };
}

function mergeWithStub(existing, stub) {
  if (!existing || typeof existing !== "object") return { ...stub };
  const o = {
    ...stub,
    ...existing,
    photo: String(existing.photo || stub.photo).trim(),
  };
  if (!String(o.animal ?? "").trim()) o.animal = stub.animal;
  if (!String(o.globeCountry ?? "").trim()) o.globeCountry = stub.globeCountry;
  if (!String(o.country ?? "").trim()) o.country = o.globeCountry || stub.country;
  if (!Number.isFinite(Number(o.lat))) o.lat = stub.lat;
  if (!Number.isFinite(Number(o.lon))) o.lon = stub.lon;
  return o;
}

function orderedPathsForTeam(diskFiles, existingList) {
  const diskSet = new Set(diskFiles);
  const seen = new Set();
  const paths = [];
  for (const e of existingList) {
    const p = e?.photo?.trim();
    if (!p || seen.has(p)) continue;
    if (!diskSet.has(p)) continue;
    seen.add(p);
    paths.push(p);
  }
  for (const p of [...diskFiles].sort((a, b) => a.localeCompare(b, "es"))) {
    if (seen.has(p)) continue;
    seen.add(p);
    paths.push(p);
  }
  return paths;
}

function buildTeamAnimalsArray(teamDir) {
  const teamRel = path.relative(root, teamDir).split(path.sep).filter(Boolean);
  const teamRelEncoded = teamRel.map((seg) => encodeURIComponent(seg)).join("/");
  const diskFiles = collectAllImageRelPaths(teamDir);
  const existing = readExistingAnimals(teamDir);
  const paths = orderedPathsForTeam(diskFiles, existing);
  const byPhoto = new Map(
    existing.filter((e) => e?.photo?.trim()).map((e) => [e.photo.trim(), e])
  );
  return paths.map((p) => {
    const merged = mergeWithStub(byPhoto.get(p), stubEntry(p));
    const relPhoto = String(merged.photo || p).trim();
    const relPhotoEncoded = relPhoto
      .split("/")
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const canonicalImageUrl = `/grados/${teamRelEncoded}/${relPhotoEncoded}`;
    const fb =
      typeof merged.vectorFallbackUrl === "string" && merged.vectorFallbackUrl.trim()
        ? merged.vectorFallbackUrl.trim()
        : canonicalImageUrl;
    return {
      ...merged,
      imageUrl: canonicalImageUrl,
      vectorFallbackUrl: fb,
    };
  });
}

function main() {
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  let updated = 0;
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
        if (SKIP_ANIMALS_SYNC_FOLDER_IDS.has(folderId)) continue;

        const parsed = String(folderId).match(/^(.*)-equipo-\d+$/i);
        const prefix = parsed?.[1]?.toLowerCase() ?? "";
        if (!GRADE1_SLUGS.includes(prefix)) continue;

        const rel = relativeTeamDirFromFolderId(folderId);
        if (!rel) continue;
        const dir = path.join(root, ...rel.split("/"));

        const next = buildTeamAnimalsArray(dir);
        const nextStr = `${JSON.stringify(next, null, 2)}\n`;
        const targets = [
          path.join(dir, "animals.json"),
        ];
        let changed = false;
        for (const fp of targets) {
          const prev =
            fs.existsSync(fp) && fs.statSync(fp).isFile()
              ? fs.readFileSync(fp, "utf8")
              : "";
          if (prev !== nextStr) {
            fs.writeFileSync(fp, nextStr);
            changed = true;
          }
        }
        if (changed) updated += 1;
      }
    }
  }

  console.info(
    `[alamos] animals.json sincronizado en ${updated} carpeta(s) de equipo (resto sin cambios).`
  );
}

main();
