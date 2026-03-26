import { GRADE1_SLUGS, GRADE3_SLUGS } from "../countries.js";

export function gradeLabelFromCountrySlug(countrySlug) {
  const slug = String(countrySlug || "").toLowerCase();
  if (GRADE1_SLUGS.includes(slug)) return "1º";
  if (GRADE3_SLUGS.includes(slug)) return "3º";
  return "2º";
}

/** Grado de la vista (1|2|3) → segmento de carpeta bajo public/grados */
export function gradeDirFromUiGrade(grade) {
  if (grade === 1) return "1º";
  if (grade === 2) return "2º";
  if (grade === 3) return "3º";
  return null;
}

export function parseTeamFolderId(folderId) {
  const m = String(folderId || "").match(/^(.*)-equipo-(\d+)$/i);
  if (!m) return null;
  return {
    countrySlug: m[1].toLowerCase(),
    teamNum: m[2],
  };
}

/**
 * @param {string} folderId p. ej. argentina-equipo-1
 * @param {1|2|3|undefined} uiGrade grado de la vista; si falta, se infiere por país (legado globo/embed)
 */
export function teamBasePublicPathFromFolderId(folderId, uiGrade) {
  const parsed = parseTeamFolderId(folderId);
  if (!parsed) return "";
  const gradeDir =
    uiGrade === 1 || uiGrade === 2 || uiGrade === 3
      ? gradeDirFromUiGrade(uiGrade)
      : gradeLabelFromCountrySlug(parsed.countrySlug);
  if (!gradeDir) return "";
  return `/grados/${gradeDir}/${parsed.countrySlug}/equipo-${parsed.teamNum}`;
}

