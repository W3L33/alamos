import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { getTeamAnimalsFolderIdFromRoute } from "../utils/teamPaths.js";
import { GRADE1_SLUGS, GRADE3_SLUGS } from "../countries.js";
import { data } from "../data.js";
import { countryKeyToSlug } from "../utils/teamPaths.js";
import { getPhotosManifest, randomPhotoUrlFromManifest } from "../utils/teamPhotos.js";
import { DEFAULT_TEAM_IMAGE } from "../teamPlaceholders.js";
import { sitePath } from "../utils/teamGlobeFromManifest.js";

const EMBED_RETURN_KEY = "alamos-embed-return";
const HOME_CONTROLS_INTRO_KEY = "alamos-home-controls-intro-v2";

function globeIframeSrc(countrySlug, teamId) {
  const carpeta = getTeamAnimalsFolderIdFromRoute(countrySlug, teamId);
  const qs = new URLSearchParams({
    pais: countrySlug,
    equipo: String(teamId),
    carpeta,
  }).toString();

  const base = import.meta.env.BASE_URL || "/";

  if (import.meta.env.DEV && import.meta.env.VITE_GLOBE_ORIGIN) {
    const origin = import.meta.env.VITE_GLOBE_ORIGIN.replace(/\/$/, "");
    return `${origin}/?${qs}`;
  }

  return `${base}animales/index.html?${qs}`;
}

function grade2BookSrc(countrySlug, teamId) {
  const encodedPath = [
    "grados",
    encodeURIComponent("2º"),
    encodeURIComponent(String(countrySlug || "").toLowerCase()),
    encodeURIComponent(`equipo-${String(teamId || "")}`),
    "book",
    "index.html",
  ].join("/");
  return sitePath(`/${encodedPath}`);
}

function grade1BookSrc(countrySlug, teamId) {
  const encodedPath = [
    "grados",
    encodeURIComponent("1º"),
    encodeURIComponent(String(countrySlug || "").toLowerCase()),
    encodeURIComponent(`equipo-${String(teamId || "")}`),
    "book",
    "index.html",
  ].join("/");
  return sitePath(`/${encodedPath}`);
}

function grade3BookSrc(countrySlug, teamId) {
  const encodedPath = [
    "grados",
    encodeURIComponent("3º"),
    encodeURIComponent(String(countrySlug || "").toLowerCase()),
    encodeURIComponent(`equipo-${String(teamId || "")}`),
    "book",
    "index.html",
  ].join("/");
  return sitePath(`/${encodedPath}`);
}

export default function TeamAnimalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { countrySlug, teamId } = useParams();

  const grade = useMemo(() => {
    const slug = String(countrySlug || "").toLowerCase();
    if (GRADE1_SLUGS.includes(slug)) return 1;
    if (GRADE3_SLUGS.includes(slug)) return 3;
    const grade2Slugs = Object.keys(data).map((k) =>
      countryKeyToSlug(k, 2)
    );
    return grade2Slugs.includes(slug) ? 2 : null;
  }, [countrySlug]);

  useEffect(() => {
    const st = location.state;
    if (st?.fromCountry != null) {
      sessionStorage.setItem(
        EMBED_RETURN_KEY,
        JSON.stringify({
          countryKey: st.fromCountry,
          grade: st.fromGrade ?? 2,
        })
      );
    }
  }, [location.state]);

  const carpeta = getTeamAnimalsFolderIdFromRoute(
    countrySlug || "",
    teamId || ""
  );
  const isGrade1Book = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return params.get("view") === "book";
  }, [location.search]);
  const isGrade2Book = grade === 2;
  const isGrade3Book = grade === 3;
  const isGradeBookEmbed = isGrade2Book || isGrade3Book;

  const [heroUrl, setHeroUrl] = useState(null);

  useEffect(() => {
    if (grade === 1) return; // solo la ruta "globo" necesita iframe
    let active = true;
    (async () => {
      const manifest = await getPhotosManifest();
      if (!active) return;
      setHeroUrl(randomPhotoUrlFromManifest(carpeta, manifest, grade ?? undefined));
    })();
    return () => {
      active = false;
    };
  }, [grade, carpeta]);

  useEffect(() => {
    if (grade !== 1 && !isGradeBookEmbed) return;
    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      const t = event.data?.type;
      if (t === "alamos-embed-back") {
        const raw = sessionStorage.getItem(EMBED_RETURN_KEY);
        const ret = raw ? JSON.parse(raw) : null;
        if (ret?.countryKey != null) {
          navigate("/", {
            state: {
              restoreCountry: ret.countryKey,
              restoreGrade: ret.grade ?? 2,
            },
          });
        } else {
          navigate(-1);
        }
        return;
      }
      if (t === "alamos-embed-home") {
        sessionStorage.removeItem(EMBED_RETURN_KEY);
        sessionStorage.removeItem(HOME_CONTROLS_INTRO_KEY);
        navigate("/", { replace: true });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [grade, isGradeBookEmbed, navigate]);

  const src = useMemo(
    () => globeIframeSrc(countrySlug || "", teamId || ""),
    [countrySlug, teamId]
  );
  const bookSrc = useMemo(() => {
    if (grade === 1 && isGrade1Book) {
      return grade1BookSrc(countrySlug || "", teamId || "");
    }
    if (isGrade2Book) {
      return grade2BookSrc(countrySlug || "", teamId || "");
    }
    if (isGrade3Book) {
      return grade3BookSrc(countrySlug || "", teamId || "");
    }
    return "";
  }, [grade, isGrade1Book, isGrade2Book, isGrade3Book, countrySlug, teamId]);

  const handleBack = () => {
    const st = location.state;
    if (st?.fromCountry != null) {
      navigate("/", {
        state: {
          restoreCountry: st.fromCountry,
          restoreGrade: st.fromGrade ?? 2,
        },
      });
      return;
    }
    navigate(-1);
  };

  if (grade === 1 && !isGrade1Book) {
    return (
      <div className="team-animal-page team-animal-page--iframe-only">
        <iframe
          title="Animales del mundo — proyecto"
          className="team-globe-frame team-globe-frame--fullscreen"
          src={src}
          allowFullScreen
        />
      </div>
    );
  }

  if (isGradeBookEmbed || (grade === 1 && isGrade1Book)) {
    return (
      <div className="team-animal-page team-animal-page--iframe-only">
        <iframe
          title={`Proyecto Book — ${countrySlug} Equipo ${teamId}`}
          className="team-globe-frame team-globe-frame--fullscreen"
          src={bookSrc}
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="page-home page-home--no-toolbar">
      <header className="top-bar glass-bar">
        <div className="top-bar__left">
          <button
            type="button"
            className="glass-btn glass-btn--icon"
            onClick={handleBack}
            aria-label="Volver"
          >
            <i className="fa-solid fa-arrow-left" />
          </button>
        </div>
        <h1 className="top-bar__title">
          <span className="title-animate">Equipo {teamId}</span>
        </h1>
        <div className="top-bar__balance" aria-hidden />
      </header>

      <main>
        <div className="country-body">
          <div className="glass-panel">
            {heroUrl ? (
              <img
                className="team-globe-detail__img"
                src={heroUrl}
                alt=""
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_TEAM_IMAGE;
                }}
              />
            ) : null}
            <div className="team-globe-detail__body">
              <h2 className="team-globe-detail__title">Equipo {teamId}</h2>
              <p className="team-globe-detail__meta">
                Fotos del equipo: {countrySlug}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
