import { GRADE1_SLUGS, GRADE3_SLUGS } from "../../src/countries.js";

export function gradeLabelFromCountrySlug(countrySlug) {
  const slug = String(countrySlug || "").toLowerCase();
  if (GRADE1_SLUGS.includes(slug)) return "1º";
  if (GRADE3_SLUGS.includes(slug)) return "3º";
  return "2º";
}

export function parseTeamFolderId(folderId) {
  const m = String(folderId || "").match(/^(.*)-equipo-(\d+)$/i);
  if (!m) return null;
  return {
    countrySlug: m[1].toLowerCase(),
    teamNum: m[2],
  };
}

export function relativeTeamDirFromFolderId(folderId) {
  const parsed = parseTeamFolderId(folderId);
  if (!parsed) return "";
  const grade = gradeLabelFromCountrySlug(parsed.countrySlug);
  return `${grade}/${parsed.countrySlug}/equipo-${parsed.teamNum}`;
}

