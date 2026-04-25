pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const container = document.getElementById("flipbook");
container.setAttribute("tabindex", "0");
container.style.outline = "none";
const url = '../archivo.pdf';

let pdfDoc = null;
let totalPaginas = 0;
let images = [];
let pageBaseWidth = 700;
let pageBaseHeight = 900;
let zoomScale = 1;
let zoomTarget = 1;
let zoomRaf = null;
let zoomFocusX = 0;
let zoomFocusY = 0;
let pinchActivo = false;
let pinchDistBase = 0;
let zoomBase = 1;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanciaEntreToques(t0, t1) {
  const dx = t1.clientX - t0.clientX;
  const dy = t1.clientY - t0.clientY;
  return Math.hypot(dx, dy);
}

function applyZoomAt(clientX, clientY) {
  const rect = container.getBoundingClientRect();
  const ox = ((clientX - rect.left) / rect.width) * 100;
  const oy = ((clientY - rect.top) / rect.height) * 100;
  container.style.transformOrigin = `${clamp(ox, 0, 100)}% ${clamp(oy, 0, 100)}%`;
  container.style.transform = `translateZ(0) scale3d(${zoomScale}, ${zoomScale}, 1)`;
}

function updateBookOverflowMode() {
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  const contentEl = document.getElementById("pdf-wrapper") || container;
  const contentHeight = contentEl ? contentEl.scrollHeight : 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const exceedsViewport = contentHeight > viewportHeight + 2;

  if (isLandscape && exceedsViewport) {
    document.documentElement.style.overflowX = "hidden";
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowX = "hidden";
    document.body.style.overflowY = "auto";
    return;
  }

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function setZoom(nextZoom, clientX, clientY) {
  zoomTarget = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
  zoomFocusX = clientX;
  zoomFocusY = clientY;
  if (zoomRaf) return;
  const tick = () => {
    const delta = zoomTarget - zoomScale;
    if (Math.abs(delta) < 0.0015) {
      zoomScale = zoomTarget;
      applyZoomAt(zoomFocusX, zoomFocusY);
      zoomRaf = null;
      return;
    }
    zoomScale += delta * 0.22;
    applyZoomAt(zoomFocusX, zoomFocusY);
    zoomRaf = requestAnimationFrame(tick);
  };
  zoomRaf = requestAnimationFrame(tick);
}

// -------------------- Controles flotantes --------------------
const controles = document.createElement('div');
controles.style.position = 'fixed';
controles.style.bottom = '12px';
controles.style.left = '50%';
controles.style.transform = 'translateX(-50%)';
controles.style.display = 'flex';
controles.style.gap = '8px';
controles.style.zIndex = 1000;

function crearBoton(iconoSvg, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.innerHTML = iconoSvg;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);

  btn.style.width = '32px';
  btn.style.height = '32px';
  btn.style.padding = '0';
  btn.style.cursor = 'pointer';
  btn.style.background = 'rgba(90, 90, 90, 0.35)';
  btn.style.backdropFilter = 'blur(8px)';
  btn.style.webkitBackdropFilter = 'blur(8px)';
  btn.style.border = '1px solid #b4f7ff';
  btn.style.borderRadius = '999px';
  btn.style.color = '#fff';
  btn.style.opacity = '0.45';
  btn.style.boxShadow = '0 0 12px rgba(100, 227, 255, 0.18)';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.pointerEvents = 'auto';

  btn.onmouseenter = () => btn.style.opacity = '0.85';
  btn.onmouseleave = () => btn.style.opacity = '0.45';

  return btn;
}


const loaderStyleTag = document.createElement("style");
loaderStyleTag.textContent = `
.loader-wrap {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 12000;
  background: rgba(0, 0, 0, 0.36);
  pointer-events: none;
}
.loader {
  width: 48px;
  height: 48px;
  border: 3px dotted #72f7ff;
  border-style: solid solid dotted dotted;
  border-radius: 50%;
  display: inline-block;
  position: relative;
  box-sizing: border-box;
  animation: rotation 2s linear infinite;
}
.loader::after {
  content: '';
  box-sizing: border-box;
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  margin: auto;
  border: 3px dotted #FF3D00;
  border-style: solid solid dotted;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  animation: rotationBack 1s linear infinite;
  transform-origin: center center;
}
@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes rotationBack {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(-360deg); }
}
`;
document.head.appendChild(loaderStyleTag);

