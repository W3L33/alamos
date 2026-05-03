import { gradeDirFromUiGrade } from "./teamStoragePaths.js";
import { countryKeyToSlug } from "./teamPaths.js";

const teamMembersCache = new Map();

function teamMembersModuleUrl(countryKey, grade, teamId) {
  const gradeDir = gradeDirFromUiGrade(Number(grade));
  if (!gradeDir) return "";
  const countrySlug = countryKeyToSlug(countryKey, grade);
  return `/grados/${gradeDir}/${countrySlug}/equipo-${teamId}/integrantes.js`;
}

function normalizeTeamMembersPayload(data) {
  if (!data || typeof data !== "object") return null;
  const name = String(data.name || "").trim();
  const integrantes = Array.isArray(data.integrantes)
    ? data.integrantes
        .map((v) => String(v || "").trim())
        .filter((v) => v.length > 0)
    : [];
  if (!name && integrantes.length === 0) return null;
  return { name, integrantes };
}

export async function loadTeamMembersByTeamId(countryKey, grade, teamCount) {
  if (!countryKey || !teamCount) return {};
  const key = `${String(countryKey).toLowerCase()}::${Number(grade)}::${Number(teamCount)}`;
  if (!import.meta.env.DEV && teamMembersCache.has(key)) return teamMembersCache.get(key);

  const tasks = Array.from({ length: Number(teamCount) }, (_, i) => i + 1).map(
    async (teamId) => {
      const moduleUrl = teamMembersModuleUrl(countryKey, grade, teamId);
      if (!moduleUrl) return [teamId, null];
      try {
        const mod = await import(/* @vite-ignore */ `${moduleUrl}?t=${Date.now()}`);
        const normalized = normalizeTeamMembersPayload(mod?.default ?? mod?.team ?? mod);
        return [teamId, normalized];
      } catch {
        return [teamId, null];
      }
    }
  );

  const entries = await Promise.all(tasks);
  const byTeamId = {};
  for (const [teamId, data] of entries) {
    if (data) byTeamId[teamId] = data;
  }
  if (!import.meta.env.DEV) {
    teamMembersCache.set(key, byTeamId);
  }
  return byTeamId;
}
