import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(__dirname, "../public/animales/assets/index-BZXG5iV1.js");

let src = fs.readFileSync(bundlePath, "utf8");

src = src.replace(
  "`/images/photos/${encodeURIComponent(r)}/${String(t).split(`/`).filter(Boolean).map(e=>encodeURIComponent(e)).join(`/`)}`",
  "`${(()=>{let e=String(r).split(`-equipo-`);return e.length===2?`/grados/1º/${e[0]}/equipo-${e[1]}`:`/grados/1º/${String(r)}`})()}/${String(t).split(`/`).filter(Boolean).map(e=>encodeURIComponent(e)).join(`/`)}`"
);

src = src.replace(
  "fetch(`/images/photos/photos-manifest.json`)",
  "fetch(`/grados/photos-manifest.json`)"
);

src = src.replace(
  "if(a){let e=await Tb(),t=db(e,a);o=t?.length?yb(a,t,e,r):[]}",
  "if(a){let e=String(a).split(`-equipo-`),t=e.length===2?`/grados/1º/${e[0]}/equipo-${e[1]}/photos/countries-animals.json`:``;if(t)try{let n=await fetch(t);if(n.ok){let t=await n.json();o=Array.isArray(t)&&t.length?t:[]}else{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}}catch{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}else{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}}"
);

src = src.replace("/images/photos/default.avif", "/team-placeholder.svg");
src = src.replace("public/images/photos/", "public/grados/1º/");
src = src.replace("/photos/`]}),` y ejecuta `", "/equipo-<n>/`]}),` y ejecuta `");

fs.writeFileSync(bundlePath, src);
console.log("Patched public/animales bundle paths.");

