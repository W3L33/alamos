import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [night, setNight] = useState(true);

  useEffect(() => {
    document.body.classList.toggle("night", night);
    document.body.classList.toggle("day", !night);
  }, [night]);

  const toggle = useCallback(() => setNight((n) => !n), []);

  const value = useMemo(
    () => ({ night, toggle }),
    [night, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
