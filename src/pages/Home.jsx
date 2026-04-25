import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
/** Conserva grado + país al recargar o con HMR de Vite (evita volver siempre a la rejilla de 2º). */
const HOME_VIEW_STATE_KEY = "alamos-home-view-v1";

function isValidCountryForGrade(grade, key) {
  if (key == null || key === "") return true;
  if (grade === 2) return Boolean(data[key]);
  if (grade === 1) return GRADE1_SLUGS.includes(key);
  if (grade === 3) return GRADE3_SLUGS.includes(key);
  return false;
}

function readPersistedHomeView() {
  try {
    const raw = sessionStorage.getItem(HOME_VIEW_STATE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    const g = j.grade;
    if (![1, 2, 3].includes(Number(g))) return null;
    const grade = Number(g);
    const countryKey =
      j.countryKey == null || j.countryKey === "" ? null : String(j.countryKey);
    if (countryKey && !isValidCountryForGrade(grade, countryKey)) {
      return { grade, countryKey: null };
    }
    return { grade, countryKey };
  } catch {
    return null;
  }
}

function writePersistedHomeView(grade, countryKey) {
  try {
    sessionStorage.setItem(
      HOME_VIEW_STATE_KEY,
      JSON.stringify({ v: 1, grade, countryKey })
    );
  } catch {
    /* ignore */
  }
}

function clearPersistedHomeView() {
  try {
    sessionStorage.removeItem(HOME_VIEW_STATE_KEY);
  } catch {
    /* ignore */
  }
}

function getInitialHomeState() {
  const introDone = readIntroDone();
  if (!introDone) {
    return {
      grade: null,
      selectedCountryKey: null,
      showHomeControlsIntro: true,
    };
  }
  const persisted = readPersistedHomeView();
  if (persisted) {
    return {
      grade: persisted.grade,
      selectedCountryKey: persisted.countryKey,
      showHomeControlsIntro: false,
    };
  }
  return {
    grade: 2,
    selectedCountryKey: null,
    showHomeControlsIntro: false,
  };
}

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

function resolveGradeLabel(grade) {
  if (grade === 1) return "Primero";
  if (grade === 2) return "Segundo";
  if (grade === 3) return "Tercero";
  return "Grupos";
}

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const { night, toggle: toggleTheme } = useTheme();
  const initialHome = useMemo(() => getInitialHomeState(), []);
  const [grade, setGrade] = useState(initialHome.grade);
  const [selectedCountryKey, setSelectedCountryKey] = useState(
    initialHome.selectedCountryKey
  );
  const [showHomeControlsIntro, setShowHomeControlsIntro] = useState(
    initialHome.showHomeControlsIntro
  );
  const [isLeavingToInitialScreen, setIsLeavingToInitialScreen] = useState(false);
  const [topTitle, setTopTitle] = useState(resolveGradeLabel(initialHome.grade));
  const [pendingTopTitle, setPendingTopTitle] = useState(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const leaveToInitialTimerRef = useRef(null);
  const topTitleRef = useRef(null);
  const topTitleAnimatingRef = useRef(false);

  useEffect(() => {
    preloadBackgrounds();
  }, []);

  useEffect(() => {
    if (!readIntroDone()) return;
    writePersistedHomeView(grade, selectedCountryKey);
  }, [grade, selectedCountryKey]);

  useEffect(() => {
    return () => {
      if (leaveToInitialTimerRef.current) {
        clearTimeout(leaveToInitialTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextTitle = resolveGradeLabel(grade);
    if (nextTitle === topTitle || nextTitle === pendingTopTitle) return;
    setPendingTopTitle(nextTitle);
  }, [grade, topTitle, pendingTopTitle]);

  useEffect(() => {
    if (!pendingTopTitle || topTitleAnimatingRef.current) return;
    const el = topTitleRef.current;
    if (!el || typeof el.animate !== "function") {
      setTopTitle(pendingTopTitle);
      setPendingTopTitle(null);
      return;
    }

    const nextTitle = pendingTopTitle;
    let cancelled = false;
    topTitleAnimatingRef.current = true;

    (async () => {
      try {
        const leave = el.animate(
          [
            { transform: "translate(-50%, 0)", opacity: 1 },
            { transform: "translate(-50%, -130px)", opacity: 1 },
          ],
          { duration: 300, easing: "ease-out", fill: "forwards" }
        );
        await leave.finished;
        if (cancelled) return;

        setTopTitle(nextTitle);
        el.style.transform = "translate(-50%, -130px)";

        const enter = el.animate(
          [
            { transform: "translate(-50%, -130px)", opacity: 1 },
            { transform: "translate(-50%, 0)", opacity: 1 },
          ],
          { duration: 200, easing: "ease-out", fill: "forwards" }
        );
        await enter.finished;
      } catch {
        // ignore animation cancellation
      } finally {
        el.style.transform = "";
        if (!cancelled) setPendingTopTitle(null);
        topTitleAnimatingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      el.getAnimations?.().forEach((a) => a.cancel());
      topTitleAnimatingRef.current = false;
    };
  }, [pendingTopTitle]);

  useEffect(() => {
    const st = location.state;
    if (st?.restoreCountry != null) {
      setIntroDone();
      setShowHomeControlsIntro(false);
      const g = st.restoreGrade ?? 2;
      const ck = st.restoreCountry;
      setGrade(g);
      setSelectedCountryKey(ck);
      writePersistedHomeView(g, ck);
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
      clearPersistedHomeView();
      setSelectedCountryKey(null);
      setGrade(null);
      setShowHomeControlsIntro(true);
      setIsLeavingToInitialScreen(false);
    }, 280);
  }, [isLeavingToInitialScreen]);

  const handleSwipe = useCallback(() => {
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (selectedCountryKey) {
      if (isHorizontal && deltaX > 80) {
        setSelectedCountryKey(null);
      }
      return;
    }

    if (!selectedCountryKey && grade != null && isHorizontal && Math.abs(deltaX) > 50) {
      const next = deltaX < 0 ? grade + 1 : grade - 1;
      const wrapped = next > 3 ? 1 : next < 1 ? 3 : next;
      handleGradeChange(wrapped);
    }
  }, [selectedCountryKey, grade, handleGradeChange]);

  useEffect(() => {
    const isDesktopViewport = () =>
      window.matchMedia("(min-width: 1025px)").matches;

    const onKeyDown = (event) => {
      if (!isDesktopViewport()) return;
      if (grade == null) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (selectedCountryKey) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setSelectedCountryKey(null);
        }
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next = grade + delta;
        const wrapped = next > 3 ? 1 : next < 1 ? 3 : next;
        handleGradeChange(wrapped);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [grade, selectedCountryKey, handleGradeChange]);

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
    touchStartY.current = e.changedTouches[0].screenY;
  };

  const onTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    touchEndY.current = e.changedTouches[0].screenY;
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
              <div className="top-bar__spacer" aria-hidden />
            </div>
            <h1 className="top-bar__title">
              <span className="title-animate top-bar__title-with-flag">
                <img
                  src={view.flag}
                  alt=""
                  className="top-bar__title-flag"
                />
                <span>{view.title}</span>
              </span>
            </h1>
            <div className="top-bar__balance" aria-hidden />
          </header>
        </>
      ) : null}

      {!insideCountry ? (
        <div ref={topTitleRef} className="home-country-top-float">
          <h1 className="home-country-top-float__title">
            <span className="home-country-top-float__title-animate">
              {topTitle}
            </span>
          </h1>
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
        {insideCountry ? (
          <button
            type="button"
            className="glass-btn glass-btn--icon country-back-fab"
            onClick={() => setSelectedCountryKey(null)}
            aria-label="Volver a países"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
        ) : null}
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

      <a
        className="by-welee-fab"
        aria-label="By WeLee"
        href="https://w3l33.github.io"
        target="_blank"
        rel="noopener noreferrer"
      >
        By WeLee
      </a>
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
