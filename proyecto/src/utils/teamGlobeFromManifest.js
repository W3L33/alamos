/**
 * Globo embebido (?carpeta=mexico-equipo-1):
 * - "carpeta" = grupo escolar + equipo (ej. México grupo, equipo 1). No define posición en el globo.
 * - Cada animal tiene su país en el mapa 3D (globeCountry o inferido de ruta / nombre china-*.jpg).
 * 1) animals.json en la carpeta del equipo (lista y textos; orden del globo).
 * 2) photos-manifest.json + fotos en disco (unión; el globo muestra todo).
 */

/** Slug (carpeta o prefijo de archivo) → nombre en countries-animals.json */
const SLUG_TO_GLOBE_COUNTRY = {
  mexico: "Mexico",
  peru: "Peru",
  brasil: "Brasil",
  australia: "Australia",
  india: "India",
  canada: "Canada",
  kenia: "Kenia",
  japon: "Japon",
  argentina: "Argentina",
  egipto: "Egipto",
  espana: "Espana",
  china: "China",
  usa: "Estados Unidos",
  eeuu: "Estados Unidos",
  "estados-unidos": "Estados Unidos",
  estados_unidos: "Estados Unidos",
};

const KNOWN_GLOBE_SLUGS = new Set(Object.keys(SLUG_TO_GLOBE_COUNTRY));
const GRADE1_SLUGS = ["mexico", "francia", "alemania", "inglaterra"];
const GRADE3_SLUGS = ["japon", "usa", "argentina", "australia"];

/**
 * Compara nombres de país ignorando mayúsculas y acentos (México ≈ Mexico).
 */