const loaderWrap = document.createElement("div");
loaderWrap.className = "loader-wrap";
const loaderEl = document.createElement("span");
loaderEl.className = "loader";
loaderWrap.appendChild(loaderEl);
document.body.appendChild(loaderWrap);

function showLoader() {
  loaderWrap.style.display = "grid";
}

function hideLoader() {
  loaderWrap.style.display = "none";
}

const iconBack10 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 7l-5 5 5 5"/><path d="M18 7l-5 5 5 5"/></svg>';
const iconBack1 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7l-5 5 5 5"/></svg>';
const iconNext1 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7l5 5-5 5"/></svg>';
const iconNext10 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7l5 5-5 5"/><path d="M13 7l5 5-5 5"/></svg>';

const btnMenos10 = crearBoton(iconBack10, 'Retroceder 10 paginas');
const btnMenos1  = crearBoton(iconBack1, 'Pagina anterior');
const btnMas1    = crearBoton(iconNext1, 'Pagina siguiente');
const btnMas10   = crearBoton(iconNext10, 'Avanzar 10 paginas');

function postEmbedAction(type) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type }, "*");
    return;
  }
  if (type === "alamos-embed-back") {
    window.history.back();
    return;
  }
  if (type === "alamos-embed-home") {
    window.location.href = "/";
  }
}

function crearBotonAccion(iconoSvg, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "";
  btn.innerHTML = iconoSvg;
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
  btn.style.height = "32px";
  btn.style.width = "32px";
  btn.style.padding = "0";
  btn.style.cursor = "pointer";
  btn.style.background = "rgba(90, 90, 90, 0.35)";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.webkitBackdropFilter = "blur(8px)";
  btn.style.border = "1px solid #b4f7ff";
  btn.style.borderRadius = "999px";
  btn.style.color = "#fff";
  btn.style.fontSize = "0";
  btn.style.lineHeight = "0";
  btn.style.opacity = "0.75";
  btn.style.boxShadow = "0 0 12px rgba(100, 227, 255, 0.18)";
  btn.onmouseenter = () => (btn.style.opacity = "1");
  btn.onmouseleave = () => (btn.style.opacity = "0.75");
  return btn;
}

const acciones = document.createElement("div");
acciones.style.position = "fixed";
acciones.style.left = "50%";
acciones.style.top = "12px";
acciones.style.transform = "translateX(-50%)";
acciones.style.display = "flex";
acciones.style.gap = "8px";
acciones.style.zIndex = "1001";

const iconBack = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7l-5 5 5 5"/></svg>';
const iconHome = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';

const btnBack = crearBotonAccion(iconBack, "Regresar");
btnBack.onclick = () => postEmbedAction("alamos-embed-back");
const btnHome = crearBotonAccion(iconHome, "Home");
btnHome.onclick = () => postEmbedAction("alamos-embed-home");
acciones.append(btnBack, btnHome);
document.body.appendChild(acciones);
acciones.style.display = "none";

// Indicador de página
const indicadorPagina = document.createElement('span');
indicadorPagina.style.minWidth = '38px';
indicadorPagina.style.padding = '4px 6px';
indicadorPagina.style.fontSize = 'clamp(0.65rem, 1.2vw, 0.75rem)';
indicadorPagina.style.color = '#fff';
indicadorPagina.style.fontWeight = '600';
indicadorPagina.style.background = 'rgba(90,90,90,0.35)';
indicadorPagina.style.backdropFilter = 'blur(6px)';
indicadorPagina.style.borderRadius = '6px';
indicadorPagina.style.display = 'flex';
indicadorPagina.style.alignItems = 'center';
indicadorPagina.style.justifyContent = 'center';
indicadorPagina.style.fontFamily =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
indicadorPagina.style.fontVariantNumeric = 'tabular-nums';
indicadorPagina.style.fontFeatureSettings = '"tnum"';
indicadorPagina.style.whiteSpace = 'nowrap';

