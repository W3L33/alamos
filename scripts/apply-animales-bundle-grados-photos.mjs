/**
 * Actualiza el bundle servido en public/animales: rutas bajo .../equipo-n/photos/,
 * grado según grupo (1º/2º/3º) y normalización de imágenes al cargar countries-animals.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(__dirname, "../public/animales/assets/index-BZXG5iV1.js");

const OLD_PB =
  "function pb(e,t,n){let r=fb(n,e);return`${(()=>{let e=String(r).split(`-equipo-`);return e.length===2?`/grados/1º/${e[0]}/equipo-${e[1]}`:`/grados/1º/${String(r)}`})()}/${String(t).split(`/`).filter(Boolean).map(e=>encodeURIComponent(e)).join(`/`)}`}";

const NEW_PB =
  'function pb(e,t,n){let r=fb(n,e),m=String(r).toLowerCase().match(/^(.*)-equipo-(\\d+)$/i);if(!m)return"";let g=m[1],num=m[2],gr=["mexico","francia","alemania","inglaterra"].includes(g)?"1º":["japon","usa","argentina","australia"].includes(g)?"3º":"2º",base="/grados/"+gr+"/"+g+"/equipo-"+num,rel=String(t).split("/").filter(Boolean).join("/");return rel.toLowerCase().startsWith("photos/")||(rel="photos/"+rel),base+"/"+rel.split("/").map(function(e){return encodeURIComponent(e)}).join("/")}';

const OLD_COUNTRIES =
  "if(a){let e=String(a).split(`-equipo-`),t=e.length===2?`/grados/1º/${e[0]}/equipo-${e[1]}/photos/countries-animals.json`:``;if(t)try{let n=await fetch(t);if(n.ok){let t=await n.json();o=Array.isArray(t)&&t.length?t:[]}else{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}}catch{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}else{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}}";

const NEW_COUNTRIES =
  'if(a){let photosBase=(function(k){let m=String(k).toLowerCase().match(/^(.*)-equipo-(\\d+)$/i);if(!m)return"";let g=m[1],num=m[2],gr=["mexico","francia","alemania","inglaterra"].includes(g)?"1º":["japon","usa","argentina","australia"].includes(g)?"3º":"2º";return"/grados/"+gr+"/"+g+"/equipo-"+num+"/photos"})(a),t=photosBase?photosBase+"/countries-animals.json":"";if(t)try{let n=await fetch(t);if(n.ok){let raw=await n.json();if(Array.isArray(raw)&&raw.length){o=raw.filter(function(e){return e&&Number.isFinite(Number(e.lat))&&Number.isFinite(Number(e.lon))}).map(function(row){function fn(u){var s=String(u||"").split("?")[0].split("#")[0].split("/").filter(Boolean).pop()||"";return s?photosBase+"/"+encodeURIComponent(s):""}var img=fn(row.imageUrl||row.vectorFallbackUrl),vfb=fn(row.vectorFallbackUrl||row.imageUrl)||img;return{...row,country:row.country||"Desconocido",lat:Number(row.lat),lon:Number(row.lon),animal:String(row.animal||"").trim()||"Animal",imageUrl:img||dy,vectorFallbackUrl:vfb||img||dy}})}else{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}}else{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}}catch(e){let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}else{let n=await Tb(),t=db(n,a);o=t?.length?yb(a,t,n,r):[]}}';

let src = fs.readFileSync(bundlePath, "utf8");
if (src.includes("photosBase=(function(k)")) {
  console.log("apply-animales-bundle-grados-photos: bundle ya actualizado, omito.");
  process.exit(0);
}
if (!src.includes(OLD_PB)) {
  console.error("apply-animales-bundle-grados-photos: pb() no coincide (bundle distinto).");
  process.exit(1);
}
if (!src.includes(OLD_COUNTRIES)) {
  console.error("apply-animales-bundle-grados-photos: bloque countries no coincide.");
  process.exit(1);
}
src = src.replace(OLD_PB, NEW_PB);
src = src.replace(OLD_COUNTRIES, NEW_COUNTRIES);
fs.writeFileSync(bundlePath, src);
console.log("OK: apply-animales-bundle-grados-photos");
