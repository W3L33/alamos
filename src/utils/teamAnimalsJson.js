/**
 * Lista por equipo: public/grados/<grado>/<grupo>/<equipo>/animals.json.
 * Campos habituales: photo (ruta relativa), animal, globeCountry, animalDescription,
 * countryDescription, habitat, diet, size, interestingFact.
 * Mantener con: npm run team:animals (o npm run photos:manifest).
 */

import { sitePath } from "./teamGlobeFromManifest.js";
import {
  parseTeamFolderId,
  teamBasePublicPathFromFolderId,
} from "./teamStoragePaths.js";
import { gradosAssetUrl } from "./teamPhotos.js";

function animalsJsonUrl(pathFromRoot) {
  const p = sitePath(pathFromRoot);
  return import.meta.env.DEV ? `${p}?t=${Date.now()}` : p;
}

/** Solo 3º: prueba /grados/3º/... y /grados/3/... (carpeta numérica). */
export function grade3PublicBaseCandidates(folderId) {
  const parsed = parseTeamFolderId(folderId);
  if (!parsed) return [];
  const canonical = teamBasePublicPathFromFolderId(folderId, 3);
  const alt = `/grados/3/${parsed.countrySlug}/equipo-${parsed.teamNum}`;
  if (canonical === alt) return [canonical];
  return [canonical, alt];
}

export function teamPhotoPublicUrlFromBase(basePath, photoRelPath) {
  if (!basePath) return "";
  let rel = String(photoRelPath).trim().replace(/\\/g, "/");
  if (!rel.toLowerCase().startsWith("photos/")) {
    rel = `photos/${rel.replace(/^\//, "")}`;
  }
  const relRaw = rel.split("/").filter(Boolean).join("/");
  return gradosAssetUrl(`${basePath}/${relRaw}`);
}

/** 3º: primer animals.json que responda 200, con la base pública usada. */
export async function fetchTeamAnimalsJsonGrade3(folderId) {
  if (!folderId) return null;
  for (const basePath of grade3PublicBaseCandidates(folderId)) {
    const p = `${basePath}/animals.json`;
    const response = await fetch(animalsJsonUrl(p), {
      cache: import.meta.env.DEV ? "no-store" : "default",
    });
    if (!response.ok) continue;
    try {
      const data = await response.json();
      if (Array.isArray(data) && data.length)
        return { entries: data, basePath };
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchTeamAnimalsJson(folderId, uiGrade) {
  if (!folderId) return null;
  const basePath = teamBasePublicPathFromFolderId(folderId, uiGrade);
  if (!basePath) return null;
  const paths = [
    `${basePath}/animals.json`,
  ];
  for (const p of paths) {
    const url = animalsJsonUrl(p);
    const response = await fetch(url, {
      cache: import.meta.env.DEV ? "no-store" : "default",
    });
    if (!response.ok) continue;
    try {
      const data = await response.json();
      if (Array.isArray(data)) return data;
    } catch {
      continue;
    }
  }
  return null;
}

export function teamPhotoPublicUrl(folderId, photoRelPath, uiGrade) {
  const basePath = teamBasePublicPathFromFolderId(folderId, uiGrade);
  if (!basePath) return "";
  let rel = String(photoRelPath).trim().replace(/\\/g, "/");
  if (!rel.toLowerCase().startsWith("photos/")) {
    rel = `photos/${rel.replace(/^\//, "")}`;
  }
  const relRaw = rel.split("/").filter(Boolean).join("/");
  return gradosAssetUrl(`${basePath}/${relRaw}`);
}

/** Elige una entrada aleatoria con photo y animal válidos. */
export function pickRandomAnimalPhotoEntry(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const valid = entries.filter(
    (e) =>
      e &&
      typeof e.photo === "string" &&
      e.photo.trim() &&
      String(e.animal ?? "").trim()
  );
  if (!valid.length) return null;
  const i = Math.floor(Math.random() * valid.length);
  return valid[i];
}