controles.append(btnMenos10, btnMenos1, indicadorPagina, btnMas1, btnMas10);
document.body.appendChild(controles);
controles.style.display = "none";

container.style.willChange = "transform";
container.style.transition = "none";
container.style.backfaceVisibility = "hidden";
container.addEventListener("wheel", (e) => {
  // Permite zoom con mouse/trackpad directamente sobre el libro.
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.08 : 0.92;
  setZoom(zoomScale * factor, e.clientX, e.clientY);
}, { passive: false });

container.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 2) return;
  pinchActivo = true;
  pinchDistBase = distanciaEntreToques(e.touches[0], e.touches[1]);
  zoomBase = zoomScale;
}, { passive: true });

container.addEventListener("touchmove", (e) => {
  if (e.touches.length !== 2 || !pinchActivo) return;
  e.preventDefault();
  const dist = distanciaEntreToques(e.touches[0], e.touches[1]);
  const ratio = pinchDistBase > 0 ? dist / pinchDistBase : 1;
  const nextZoom = clamp(zoomBase * ratio, ZOOM_MIN, ZOOM_MAX);
  const cx = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
  const cy = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
  setZoom(nextZoom, cx, cy);
}, { passive: false });

container.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) pinchActivo = false;
}, { passive: true });

container.addEventListener("touchcancel", () => {
  pinchActivo = false;
}, { passive: true });

window.addEventListener("keydown", (e) => {
  // Atajo rapido para volver al tamaño normal.
  if (e.key === "0") {
    zoomScale = 1;
    zoomTarget = 1;
    container.style.transformOrigin = "50% 50%";
    container.style.transform = "translateZ(0) scale3d(1, 1, 1)";
  }
});

// -------------------- Cargar PDF --------------------
async function cargarPDF() {
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  totalPaginas = pdfDoc.numPages;
  // Mantener proporción real del PDF para evitar distorsión al escalar.
  const probePage = await pdfDoc.getPage(1);
  const probeViewport = probePage.getViewport({ scale: 1 });
  const ratio = probeViewport.width / probeViewport.height;
  pageBaseHeight = 980;
  pageBaseWidth = Math.max(620, Math.round(pageBaseHeight * ratio));

  // Render nítido estable (sin sobreescalado extremo que cause artefactos).
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const qualityBoost = window.innerWidth <= 768 ? 2.25 : 1.95;
  const escala = Math.min(4.2, Math.max(1.8, dpr * qualityBoost));

  // Renderizar todas las páginas
  for (let i = 1; i <= totalPaginas; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    await page.render({ canvasContext: ctx, viewport, intent: "display" }).promise;
    images.push(canvas.toDataURL("image/png"));
  }

  // Agregar hoja final blanca si número de páginas impar
  if (totalPaginas % 2 !== 0) {
    const canvasFinal = document.createElement("canvas");
    const lastImg = new Image();
    lastImg.src = images[images.length - 1];
    await new Promise(res => lastImg.onload = res);
    canvasFinal.width = lastImg.width;
    canvasFinal.height = lastImg.height;
    const ctxFinal = canvasFinal.getContext("2d");
    ctxFinal.fillStyle = "#ffffff";
    ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height);
    images.push(canvasFinal.toDataURL("image/png"));
  }

  iniciarFlipbook();
}

