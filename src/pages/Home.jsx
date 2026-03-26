import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { data } from "../data.js";
import {
  GRADE1_SLUGS,
  GRADE3_SLUGS,
  COUNTRY_PAGES,
} from "../countries.js";
import { useTheme } from "../ThemeContext.jsx";
import GradeFloat from "../components/GradeFloat.jsx";
import CountryTeamGrid from "../components/CountryTeamGrid.jsx";

// Versiona la clave para que el intro vuelva a mostrarse tras cambios de UI.
const HOME_CONTROLS_INTRO_KEY = "alamos-home-controls-intro-v2";

function preloadBackgrounds() {
  ["/alamosday.jpg", "/alamosnight.jpg"].forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

function readIntroDone() {
  try {
    return sessionStorage.getItem(HOME_CONTROLS_INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function setIntroDone() {
  try {
    sessionStorage.setItem(HOME_CONTROLS_INTRO_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearIntroDone() {
  try {
    sessionStorage.removeItem(HOME_CONTROLS_INTRO_KEY);
  } catch {
    /* ignore */
  }
}

/** Clave de país según grado: 2º = clave de `data`, 1º/3º = slug en COUNTRY_PAGES */
function resolveCountryView(grade, key) {
  if (!key) return null;
  if (grade === 2 && data[key]) {
    return { title: key, flag: data[key].image };
  }
  const page = COUNTRY_PAGES[key];
  if (page) return { title: page.name, flag: page.flag };
  return null;
}

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const { night, toggle: toggleTheme } = useTheme();
  const [grade, setGrade] = useState(() => (readIntroDone() ? 2 : null));
  const [selectedCountryKey, setSelectedCountryKey] = useState(null);
  const [showHomeControlsIntro, setShowHomeControlsIntro] = useState(
    () => !readIntroDone()
  );
  const [isLeavingToInitialScreen, setIsLeavingToInitialScreen] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const leaveToInitialTimerRef = useRef(null);

  useEffect(() => {
    preloadBackgrounds();
  }, []);

  useEffect(() => {
    return () => {
      if (leaveToInitialTimerRef.current) {
        clearTimeout(leaveToInitialTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const st = location.state;
    if (st?.restoreCountry != null) {
      setIntroDone();
      setShowHomeControlsIntro(false);
      setGrade(st.restoreGrade ?? 2);
      setSelectedCountryKey(st.restoreCountry);
      navigate("/", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleGradeChange = useCallback((g) => {
    setGrade(g);
    setSelectedCountryKey(null);
    setIntroDone();
    setShowHomeControlsIntro(false);
  }, []);

  const handleGoToInitialScreen = useCallback(() => {
    if (isLeavingToInitialScreen) return;
    setIsLeavingToInitialScreen(true);
    leaveToInitialTimerRef.current = setTimeout(() => {
      clearIntroDone();
      setSelectedCountryKey(null);
      setGrade(null);
      setShowHomeControlsIntro(true);
      setIsLeavingToInitialScreen(false);
    }, 280);
  }, [isLeavingToInitialScreen]);

  const handleSwipe = useCallback(() => {
    const deltaX = touchEndX.current - touchStartX.current;
    if (deltaX > 80 && selectedCountryKey) {
      setSelectedCountryKey(null);
    }
  }, [selectedCountryKey]);

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const onTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    handleSwipe();
  };

  const insideCountry = Boolean(selectedCountryKey);
  const view =
    insideCountry && grade != null
      ? resolveCountryView(grade, selectedCountryKey)
      : null;

  const controlsIntroActive =
    !insideCountry && showHomeControlsIntro;
  const pageClassName = [
    "page-home",
    insideCountry ? "page-home--country" : "page-home--no-toolbar",
    controlsIntroActive ? "page-home--controls-intro" : "",
    isLeavingToInitialScreen ? "page-home--leaving-to-initial" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={pageClassName}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {insideCountry && view ? (
        <>
          <header className="top-bar glass-bar">
            <div className="top-bar__left">
              <button
                type="button"
                className="glass-btn glass-btn--icon"
                onClick={() => setSelectedCountryKey(null)}
                aria-label="Volver a países"
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
            </div>
            <h1 className="top-bar__title">
              <span className="title-animate">{view.title}</span>
            </h1>
            <div className="top-bar__balance" aria-hidden />
          </header>
          <div
            className="country-flag-float"
            aria-hidden
            key={selectedCountryKey}
          >
            <img
              src={view.flag}
              alt=""
              className="country-flag-float__img"
            />
          </div>
        </>
      ) : null}

      {!insideCountry ? (
        <div className="home-country-top-float">
          <h1 className="home-country-top-float__title">Grupos</h1>
        </div>
      ) : null}

      <main>
        <div
          key={grade ?? "sin-grado"}
          className={
            insideCountry
              ? "content-grid content-grid--teams home-grade-reveal"
              : "content-grid home-grade-reveal"
          }
        >
          {insideCountry && grade != null ? (
            <CountryTeamGrid
              countryKey={selectedCountryKey}
              grade={grade}
            />
          ) : !insideCountry && grade != null ? (
            <GradeGrid
              grade={grade}
              onPickCountry={setSelectedCountryKey}
            />
          ) : null}
        </div>
      </main>

      <div
        className={
          controlsIntroActive
            ? "home-bottom-bar home-bottom-bar--intro"
            : "home-bottom-bar"
        }
      >
        <button
          type="button"
          className="glass-btn glass-btn--icon home-theme-btn"
          onClick={toggleTheme}
          aria-label={night ? "Modo día" : "Modo noche"}
        >
          <i className={`fa-solid ${night ? "fa-sun" : "fa-moon"}`} />
        </button>
        <GradeFloat grade={grade} onChange={handleGradeChange} />
        <button
          type="button"
          className="glass-btn glass-btn--icon home-theme-btn"
          onClick={handleGoToInitialScreen}
          aria-label="Ir a pantalla inicial"
          disabled={isLeavingToInitialScreen || controlsIntroActive}
        >
          <i className="fa-solid fa-circle-dot" />
        </button>
      </div>
    </div>
  );
}

function GradeGrid({ grade, onPickCountry }) {
  if (grade === 1) {
    return (
      <>
        {GRADE1_SLUGS.map((slug) => {
          const c = COUNTRY_PAGES[slug];
          return (
            <button
              key={slug}
              type="button"
              className="glass-tile glass-tile--action"
              onClick={() => onPickCountry(slug)}
            >
              <span className="glass-tile__text">{c.name}</span>
              <img
                src={c.flag}
                alt=""
                className="glass-tile__flag"
                loading="lazy"
              />
            </button>
          );
        })}
      </>
    );
  }

  if (grade === 3) {
    return (
      <>
        {GRADE3_SLUGS.map((slug) => {
          const c = COUNTRY_PAGES[slug];
          return (
            <button
              key={slug}
              type="button"
              className="glass-tile glass-tile--action"
              onClick={() => onPickCountry(slug)}
            >
              <span className="glass-tile__text">{c.name}</span>
              <img
                src={c.flag}
                alt=""
                className="glass-tile__flag"
                loading="lazy"
              />
            </button>
          );
        })}
      </>
    );
  }

  return (
    <>
      {Object.keys(data).map((country) => (
        <button
          key={country}
          type="button"
          className="glass-tile glass-tile--action"
          onClick={() => onPickCountry(country)}
        >
          <span className="glass-tile__text">{country}</span>
          <img
            src={data[country].image}
            alt=""
            className="glass-tile__thumb"
          />
        </button>
      ))}
    </>
  );
}
