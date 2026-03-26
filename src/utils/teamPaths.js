/**
 * Slug del país en rutas y en nombres de carpeta (1º y 3º ya vienen en minúsculas).
 */
export function countryKeyToSlug(countryKey, grade) {
  if (grade === 2) {
    return String(countryKey)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }
  return String(countryKey).toLowerCase();
}

/**
 * Carpeta del equipo (grupo escolar “país” + número de equipo), p. ej. mexico-equipo-1.
 * No es el país geográfico del animal. Fotos por país del animal, p. ej.:
 *   …/mexico-equipo-1/china/china-panda.jpg
 *   …/mexico-equipo-1/mexico/mexico-ajolote.jpg
 * Fotos en photos/ y lista en animals.json (un JSON por carpeta de equipo).
 */
export function getTeamAnimalsFolderId(countryKey, grade, teamNum) {
  return `${countryKeyToSlug(countryKey, grade)}-equipo-${teamNum}`;
}

/** @deprecated alias de getTeamAnimalsFolderId */
export const teamPhotoFolderId = getTeamAnimalsFolderId;

/**
 * Misma carpeta que en las cards, a partir de la URL `/equipo/:countrySlug/:teamId`.
 */
export function getTeamAnimalsFolderIdFromRoute(countrySlug, teamIdStr) {
  const n = parseInt(String(teamIdStr), 10);
  if (!countrySlug || !Number.isFinite(n) || n < 1) return "";
  return `${String(countrySlug).toLowerCase()}-equipo-${n}`;
}
