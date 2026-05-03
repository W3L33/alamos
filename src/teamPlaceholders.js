/** Placeholder sin foto: noche = negro, día = blanco (manifiesto usa la ruta “noche” como ausencia de archivos). */
export const DEFAULT_TEAM_IMAGE_NIGHT = "/team-placeholder.svg";
export const DEFAULT_TEAM_IMAGE_DAY = "/team-placeholder-day.svg";
/** Alias usado por `teamPhotos` cuando no hay imágenes en la carpeta del equipo */
export const DEFAULT_TEAM_IMAGE = DEFAULT_TEAM_IMAGE_NIGHT;

export const TEAM_COUNT = 8;
const INTEGRANTES_PER_TEAM = 6;

/** 8 equipos con nombres e integrantes numerados (placeholder). */
export function getTeamCardPlaceholders(overridesByTeamId = {}) {
  return Array.from({ length: TEAM_COUNT }, (_, i) => {
    const n = i + 1;
    const start = (n - 1) * INTEGRANTES_PER_TEAM + 1;
    const names = Array.from(
      { length: INTEGRANTES_PER_TEAM },
      (_, j) => `Integrante ${start + j}`
    );
    const override = overridesByTeamId?.[n] ?? {};
    const overrideMembers = Array.isArray(override.integrantes)
      ? override.integrantes.filter((name) => String(name || "").trim().length > 0)
      : null;
    const hideCard = Array.isArray(override.integrantes) && overrideMembers.length === 0;
    return {
      id: n,
      name: String(override.name || "").trim() || `Equipo ${n}`,
      integrantesLabel: overrideMembers?.length
        ? overrideMembers.join(", ")
        : names.join(", "),
      hidden: hideCard,
      imageUrl: DEFAULT_TEAM_IMAGE,
    };
  });
}
