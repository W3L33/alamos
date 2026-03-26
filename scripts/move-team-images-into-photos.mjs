/**
 * Mueve imágenes sueltas de public/grados/.../equipo-n/ a public/grados/.../equipo-n/photos/
 * (no toca animals.json ni countries-animals.json).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../public/grados");
const IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|webp)$/i;

function main() {
  if (!fs.existsSync(root)) return;
  let moved = 0;
  for (const grade of fs.readdirSync(root, { withFileTypes: true })) {
    if (!grade.isDirectory() || grade.name.startsWith(".")) continue;
    const gradeDir = path.join(root, grade.name);
    for (const group of fs.readdirSync(gradeDir, { withFileTypes: true })) {
      if (!group.isDirectory() || group.name.startsWith(".")) continue;
      const groupDir = path.join(gradeDir, group.name);
      for (const team of fs.readdirSync(groupDir, { withFileTypes: true })) {
        if (!team.isDirectory() || !/^equipo-\d+$/i.test(team.name)) continue;
        const teamDir = path.join(groupDir, team.name);
        const photosDir = path.join(teamDir, "photos");
        fs.mkdirSync(photosDir, { recursive: true });
        for (const name of fs.readdirSync(teamDir)) {
          if (name === "photos" || name.startsWith(".")) continue;
          const abs = path.join(teamDir, name);
          if (!fs.statSync(abs).isFile()) continue;
          if (!IMAGE_EXT_RE.test(name)) continue;
          const dest = path.join(photosDir, name);
          if (fs.existsSync(dest)) {
            fs.unlinkSync(abs);
            continue;
          }
          fs.renameSync(abs, dest);
          moved++;
        }
      }
    }
  }
  console.log(`[move-team-images-into-photos] moved=${moved}`);
}

main();
