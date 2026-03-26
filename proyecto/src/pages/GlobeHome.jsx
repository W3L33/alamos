import { useEffect, useMemo, useState } from "react";
import GlobeScene from "../components/GlobeScene";
import GlobeFloatingChrome from "../components/GlobeFloatingChrome";
import InfoModal from "../components/InfoModal";
import CenterInfoPanel from "../components/CenterInfoPanel";
import { DEFAULT_ANIMAL_PHOTO_URL } from "../constants/photos.js";
import { useCoarsePointerOrMobile } from "../utils/coarsePointer.js";
import {
  buildTeamGlobeFromAnimalsJson,
  fetchTeamAnimalsJson,
  mergePhotoEntriesForGlobe,
  resolveFolderFiles,
  sitePath,
  teamPhotosPublicBaseFromFolderId,
} from "../utils/teamGlobeFromManifest.js";

const EARTH_TEXTURE_URL = "/textures/earth-map.jpg";

function dirnameFromPath(p) {
  const s = String(p || "");
  const i = s.lastIndexOf("/");
  return i > 0 ? s.slice(0, i) : "";
}

function fileNameFromUrlLike(p) {
  const clean = String(p || "").split("?")[0].split("#")[0];
  return clean.split("/").filter(Boolean).pop() || "";
}

function withBaseDir(baseDir, urlLike) {
  const name = fileNameFromUrlLike(urlLike);
  if (!name) return "";
  return `${baseDir}/${encodeURIComponent(name)}`;
}

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
    if (img.complete) resolve();
  });
}

async function preloadUrlsInBatches(urls, batchSize) {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.all(batch.map(preloadImage));
  }
}

function formatPaisLabel(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function readEmbedQuery() {
  if (typeof window === "undefined") {
    return { pais: "", equipo: "", carpeta: "" };
  }
  const q = new URLSearchParams(window.location.search);
  return {
    pais: q.get("pais")?.trim() || "",
    equipo: q.get("equipo")?.trim() || "",
    carpeta: q.get("carpeta")?.trim() || "",
  };
}

async function fetchPhotosManifest() {
  const path = "/grados/photos-manifest.json";
  const url =
    import.meta.env.DEV
      ? `${sitePath(path)}?t=${Date.now()}`
      : sitePath(path);
  const response = await fetch(url);
  if (!response.ok) return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function fetchTeamSpecificCountriesFromLegacyJson(carpeta) {
  if (!carpeta) return null;
  const photosBase = teamPhotosPublicBaseFromFolderId(carpeta);
  if (!photosBase) return null;
  const jsonPath = `${photosBase}/countries-animals.json`;
  const url =
    import.meta.env.DEV && import.meta.hot
      ? `${sitePath(jsonPath)}?t=${Date.now()}`
      : sitePath(jsonPath);
  const response = await fetch(url);
  if (!response.ok) return null;
  let raw;
  try {
    raw = await response.json();
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || !raw.length) return null;
  const baseDir = dirnameFromPath(jsonPath);
  const normalized = raw
    .filter((row) => row && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)))
    .map((row) => {
      const imageUrl = withBaseDir(baseDir, row.imageUrl || row.vectorFallbackUrl || "");
      const vectorFallbackUrl = withBaseDir(baseDir, row.vectorFallbackUrl || row.imageUrl || "");
      return {
        ...row,
        country: row.country || "Desconocido",
        lat: Number(row.lat),
        lon: Number(row.lon),
        animal: String(row.animal || "").trim() || "Animal",
        imageUrl: imageUrl || sitePath(DEFAULT_ANIMAL_PHOTO_URL),
        vectorFallbackUrl: vectorFallbackUrl || imageUrl || sitePath(DEFAULT_ANIMAL_PHOTO_URL),
      };
    });
  return normalized.length ? normalized : null;
}

