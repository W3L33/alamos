pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const container = document.getElementById("flipbook");
container.setAttribute("tabindex", "0");
container.style.outline = "none";
const url = "../archivo.pdf";

let pdfDoc = null;
let totalPaginas = 0;
let images = [];
let pageBaseWidth = 700;
let pageBaseHeight = 900;
let probePageWidth = 700;
let currentRenderScale = 0;
let pageFlipInstance = null;
let lastBookWidth = 0;
let isRerendering = false;
let controlsBound = false;
let flipPrev = () => {};
let flipNext = () => {};
let avanzarPaginas = () => {};
let retrocederPaginas = () => {};
let rerenderDebounce = null;
let resizeDebounce = null;

let zoomScale = 1;
let zoomTarget = 1;
let zoomRaf = null;
let zoomFocusX = 0;
let zoomFocusY = 0;
let pinchActivo = false;
let pinchDistBase = 0;
let zoomBase = 1;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3.5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPixelRatio() {
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 4));
}

function isMobileLayout() {
  return (
    window.innerWidth <= 768 ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  );
}

function computeBookDimensions() {
  const availWidth = Math.max(320, Math.floor(window.innerWidth * 0.96));
  const availHeight = Math.max(420, Math.floor(window.innerHeight * 0.9));
  const fit = Math.min(availWidth / pageBaseWidth, availHeight / pageBaseHeight);
  const bookWidth = Math.max(280, Math.floor(pageBaseWidth * fit));
  const bookHeight = Math.max(360, Math.floor(pageBaseHeight * fit));
  return { bookWidth, bookHeight };
}

/** Escala PDF.js: suficiente px para pantalla × DPR × zoom sin pixelar. */
function computeRenderScale(bookWidth, zoomFactor) {
  const dpr = getPixelRatio();
  const margin = isMobileLayout() ? 1.25 : 1.1;
  const targetWidthPx = bookWidth * dpr * zoomFactor * margin;
  const scale = targetWidthPx / probePageWidth;
  return Math.min(14, Math.max(2.5, scale));
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

function scheduleRerenderForZoom(zoom) {
  clearTimeout(rerenderDebounce);
  rerenderDebounce = setTimeout(() => ensureRenderScaleForZoom(zoom), 320);
}

async function ensureRenderScaleForZoom(zoom) {
  if (!pdfDoc || isRerendering || !pageFlipInstance) return;
  const { bookWidth } = computeBookDimensions();
  const targetScale = computeRenderScale(bookWidth, Math.max(1, zoom));
  if (targetScale <= currentRenderScale * 1.04) return;

  isRerendering = true;
  const idx =
    typeof pageFlipInstance.getCurrentPageIndex === "function"
      ? pageFlipInstance.getCurrentPageIndex()
      : 0;

  try {
    await renderAllPages(targetScale);
    pageFlipInstance.loadFromImages(images);
    if (typeof pageFlipInstance.turnToPage === "function") {
      pageFlipInstance.turnToPage(idx);
    } else if (typeof pageFlipInstance.flip === "function") {
      pageFlipInstance.flip(idx);
    }
  } catch (err) {
    console.error("Error al re-renderizar zoom:", err);
  } finally {
    isRerendering = false;
  }
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
      scheduleRerenderForZoom(zoomScale);
      return;
    }
    zoomScale += delta * 0.22;
    applyZoomAt(zoomFocusX, zoomFocusY);
    zoomRaf = requestAnimationFrame(tick);
  };
  zoomRaf = requestAnimationFrame(tick);
}

// -------------------- Controles flotantes --------------------
const controles = document.createElement("div");
controles.style.position = "fixed";
controles.style.bottom = "12px";
controles.style.left = "50%";
controles.style.transform = "translateX(-50%)";
controles.style.display = "flex";
controles.style.gap = "8px";
controles.style.zIndex = 1000;

function crearBoton(iconoSvg, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerHTML = iconoSvg;
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);

  btn.style.width = "32px";
  btn.style.height = "32px";
  btn.style.padding = "0";
  btn.style.cursor = "pointer";
  btn.style.background = "rgba(70, 74, 84, 0.78)";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.webkitBackdropFilter = "blur(8px)";
  btn.style.border = "1px solid rgba(180, 247, 255, 0.95)";
  btn.style.borderRadius = "999px";
  btn.style.color = "#fff";
  btn.style.opacity = "1";
  btn.style.boxShadow = "0 0 18px rgba(100, 227, 255, 0.35)";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.pointerEvents = "auto";

  btn.onmouseenter = () => (btn.style.opacity = "1");
  btn.onmouseleave = () => (btn.style.opacity = "1");

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

const iconBack10 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 7l-5 5 5 5"/><path d="M18 7l-5 5 5 5"/></svg>';
const iconBack1 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7l-5 5 5 5"/></svg>';
const iconNext1 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7l5 5-5 5"/></svg>';
const iconNext10 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7l5 5-5 5"/><path d="M13 7l5 5-5 5"/></svg>';

