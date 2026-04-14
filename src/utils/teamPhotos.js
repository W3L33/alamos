import { DEFAULT_TEAM_IMAGE } from "../teamPlaceholders.js";
import { sitePath } from "./teamGlobeFromManifest.js";
import {
  gradeDirFromUiGrade,
  parseTeamFolderId,
  teamBasePublicPathFromFolderId,
} from "./teamStoragePaths.js";

/**
 * Ruta bajo public (p. ej. /grados/3º/…/welee.jpg) con cada segmento codificado
 * y prefijo según import.meta.env.BASE_URL (./ en este proyecto).
 */
export function gradosAssetUrl(absolutePathFromSiteRoot) {
  const raw = String(absolutePathFromSiteRoot).replace(/^\/+/, "");
  const enc = raw
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return sitePath(`/${enc}`);
}

/** Solo 3º: carpeta en disco puede ser 3º / 3° / 3o; el manifiesto usa el nombre real del directorio. */
function isThirdGradeDirSegment(seg) {
  const s = String(seg || "").normalize("NFC");
  return (
    s === "3" ||
    s === "3º" ||
    s === "3°" ||
    s.toLowerCase() === "3o" ||
    /^3[\u00ba\u00b0o]$/i.test(s)
  );
}

/** Busca entrada "grado/pais-equipo-n" para 3º con tolerancia al carácter del ordinal. */
function resolveGrade3ManifestEntry(manifest, folderId) {
  if (!manifest || typeof manifest !== "object" || !folderId) return null;
  const target = String(folderId).normalize("NFC").toLowerCase();
  for (const k of Object.keys(manifest)) {
    const slash = k.indexOf("/");
    if (slash < 0) continue;
    const gradeSeg = k.slice(0, slash);
    const fid = k.slice(slash + 1).normalize("NFC").toLowerCase();
    if (fid !== target) continue;
    if (!isThirdGradeDirSegment(gradeSeg)) continue;
    const files = manifest[k];
    if (Array.isArray(files) && files.length) return { key: k, files };
  }
  return null;
}

function teamBaseFromManifestCompositeKey(key) {
  const slash = String(key).indexOf("/");
  if (slash < 0) return "";
  const gradeSeg = key.slice(0, slash);
  const fid = key.slice(slash + 1);
  const parsed = parseTeamFolderId(fid);
  if (!parsed) return "";
  return `/grados/${gradeSeg}/${parsed.countrySlug}/equipo-${parsed.teamNum}`;
}

let manifestPromise = null;

export function getPhotosManifest() {
  // En desarrollo, no reutilizar la primera petición: el manifiesto cambia al añadir fotos.
  if (import.meta.env.DEV) {
    return fetch(`/grados/photos-manifest.json?t=${Date.now()}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) return {};
        try {
          return await r.json();
        } catch {
          return {};
        }
      })
      .catch(() => ({}));
  }

  if (!manifestPromise) {
    manifestPromise = fetch("/grados/photos-manifest.json", {
      cache: "default",
    })
      .then(async (r) => {
        if (!r.ok) {
          manifestPromise = null;
          return {};
        }
        try {
          return await r.json();
        } catch {
          manifestPromise = null;
          return {};
        }
      })
      .catch(() => {
        manifestPromise = null;
        return {};
      });
  }
  return manifestPromise;
}

export function clearPhotosManifestCache() {
  manifestPromise = null;
}

/**
 * Lista de archivos en manifiesto. Claves nuevas: "2º/pais-equipo-N"; legado: "pais-equipo-N".
 * @param {1|2|3|undefined} uiGrade grado de la vista (obligatorio para 2º/3º)
 */
export function resolveFolderFiles(manifest, folderId, uiGrade) {
  if (!manifest || typeof manifest !== "object" || !folderId) return null;

  const candidates = [];
  if (uiGrade === 1 || uiGrade === 2 || uiGrade === 3) {
    const gd = gradeDirFromUiGrade(uiGrade);
    if (gd) candidates.push(`${gd}/${folderId}`);
  }
  candidates.push(folderId);

  const lowered = candidates.map((c) => c.toLowerCase());
  for (const k of Object.keys(manifest)) {
    if (!lowered.includes(k.toLowerCase())) continue;
    const files = manifest[k];
    if (Array.isArray(files) && files.length) return files;
  }

  const target = String(folderId).toLowerCase();
  const legacyKey = Object.keys(manifest).find(
    (k) => !k.includes("/") && k.toLowerCase() === target
  );
  if (legacyKey) {
    const files = manifest[legacyKey];
    if (Array.isArray(files) && files.length) return files;
  }
  return null;
}

function randomIntBelow(max) {
  if (max <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Elige un archivo al azar de la carpeta del equipo y devuelve la URL pública.
 * Cada folderId usa solo entradas de su propia carpeta en el manifiesto.
 */
export function randomPhotoUrlFromManifest(folderId, manifest, uiGrade) {
  if (Number(uiGrade) === 3) {
    const g3 = resolveGrade3ManifestEntry(manifest, folderId);
    if (g3?.files?.length) {
      const file = g3.files[randomIntBelow(g3.files.length)];
      const basePath = teamBaseFromManifestCompositeKey(g3.key);
      if (!basePath) return DEFAULT_TEAM_IMAGE;
      const relRaw = String(file)
        .split("/")
        .filter(Boolean)
        .join("/");
      return gradosAssetUrl(`${basePath}/${relRaw}`);
    }
  }

  const files = resolveFolderFiles(manifest, folderId, uiGrade);
  if (!files?.length) return DEFAULT_TEAM_IMAGE;

  const file = files[randomIntBelow(files.length)];

  const basePath = teamBasePublicPathFromFolderId(folderId, uiGrade);
  if (!basePath) return DEFAULT_TEAM_IMAGE;
  const relRaw = String(file)
    .split("/")
    .filter(Boolean)
    .join("/");
  return gradosAssetUrl(`${basePath}/${relRaw}`);
}