export default function GlobeHome() {
  const coarsePointer = useCoarsePointerOrMobile();
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);

  const [embedQuery, setEmbedQuery] = useState(readEmbedQuery);

  useEffect(() => {
    setEmbedQuery(readEmbedQuery());
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      try {
        const response = await fetch(sitePath("/data/countries-animals.json"));
        if (!response.ok) {
          throw new Error("No se pudo cargar el JSON de paises.");
        }
        const base = await response.json();
        if (!Array.isArray(base)) {
          throw new Error("Formato invalido en countries-animals.json.");
        }

        const { carpeta } = readEmbedQuery();
        let data = base;
        if (carpeta) {
          const legacyTeamData = await fetchTeamSpecificCountriesFromLegacyJson(carpeta);
          if (legacyTeamData?.length) {
            data = legacyTeamData;
          } else {
          const manifest = await fetchPhotosManifest();
          const files = resolveFolderFiles(manifest, carpeta) ?? [];
          const animalsList = (await fetchTeamAnimalsJson(carpeta)) ?? [];
          const entries = mergePhotoEntriesForGlobe(files, animalsList);
          data = buildTeamGlobeFromAnimalsJson(
            carpeta,
            entries,
            manifest,
            base
          );
          }
        }

        if (isActive) {
          setCountries(data);
          setLoading(false);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError.message);
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!countries.length) return;

    const urls = new Set([
      sitePath(EARTH_TEXTURE_URL),
      sitePath(DEFAULT_ANIMAL_PHOTO_URL),
    ]);
    for (const c of countries) {
      if (c.imageUrl) urls.add(c.imageUrl);
      if (c.vectorFallbackUrl) urls.add(c.vectorFallbackUrl);
    }

    const list = [...urls];
    const batchSize =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px), (pointer: coarse)").matches
        ? 5
        : 14;

    void preloadUrlsInBatches(list, batchSize);
  }, [countries]);

  useEffect(() => {
    if (coarsePointer) setHovered(null);
  }, [coarsePointer]);

  const centerEntry = useMemo(
    () => (coarsePointer ? selected ?? null : hovered ?? selected ?? null),
    [coarsePointer, hovered, selected]
  );

  const handleMarkerSelect = (country) => {
    setSelected(country);
  };

  const handleSearchSelect = (country) => {
    setSelected(country);
    setQuery("");
  };

  const paisLabel = useMemo(
    () => formatPaisLabel(embedQuery.pais),
    [embedQuery.pais]
  );
  const showFooter = Boolean(embedQuery.pais || embedQuery.equipo);

  return (
    <main className="app-root app-root--globe-only">
      <GlobeFloatingChrome
        countries={countries}
        query={query}
        onQueryChange={setQuery}
        onSearchSelect={handleSearchSelect}
      />

      <section className="globe-panel globe-panel--stacked">
        {loading && <div className="status">Cargando datos...</div>}
        {error && <div className="status error">{error}</div>}

        {!loading && !error && embedQuery.carpeta && countries.length === 0 ? (
          <div className="team-globe-empty" role="status">
            No hay imágenes para este equipo. Coloca JPG/PNG en{" "}
            <code>photos/</code> (o subcarpetas por país). En la misma carpeta del
            equipo, <code>animals.json</code> lista cada animal (
            <code>photo</code>, <code>animal</code>, <code>globeCountry</code>, …);
            se actualiza con <code>npm run photos:manifest</code> o{" "}
            <code>npm run team:animals</code>. Luego{" "}
            <code>npm run build:animales</code>.
          </div>
        ) : null}

        {!loading && !error && (
          <GlobeScene
            countries={countries}
            hoveredCountry={hovered}
            activeCountry={selected}
            onHover={coarsePointer ? () => {} : setHovered}
            onHoverMove={() => {}}
            onSelect={handleMarkerSelect}
            focusCountry={null}
          />
        )}
      </section>

      {showFooter && (
        <footer className="globe-embed-footer">
          {paisLabel ? (
            <p className="globe-embed-footer__country">
              Grupo escolar: {paisLabel}
            </p>
          ) : null}
          {embedQuery.equipo ? (
            <p className="globe-embed-footer__team">
              Equipo {embedQuery.equipo}
            </p>
          ) : null}
        </footer>
      )}

      <InfoModal selected={selected} onClose={() => setSelected(null)} />

      <CenterInfoPanel
        entry={centerEntry}
        placement={!coarsePointer && hovered ? "bottom" : "center"}
      />
    </main>
  );
}
