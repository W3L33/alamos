import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./ThemeContext.jsx";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import TeamAnimalPage from "./pages/TeamAnimalPage.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route
          path="/equipo/:countrySlug/:teamId"
          element={<TeamAnimalPage />}
        />
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}