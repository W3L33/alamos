import fs from "fs";
import path from "path";

const IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|webp)$/i;

export function listImagesRecursive(teamDir, rel = "") {
  const dirPath = rel ? path.join(teamDir, ...rel.split("/")) : teamDir;
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }
  const out = [];
  for (const f of fs.readdirSync(dirPath)) {
    if (f.startsWith(".") || f === "animals.json") continue;
    const childRel = rel ? `${rel}/${f}` : f;
    const abs = path.join(teamDir, ...childRel.split("/"));
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      out.push(...listImagesRecursive(teamDir, childRel));
    } else if (IMAGE_EXT_RE.test(f)) {
      out.push(childRel.replace(/\\/g, "/"));
    }
  }
  return out;
}

export function collectAllImageRelPaths(teamDir) {
  if (!teamDir || !fs.existsSync(teamDir) || !fs.statSync(teamDir).isDirectory()) {
    return [];
  }
  const photosDir = path.join(teamDir, "photos");
  if (fs.existsSync(photosDir) && fs.statSync(photosDir).isDirectory()) {
    const inPhotos = listImagesRecursive(photosDir, "");
    if (inPhotos.length) {
      return inPhotos
        .map((rel) => `photos/${rel.replace(/\\/g, "/")}`)
        .sort((a, b) => a.localeCompare(b, "es"));
    }
  }
  return listImagesRecursive(teamDir).sort((a, b) => a.localeCompare(b, "es"));
}
