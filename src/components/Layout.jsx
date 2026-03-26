import { Outlet, useLocation } from "react-router-dom";
import { useTheme } from "../ThemeContext.jsx";
import { GRADE1_SLUGS } from "../countries.js";

export default function Layout() {
  const { night, toggle } = useTheme();
  const { pathname } = useLocation();
  const isHome = pathname === "/" || pathname === "";
  const parts = pathname.split("/").filter(Boolean);
  const countrySlug = parts[1] || "";
  const isGlobeRoute = parts[0] === "equipo" && GRADE1_SLUGS.includes(countrySlug);

  return (
    <div className={`app-root${isGlobeRoute ? " app-root--globe-only" : ""}`}>
      {!isHome ? (
        <button
          type="button"
          className="glass-btn glass-btn--icon theme-fab theme-fab--solo"
          onClick={toggle}
          aria-label={night ? "Modo día" : "Modo noche"}
        >
          <i className={`fa-solid ${night ? "fa-sun" : "fa-moon"}`} />
        </button>
      ) : null}
      <div className="route-fade" key={pathname}>
        <Outlet />
      </div>
    </div>
  );
}