// -------------------- Inicializar flipbook --------------------
function iniciarFlipbook() {
  // Ajuste "contain": mostrar hoja completa sin recortes.
  const availWidth = Math.max(320, Math.floor(window.innerWidth * 0.96));
  const availHeight = Math.max(420, Math.floor(window.innerHeight * 0.9));
  const fit = Math.min(availWidth / pageBaseWidth, availHeight / pageBaseHeight);
  const bookWidth = Math.max(280, Math.floor(pageBaseWidth * fit));
  const bookHeight = Math.max(360, Math.floor(pageBaseHeight * fit));

  const pageFlip = new St.PageFlip(container, {
    width: bookWidth,
    height: bookHeight,
    size: "fixed",
    minWidth: bookWidth,
    maxWidth: bookWidth,
    minHeight: bookHeight,
    maxHeight: bookHeight,
    drawShadow: true,
    showCover: false,
    backgroundColor: "#ffffff"
  });

  pageFlip.loadFromImages(images);
  requestAnimationFrame(updateBookOverflowMode);

  function ensureKeyboardFocus() {
    try {
      window.focus();
      container.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  function currentIndex() {
    return typeof pageFlip.getCurrentPageIndex === "function"
      ? pageFlip.getCurrentPageIndex()
      : 0;
  }

  function flipTo(target) {
    const next = Math.max(0, Math.min(images.length - 1, target));
    if (typeof pageFlip.flip === "function") {
      pageFlip.flip(next);
      return;
    }
    if (typeof pageFlip.turnToPage === "function") {
      pageFlip.turnToPage(next);
    }
  }

  function flipPrev() {
    if (typeof pageFlip.flipPrev === "function") {
      pageFlip.flipPrev();
      return;
    }
    flipTo(currentIndex() - 1);
  }

  function flipNext() {
    if (typeof pageFlip.flipNext === "function") {
      pageFlip.flipNext();
      return;
    }
    flipTo(currentIndex() + 1);
  }

  // -------------------- Funciones de navegación --------------------
  function avanzarPaginas(n) {
    let target = currentIndex() + n;
    if (target > images.length - 1) target = images.length - 1;
    flipTo(target);
  }

  function retrocederPaginas(n) {
    let target = currentIndex() - n;
    if (target < 0) target = 0;
    flipTo(target);
  }

  // -------------------- Controles --------------------
  btnMenos1.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    flipPrev();
  });
  btnMas1.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    flipNext();
  });
  btnMas10.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    avanzarPaginas(10);
  });
  btnMenos10.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    retrocederPaginas(10);
  });

  // Navegación por teclado (desktop): listeners globales y foco persistente.
  const onKeyDown = (e) => {
    const active = document.activeElement;
    const isTypingTarget =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    if (isTypingTarget) return;

    const key = e.key;
    const lower = typeof key === "string" ? key.toLowerCase() : "";
    const isPrev = key === "ArrowLeft" || key === "PageUp" || lower === "a";
    const isNext =
      key === "ArrowRight" || key === "PageDown" || key === " " || lower === "d";
    if (!isPrev && !isNext) return;

    e.preventDefault();
    e.stopPropagation();
    ensureKeyboardFocus();
    if (isPrev) flipPrev();
    if (isNext) flipNext();
  };
  window.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  // Si el usuario vuelve a interactuar con el libro, recuperamos foco de teclado.
  container.addEventListener("pointerdown", ensureKeyboardFocus);
  container.addEventListener("mousedown", ensureKeyboardFocus);
  container.addEventListener("touchstart", ensureKeyboardFocus, { passive: true });
  container.addEventListener("mouseenter", ensureKeyboardFocus);
  ensureKeyboardFocus();

  // Actualizar indicador de página
  pageFlip.on("flip", (e) => {
    const index = e.data; // índice interno del flipbook
    indicadorPagina.textContent = `${index + 1} / ${images.length}`;
  });

  // Inicializar indicador
  indicadorPagina.textContent = `1 / ${images.length}`;

  requestAnimationFrame(() => {
    hideLoader();
    controles.style.display = 'flex';
    acciones.style.display = 'flex';
  });

  window.addEventListener("resize", updateBookOverflowMode);
  window.addEventListener("orientationchange", updateBookOverflowMode);
}

// -------------------- Ejecutar --------------------
showLoader();
cargarPDF().catch((error) => {
  console.error(error);
  showLoader();
});