function asciiLowerKey(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Guiones “tipográficos” en nombres de archivo → ASCII, para reconocer china‑panda */
function normalizeStemHyphens(name) {
  return String(name).replace(/[\u2010-\u2015\u2212]/g, "-");
}

/** Respaldo si countries-animals.json no hace match (acentos, carga fallida, etc.) */
const SLUG_LAT_LON = {
  mexico: { lat: 23.6345, lon: -102.5528 },
  peru: { lat: -9.19, lon: -75.0152 },
  brasil: { lat: -14.235, lon: -51.9253 },
  australia: { lat: -25.2744, lon: 133.7751 },
  india: { lat: 20.5937, lon: 78.9629 },
  canada: { lat: 56.1304, lon: -106.3468 },
  kenia: { lat: -0.0236, lon: 37.9062 },
  japon: { lat: 36.2048, lon: 138.2529 },
  argentina: { lat: -38.4161, lon: -63.6167 },
  egipto: { lat: 26.8206, lon: 30.8025 },
  espana: { lat: 40.4637, lon: -3.7492 },
  china: { lat: 35.8617, lon: 104.1954 },
  usa: { lat: 37.0902, lon: -95.7129 },
  eeuu: { lat: 37.0902, lon: -95.7129 },
  "estados-unidos": { lat: 37.0902, lon: -95.7129 },
  estados_unidos: { lat: 37.0902, lon: -95.7129 },
  francia: { lat: 46.2276, lon: 2.2137 },
  alemania: { lat: 51.1657, lon: 10.4515 },
  inglaterra: { lat: 52.3555, lon: -1.1743 },
  italia: { lat: 41.8719, lon: 12.5674 },
  belgica: { lat: 50.5039, lon: 4.4699 },
  "paises-bajos": { lat: 52.1326, lon: 5.2913 },
};

/**
 * Prefijo del sitio cuando el globo se sirve bajo …/animales/ (p. ej. /alamos).
 * Así /data y /images resuelven bien y los marcadores usan el país correcto con datos cargados.
 */
export function embedSitePrefix() {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname || "";
  const i = path.indexOf("/animales");
  if (i < 0) return "";
  return path.slice(0, i);
}

/**
 * Prefijo para /data, /images, etc. Respeta `base` de Vite (`/`, `/repo/`, `./`).
 * `./` hace que en iframes y subcarpetas las URLs resuelvan frente al index actual.
 */
function withViteBase(pathFromRoot) {
  const rel = String(pathFromRoot).replace(/^\//, "");
  const base = import.meta.env.BASE_URL ?? "/";
  if (base === "/" || base === "") {
    return `/${rel}`;
  }
  if (base === "./" || base === ".") {
    return `./${rel}`;
  }
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${prefix}/${rel}`;
}

export function sitePath(absoluteFromSiteRoot) {
  const p = String(absoluteFromSiteRoot);
  if (!p.startsWith("/")) return p;
  const embed = embedSitePrefix();
  if (embed) return embed + p;
  return withViteBase(p);
}

export function countrySlugFromCarpeta(carpeta) {
  const m = String(carpeta).match(/^(.*)-equipo-\d+$/i);
  return m ? m[1].toLowerCase() : String(carpeta).toLowerCase();
}

export function resolveFolderFiles(manifest, folderId) {
  if (!manifest || typeof manifest !== "object" || !folderId) return null;
  const prefixed = `1º/${folderId}`;
  for (const key of [folderId, prefixed]) {
    const direct = manifest[key];
    if (Array.isArray(direct) && direct.length) return direct;
  }
  const target = String(folderId).toLowerCase();
  const prefTarget = prefixed.toLowerCase();
  const found = Object.keys(manifest).find((k) => {
    const kl = k.toLowerCase();
    return kl === target || kl === prefTarget;
  });
  if (!found) return null;
  const files = manifest[found];
  return Array.isArray(files) && files.length ? files : null;
}

export function photoPublicUrl(folderId, relativePath, manifest) {
  const teamBase = teamBasePublicPathFromFolderId(folderId);
  if (!teamBase) return "";
  let rel = String(relativePath).trim().replace(/\\/g, "/");
  if (!rel.toLowerCase().startsWith("photos/")) {
    rel = `photos/${rel.replace(/^\//, "")}`;
  }
  const relEncoded = rel
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return sitePath(`${teamBase}/${relEncoded}`);
}

function basenameWithoutExt(relPath) {
  const seg = String(relPath).split("/").pop() || "";
  return seg.replace(/\.[^.]+$/, "");
}

/**
 * País del animal en el globo 3D (no el grupo escolar).
 * Prioridad: globeCountry (JSON) → prefijo del archivo (china-panda.jpg) → carpetas (se omite `photos/`).
 * El prefijo del nombre va antes que las carpetas para que `photos/mexico/china-panda.jpg` siga siendo China.
 */
export function resolveGlobeCountryName(entry, photoPath) {
  const explicit =
    (entry?.globeCountry && String(entry.globeCountry).trim()) ||
    (entry?.countryGlobe && String(entry.countryGlobe).trim()) ||
    (entry?.country && String(entry.country).trim());
  if (explicit) {
    const e = explicit.trim();
    const ek = asciiLowerKey(e);
    for (const canon of new Set(Object.values(SLUG_TO_GLOBE_COUNTRY))) {
      if (asciiLowerKey(canon) === ek) return canon;
    }
    const asSlug = ek.replace(/\s+/g, "-");
    if (SLUG_TO_GLOBE_COUNTRY[asSlug]) {
      return SLUG_TO_GLOBE_COUNTRY[asSlug];
    }
    if (SLUG_TO_GLOBE_COUNTRY[e.toLowerCase()]) {
      return SLUG_TO_GLOBE_COUNTRY[e.toLowerCase()];
    }
    return e;
  }

  const base = normalizeStemHyphens(basenameWithoutExt(photoPath));
  const first = base.split(/[-_]/)[0]?.toLowerCase();
  if (first && KNOWN_GLOBE_SLUGS.has(first)) {
    return SLUG_TO_GLOBE_COUNTRY[first];
  }

  const parts = String(photoPath).split("/").filter(Boolean);
  if (parts.length >= 2) {
    const dirSegments = parts.slice(0, -1).map((s) => s.toLowerCase());
    for (const dirSlug of dirSegments) {
      if (dirSlug === "photos") continue;
      if (KNOWN_GLOBE_SLUGS.has(dirSlug)) {
        return SLUG_TO_GLOBE_COUNTRY[dirSlug];
      }
    }
  }

  return "Mexico";
}

function getGlobeCountryCenter(globeCountryName, baseCountries) {
  const label = String(globeCountryName).trim();
  const lk = asciiLowerKey(label);
  const found = baseCountries.find((c) => asciiLowerKey(c.country) === lk);
  if (found && Number.isFinite(found.lat) && Number.isFinite(found.lon)) {
    return {
      lat: found.lat,
      lon: found.lon,
      countryName: found.country,
      countryDescription: found.countryDescription || "",
    };
  }
  const slug = lk.replace(/\s+/g, "-");
  const fb = SLUG_LAT_LON[slug] ?? SLUG_LAT_LON[slug.replace(/-/g, "_")];
  if (fb) {
    const canon =
      [...new Set(Object.values(SLUG_TO_GLOBE_COUNTRY))].find(
        (n) => asciiLowerKey(n) === lk
      ) || label;
    return {
      lat: fb.lat,
      lon: fb.lon,
      countryName: canon,
      countryDescription: "",
    };
  }
  return {
    lat: 20,
    lon: 0,
    countryName: label || "Desconocido",
    countryDescription: "",
  };
}

function spreadLatLon(lat, lon, index, total) {
  if (total <= 1) return { lat, lon };
  const angle = (index / total) * Math.PI * 2;
  const dLat = Math.cos(angle) * 1.1;
  const dLon = Math.sin(angle) * 1.35;
  return { lat: lat + dLat * 0.35, lon: lon + dLon };
}

export async function fetchTeamAnimalsJson(carpeta) {
  if (!carpeta) return null;
  const teamBase = teamBasePublicPathFromFolderId(carpeta);
  if (!teamBase) return null;
  const paths = [
    `${teamBase}/animals.json`,
  ];
  for (const p of paths) {
    const url =
      import.meta.env.DEV ? `${sitePath(p)}?t=${Date.now()}` : sitePath(p);
    const response = await fetch(url);
    if (!response.ok) continue;
    try {
      const data = await response.json();
      if (Array.isArray(data)) return data;
    } catch {
      // continuar al fallback
    }
  }
  return null;
}

/**
 * Marcadores: país en el globo = país del animal; varios animales del mismo país se reparten en círculo.
 */
export function buildTeamGlobeFromAnimalsJson(
  carpeta,
  entries,
  manifest,
  baseCountries
) {
  if (!carpeta || !Array.isArray(entries) || !Array.isArray(baseCountries)) {
    return [];
  }

  const valid = entries.filter(
    (e) =>
      e &&
      typeof e.photo === "string" &&
      e.photo.trim() &&
      String(e.animal ?? "").trim()
  );
  if (!valid.length) return [];

  const byGlobe = new Map();
  for (const e of valid) {
    const rel = String(e.photo).trim();
    const gName = resolveGlobeCountryName(e, rel);
    if (!byGlobe.has(gName)) byGlobe.set(gName, []);
    byGlobe.get(gName).push(e);
  }

  const sortedCountries = [...byGlobe.keys()].sort((a, b) =>
    a.localeCompare(b, "es")
  );
  const result = [];

  for (const gName of sortedCountries) {
    const group = byGlobe.get(gName);
    const center = getGlobeCountryCenter(gName, baseCountries);
    const totalInGroup = group.length;

    group.forEach((e, index) => {
      const hasCoords =
        Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lon));
      const { lat, lon } = hasCoords
        ? { lat: Number(e.lat), lon: Number(e.lon) }
        : spreadLatLon(center.lat, center.lon, index, totalInGroup);
      const rel = String(e.photo).trim();
      const imageUrl = photoPublicUrl(carpeta, rel, manifest);
      const animal = String(e.animal).trim();
      const countryDescription =
        (typeof e.countryDescription === "string" && e.countryDescription) ||
        center.countryDescription;

      const rawVfb = e.vectorFallbackUrl;
      const vectorFallbackUrl =
        typeof rawVfb === "string" && rawVfb.trim()
          ? rawVfb.trim().startsWith("/")
            ? sitePath(rawVfb.trim())
            : rawVfb.trim()
          : imageUrl;

      result.push({
        country: center.countryName,
        lat,
        lon,
        animal,
        animalDescription: e.animalDescription || "",
        countryDescription,
        imageUrl,
        vectorFallbackUrl,
        habitat: e.habitat || "",
        diet: e.diet || "",
        size: e.size || "",
        interestingFact: e.interestingFact || "",
      });
    });
  }

  return result;
}

export function buildTeamGlobeCountries(carpeta, files, manifest, baseCountries) {
  if (!carpeta || !files?.length || !Array.isArray(baseCountries)) return [];

  const entries = mergePhotoEntriesForGlobe(files, []);
  return buildTeamGlobeFromAnimalsJson(
    carpeta,
    entries,
    manifest,
    baseCountries
  );
}

/**
 * Lista del globo: orden de `animals.json` primero, luego fotos solo en disco (orden alfabético).
 * Metadatos del JSON se aplican por ruta `photo`.
 */
export function mergePhotoEntriesForGlobe(manifestFiles, animalsList) {
  const list = Array.isArray(animalsList) ? animalsList : [];
  const files = Array.isArray(manifestFiles) ? manifestFiles : [];
  const byPhoto = new Map();
  for (const e of list) {
    const p = resolveEntryPhotoPath(e);
    if (!p) continue;
    byPhoto.set(p, { ...e, photo: p });
  }
  const seen = new Set();
  const paths = [];
  for (const e of list) {
    const p = resolveEntryPhotoPath(e);
    if (!p || seen.has(p)) continue;
    seen.add(p);
    paths.push(p);
  }
  for (const p of [...files].sort((a, b) => a.localeCompare(b, "es"))) {
    if (seen.has(p)) continue;
    seen.add(p);
    paths.push(p);
  }
  return paths.map((rel) => {
    const hit = byPhoto.get(rel);
    const animal =
      (hit && String(hit.animal ?? "").trim()) ||
      animalLabelFromPathForFallback(rel);
    return { ...(hit || {}), photo: rel, animal };
  });
}

function resolveEntryPhotoPath(entry) {
  const p = entry?.photo;
  if (typeof p === "string" && p.trim()) return p.trim();
  const raw = entry?.imageUrl;
  if (typeof raw !== "string" || !raw.trim()) return "";
  const url = raw.trim();
  const marker = "/grados/";
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    const tail = url.slice(idx + marker.length);
    const segs = tail.split("/").filter(Boolean);
    if (segs.length >= 4) return segs.slice(3).join("/");
  }
  const file = url.split("/").filter(Boolean).pop() || "";
  return file ? `photos/${file}` : "";
}

