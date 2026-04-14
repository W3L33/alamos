import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTeamCardPlaceholders,
  DEFAULT_TEAM_IMAGE,
  DEFAULT_TEAM_IMAGE_DAY,
  DEFAULT_TEAM_IMAGE_NIGHT,
  TEAM_COUNT,
} from "../teamPlaceholders.js";
import { useTheme } from "../ThemeContext.jsx";
import { countryKeyToSlug, getTeamAnimalsFolderId } from "../utils/teamPaths.js";
import {
  clearPhotosManifestCache,
  getPhotosManifest,
  randomPhotoUrlFromManifest,
  resolveFolderFiles,
} from "../utils/teamPhotos.js";
import {
  fetchTeamAnimalsJson,
  fetchTeamAnimalsJsonGrade3,
  pickRandomAnimalPhotoEntry,
  teamPhotoPublicUrl,
  teamPhotoPublicUrlFromBase,
} from "../utils/teamAnimalsJson.js";

function TeamCardLink({ card, countryKey, grade, manifest, animalsEntries }) {
  const { night } = useTheme();
  const folderId = getTeamAnimalsFolderId(countryKey, grade, card.id);
  const slug = countryKeyToSlug(countryKey, grade);
  const isGrade1 = grade === 1 || Number(grade) === 1;
  const isGrade2 = grade === 2 || Number(grade) === 2;
  const isGrade3 = grade === 3 || Number(grade) === 3;

  /** Solo 3º: manifiesto suele no tener claves 3º hasta correr photos:manifest; si falla, animals.json. */
  const [g3Url, setG3Url] = useState(DEFAULT_TEAM_IMAGE);
  useEffect(() => {
    if (!isGrade3) return;
    const fromManifest = randomPhotoUrlFromManifest(folderId, manifest ?? {}, 3);
    if (fromManifest !== DEFAULT_TEAM_IMAGE) {
      setG3Url(fromManifest);
      return;
    }
    let cancelled = false;
    (async () => {
      const pack = await fetchTeamAnimalsJsonGrade3(folderId);
      const row = pickRandomAnimalPhotoEntry(pack?.entries);
      if (cancelled) return;
      if (row?.photo?.trim() && pack?.basePath) {
        setG3Url(teamPhotoPublicUrlFromBase(pack.basePath, row.photo.trim()));
      } else {
        setG3Url(DEFAULT_TEAM_IMAGE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGrade3, folderId, manifest]);

  const rawUrl = useMemo(() => {
    if (isGrade3) {
      return g3Url;
    }
    if (grade === 2) {
      return randomPhotoUrlFromManifest(folderId, manifest ?? {}, 2);
    }
    const fromList = pickRandomAnimalPhotoEntry(animalsEntries);
    if (fromList) {
      return teamPhotoPublicUrl(folderId, fromList.photo.trim(), grade);
    }
    return randomPhotoUrlFromManifest(folderId, manifest ?? {}, grade);
  }, [isGrade3, g3Url, grade, folderId, manifest, animalsEntries]);
  const hasRealPhoto = rawUrl !== DEFAULT_TEAM_IMAGE;
  const placeholderSrc = night ? DEFAULT_TEAM_IMAGE_NIGHT : DEFAULT_TEAM_IMAGE_DAY;

  const [overlayBroken, setOverlayBroken] = useState(false);
  useEffect(() => {
    setOverlayBroken(false);
  }, [rawUrl]);

  const showOverlay = hasRealPhoto && !overlayBroken;
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const overlayRef = useRef(null);
  const actionLabel = isGrade1 ? "Mapa" : (isGrade2 || isGrade3) ? "Revista" : null;

  useEffect(() => {
    setPhotoLoaded(false);
    if (!showOverlay) return;
    const id = requestAnimationFrame(() => {
      const el = overlayRef.current;
      if (el?.complete && el.naturalWidth > 0) {
        setPhotoLoaded(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [rawUrl, showOverlay]);

  const cardContent = (
    <>
      <div className="team-card__media">
        <img
          className="team-card__img team-card__img--base"
          src={placeholderSrc}
          alt=""
          width={320}
          height={200}
          loading="lazy"
          draggable={false}
        />
        {showOverlay ? (
          <img
            ref={overlayRef}
            className={`team-card__img team-card__img--overlay${photoLoaded ? " team-card__img--loaded" : ""}`}
            src={rawUrl}
            alt=""
            width={320}
            height={200}
            loading="lazy"
            decoding="async"
            onLoad={() => setPhotoLoaded(true)}
            onError={() => setOverlayBroken(true)}
            draggable={false}
          />
        ) : null}
        {actionLabel ? (
          <Link
            to={`/equipo/${slug}/${card.id}`}
            state={{ fromCountry: countryKey, fromGrade: grade }}
            className="team-card__action-btn"
            onClick={(e) => e.stopPropagation()}
          >
            {actionLabel}
          </Link>
        ) : null}
        {isGrade1 ? (
          <Link
            to={`/equipo/${slug}/${card.id}?view=book`}
            state={{ fromCountry: countryKey, fromGrade: grade }}
            className="team-card__action-btn team-card__action-btn--right"
            onClick={(e) => e.stopPropagation()}
          >
            Revista
          </Link>
        ) : null}
      </div>
      <div className="team-card__body">
        <h2 className="team-card__title">{card.name}</h2>
        <p className="team-card__integrantes">
          <span className="team-card__integrantes-label">Integrantes:</span>{" "}
          {card.integrantesLabel}
        </p>
      </div>
    </>
  );

  return <article className="team-card glass-team team-card--link team-card--static">{cardContent}</article>;
}

export default function CountryTeamGrid({ countryKey, grade }) {
  const [manifest, setManifest] = useState(null);
  const [animalsByFolder, setAnimalsByFolder] = useState({});
  const isGrade3 = grade === 3 || Number(grade) === 3;

  useEffect(() => {
    let active = true;
    async function loadManifest() {
      const grade2 = grade === 2 || Number(grade) === 2;
      if (isGrade3 || grade2) {
        clearPhotosManifestCache();
        try {
          const r = await fetch(
            `/grados/photos-manifest.json?t=${Date.now()}`,
            { cache: "no-store" }
          );
          const m = r.ok ? await r.json() : {};
          if (active) setManifest(m);
        } catch {
          if (active) setManifest({});
        }
        return;
      }
      const m = await getPhotosManifest();
      if (active) setManifest(m);
    }
    loadManifest();
    return () => {
      active = false;
    };
  }, [isGrade3, grade, countryKey]);

  useEffect(() => {
    let active = true;
    async function loadAnimalsLists() {
      if (grade === 2 || isGrade3) {
        if (active) setAnimalsByFolder({});
        return;
      }
      const out = {};
      await Promise.all(
        Array.from({ length: TEAM_COUNT }, (_, i) => i + 1).map(async (n) => {
          const folderId = getTeamAnimalsFolderId(countryKey, grade, n);
          const data = await fetchTeamAnimalsJson(folderId, grade);
          if (data?.length) out[folderId] = data;
        })
      );
      if (active) setAnimalsByFolder(out);
    }
    if (countryKey != null) {
      loadAnimalsLists();
    }
    return () => {
      active = false;
    };
  }, [countryKey, grade, isGrade3]);

  useEffect(() => {
    if (!import.meta.env.DEV || !manifest || !countryKey) return;
    for (let i = 1; i <= TEAM_COUNT; i++) {
      const folderId = getTeamAnimalsFolderId(countryKey, grade, i);
      const files = resolveFolderFiles(manifest, folderId, isGrade3 ? 3 : grade);
      if (!files?.length) {
        console.warn(
          `[Alamos] Equipo ${i}: sin imágenes. Añade archivos en ` +
            `public/grados/<grado>/${countryKeyToSlug(countryKey, grade)}/equipo-${i}/ y ejecuta npm run photos:manifest ` +
            `(genera animals.json y el manifiesto).`
        );
      }
    }
  }, [manifest, countryKey, grade]);

  const cards = getTeamCardPlaceholders();

  return (
    <div className="team-grid">
      {cards.map((card) => (
        <TeamCardLink
          key={`${countryKey}-${grade}-${card.id}`}
          card={card}
          countryKey={countryKey}
          grade={grade}
          manifest={manifest}
          animalsEntries={animalsByFolder[getTeamAnimalsFolderId(countryKey, grade, card.id)]}
        />
      ))}
    </div>
  );
}