const btnMenos10 = crearBoton(iconBack10, "Retroceder 10 paginas");
const btnMenos1 = crearBoton(iconBack1, "Pagina anterior");
const btnMas1 = crearBoton(iconNext1, "Pagina siguiente");
const btnMas10 = crearBoton(iconNext10, "Avanzar 10 paginas");

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
  btn.style.background = "rgba(70, 74, 84, 0.78)";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.webkitBackdropFilter = "blur(8px)";
  btn.style.border = "1px solid rgba(180, 247, 255, 0.95)";
  btn.style.borderRadius = "999px";
  btn.style.color = "#fff";
  btn.style.fontSize = "0";
  btn.style.lineHeight = "0";
  btn.style.opacity = "1";
  btn.style.boxShadow = "0 0 18px rgba(100, 227, 255, 0.35)";
  btn.onmouseenter = () => (btn.style.opacity = "1");
  btn.onmouseleave = () => (btn.style.opacity = "1");
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

const iconBack =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7l-5 5 5 5"/></svg>';
const iconHome =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';

const btnBack = crearBotonAccion(iconBack, "Regresar");
btnBack.onclick = () => postEmbedAction("alamos-embed-back");
const btnHome = crearBotonAccion(iconHome, "Home");
btnHome.onclick = () => postEmbedAction("alamos-embed-home");
acciones.append(btnBack, btnHome);
document.body.appendChild(acciones);
acciones.style.display = "none";

const indicadorPagina = document.createElement("span");
indicadorPagina.style.minWidth = "38px";
indicadorPagina.style.padding = "4px 6px";
indicadorPagina.style.fontSize = "clamp(0.65rem, 1.2vw, 0.75rem)";
indicadorPagina.style.color = "#fff";
indicadorPagina.style.fontWeight = "600";
indicadorPagina.style.background = "rgba(70, 74, 84, 0.78)";
indicadorPagina.style.backdropFilter = "blur(6px)";
indicadorPagina.style.borderRadius = "6px";
indicadorPagina.style.display = "flex";
indicadorPagina.style.alignItems = "center";
indicadorPagina.style.justifyContent = "center";
indicadorPagina.style.fontFamily =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
indicadorPagina.style.fontVariantNumeric = "tabular-nums";
indicadorPagina.style.fontFeatureSettings = '"tnum"';
indicadorPagina.style.whiteSpace = "nowrap";

controles.append(btnMenos10, btnMenos1, indicadorPagina, btnMas1, btnMas10);
document.body.appendChild(controles);
controles.style.display = "none";

container.style.willChange = "transform";
container.style.transition = "none";
container.style.backfaceVisibility = "hidden";
container.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(zoomScale * factor, e.clientX, e.clientY);
  },
  { passive: false }
);

container.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length !== 2) return;
    pinchActivo = true;
    pinchDistBase = distanciaEntreToques(e.touches[0], e.touches[1]);
    zoomBase = zoomScale;
  },
  { passive: true }
);

container.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length !== 2 || !pinchActivo) return;
    e.preventDefault();
    const dist = distanciaEntreToques(e.touches[0], e.touches[1]);
    const ratio = pinchDistBase > 0 ? dist / pinchDistBase : 1;
    const nextZoom = clamp(zoomBase * ratio, ZOOM_MIN, ZOOM_MAX);
    const cx = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
    const cy = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
    setZoom(nextZoom, cx, cy);
  },
  { passive: false }
);

container.addEventListener(
  "touchend",
  (e) => {
    if (e.touches.length < 2) pinchActivo = false;
  },
  { passive: true }
);

container.addEventListener("touchcancel", () => {
  pinchActivo = false;
}, { passive: true });

window.addEventListener("keydown", (e) => {
  if (e.key === "0") {
    zoomScale = 1;
    zoomTarget = 1;
    container.style.transformOrigin = "50% 50%";
    container.style.transform = "translateZ(0) scale3d(1, 1, 1)";
    scheduleRerenderForZoom(1);
  }
});

async function renderAllPages(renderScale) {
  const newImages = [];
  for (let i = 1; i <= totalPaginas; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    await page.render({ canvasContext: ctx, viewport, intent: "display" }).promise;
    newImages.push(canvas.toDataURL("image/png"));
  }

  if (totalPaginas % 2 !== 0) {
    const canvasFinal = document.createElement("canvas");
    const lastImg = new Image();
    lastImg.src = newImages[newImages.length - 1];
    await new Promise((res) => {
      lastImg.onload = res;
      lastImg.onerror = res;
    });
    canvasFinal.width = lastImg.width;
    canvasFinal.height = lastImg.height;
    const ctxFinal = canvasFinal.getContext("2d");
    ctxFinal.fillStyle = "#ffffff";
    ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height);
    newImages.push(canvasFinal.toDataURL("image/png"));
  }

  images = newImages;
  currentRenderScale = renderScale;
}

function destroyFlipbook() {
  if (pageFlipInstance && typeof pageFlipInstance.destroy === "function") {
    try {
      pageFlipInstance.destroy();
    } catch {
      /* ignore */
    }
  }
  container.innerHTML = "";
  pageFlipInstance = null;
}