function gradeLabelFromCountrySlug(countrySlug) {
  const slug = String(countrySlug || "").toLowerCase();
  if (GRADE1_SLUGS.includes(slug)) return "1º";
  if (GRADE3_SLUGS.includes(slug)) return "3º";
  return "2º";
}

function parseTeamFolderId(folderId) {
  const m = String(folderId || "").match(/^(.*)-equipo-(\d+)$/i);
  if (!m) return null;
  return {
    countrySlug: m[1].toLowerCase(),
    teamNum: m[2],
  };
}

export function teamBasePublicPathFromFolderId(folderId) {
  const parsed = parseTeamFolderId(folderId);
  if (!parsed) return "";
  const grade = gradeLabelFromCountrySlug(parsed.countrySlug);
  return `/grados/${grade}/${parsed.countrySlug}/equipo-${parsed.teamNum}`;
}

/** Carpeta pública de fotos del equipo: .../equipo-n/photos */
export function teamPhotosPublicBaseFromFolderId(folderId) {
  const base = teamBasePublicPathFromFolderId(folderId);
  return base ? `${base}/photos` : "";
}

/** Inferencia desde ruta/fichero (p. ej. script sync-team-animals-json). */
export function inferGlobeCountryFromPhotoPath(photoPath) {
  return resolveGlobeCountryName({}, photoPath);
}

export function inferAnimalLabelFromPhotoPath(relPath) {
  return animalLabelFromPathForFallback(relPath);
}

function animalLabelFromPathForFallback(relPath) {
  const base = normalizeStemHyphens(basenameWithoutExt(relPath));
  const pathParts = String(relPath).split("/").filter(Boolean);
  const dirSlugs = pathParts
    .slice(0, -1)
    .map((s) => s.toLowerCase())
    .filter((s) => s !== "photos");
  const parts = base.split(/[-_]/);
  const firstLower = parts[0]?.toLowerCase();
  if (
    parts.length >= 2 &&
    firstLower &&
    KNOWN_GLOBE_SLUGS.has(firstLower)
  ) {
    return parts
      .slice(1)
      .join(" ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  if (
    parts.length >= 2 &&
    dirSlugs.length &&
    KNOWN_GLOBE_SLUGS.has(dirSlugs[dirSlugs.length - 1]) &&
    firstLower === dirSlugs[dirSlugs.length - 1]
  ) {
    return parts
      .slice(1)
      .join(" ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