async function handleViewportResize() {
  updateBookOverflowMode();
  if (!pdfDoc || isRerendering) return;
  const { bookWidth } = computeBookDimensions();
  if (Math.abs(bookWidth - lastBookWidth) < 20) return;
  lastBookWidth = bookWidth;
  const scale = computeRenderScale(bookWidth, Math.max(zoomScale, ZOOM_MAX));
  if (scale <= currentRenderScale * 1.03 && pageFlipInstance) return;

  isRerendering = true;
  const idx = pageFlipInstance?.getCurrentPageIndex?.() ?? 0;
  try {
    await renderAllPages(scale);
    destroyFlipbook();
    iniciarFlipbook(idx);
  } finally {
    isRerendering = false;
  }
}

function scheduleViewportResize() {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(handleViewportResize, 450);
}

// -------------------- Cargar PDF --------------------
async function cargarPDF() {
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  totalPaginas = pdfDoc.numPages;

  const probePage = await pdfDoc.getPage(1);
  const probeViewport = probePage.getViewport({ scale: 1 });
  probePageWidth = probeViewport.width;
  const ratio = probeViewport.width / probeViewport.height;
  pageBaseHeight = 980;
  pageBaseWidth = Math.max(620, Math.round(pageBaseHeight * ratio));

  const { bookWidth } = computeBookDimensions();
  lastBookWidth = bookWidth;
  const initialScale = computeRenderScale(bookWidth, ZOOM_MAX);
  await renderAllPages(initialScale);
  iniciarFlipbook(0);
}

function bindControlsOnce() {
  if (controlsBound) return;
  controlsBound = true;

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
    try {
      window.focus();
      container.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    if (isPrev) flipPrev();
    if (isNext) flipNext();
  };
  window.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  container.addEventListener("pointerdown", () => {
    try {
      window.focus();
      container.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  });
  container.addEventListener("mousedown", () => {
    try {
      window.focus();
      container.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  });
  container.addEventListener("touchstart", () => {
    try {
      window.focus();
      container.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }, { passive: true });
}

// -------------------- Inicializar flipbook --------------------
function iniciarFlipbook(startIndex = 0) {
  const { bookWidth, bookHeight } = computeBookDimensions();
  lastBookWidth = bookWidth;

  pageFlipInstance = new St.PageFlip(container, {
    width: bookWidth,
    height: bookHeight,
    size: "fixed",
    minWidth: bookWidth,
    maxWidth: bookWidth,
    minHeight: bookHeight,
    maxHeight: bookHeight,
    drawShadow: true,
    showCover: false,
    backgroundColor: "#ffffff",
  });

  pageFlipInstance.loadFromImages(images);
  const start = Math.max(0, Math.min(images.length - 1, startIndex));
  if (start > 0) {
    if (typeof pageFlipInstance.turnToPage === "function") {
      pageFlipInstance.turnToPage(start);
    } else if (typeof pageFlipInstance.flip === "function") {
      pageFlipInstance.flip(start);
    }
  }

  requestAnimationFrame(updateBookOverflowMode);

  function currentIndex() {
    return typeof pageFlipInstance.getCurrentPageIndex === "function"
      ? pageFlipInstance.getCurrentPageIndex()
      : 0;
  }

  function flipTo(target) {
    const next = Math.max(0, Math.min(images.length - 1, target));
    if (typeof pageFlipInstance.flip === "function") {
      pageFlipInstance.flip(next);
      return;
    }
    if (typeof pageFlipInstance.turnToPage === "function") {
      pageFlipInstance.turnToPage(next);
    }
  }

  flipPrev = () => {
    if (typeof pageFlipInstance.flipPrev === "function") {
      pageFlipInstance.flipPrev();
      return;
    }
    flipTo(currentIndex() - 1);
  };

  flipNext = () => {
    if (typeof pageFlipInstance.flipNext === "function") {
      pageFlipInstance.flipNext();
      return;
    }
    flipTo(currentIndex() + 1);
  };

  avanzarPaginas = (n) => {
    let target = currentIndex() + n;
    if (target > images.length - 1) target = images.length - 1;
    flipTo(target);
  };

  retrocederPaginas = (n) => {
    let target = currentIndex() - n;
    if (target < 0) target = 0;
    flipTo(target);
  };

  bindControlsOnce();

  pageFlipInstance.on("flip", (e) => {
    const index = e.data;
    indicadorPagina.textContent = `${index + 1} / ${images.length}`;
  });

  indicadorPagina.textContent = `${start + 1} / ${images.length}`;

  requestAnimationFrame(() => {
    hideLoader();
    controles.style.display = "flex";
    acciones.style.display = "flex";
  });
}

window.addEventListener("resize", scheduleViewportResize);
window.addEventListener("orientationchange", scheduleViewportResize);

showLoader();
cargarPDF().catch((error) => {
  console.error(error);
  showLoader();
});
