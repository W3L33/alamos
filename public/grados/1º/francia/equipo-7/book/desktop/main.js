function resolveBookAsset(filename) {
  const pathname = window.location.pathname || "";
  const idx = pathname.indexOf("/grados/");
  const prefix = idx >= 0 ? pathname.slice(0, idx) : "";
  return `${prefix}/book-assets/${filename}`;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = resolveBookAsset("pdf.worker.min.js");

const container = document.getElementById("flipbook");
container.setAttribute("tabindex", "0");
container.style.outline = "none";
container.style.touchAction = "pan-x pan-y";
const url = "../archivo.pdf";

const zoomWrap = document.createElement("div");
zoomWrap.id = "flipbook-zoom-wrap";
zoomWrap.style.cssText =
  "width:100%;height:100%;display:grid;place-items:center;touch-action:manipulation;";
if (container.parentNode) {
  container.parentNode.insertBefore(zoomWrap, container);
  zoomWrap.appendChild(container);
}

const INITIAL_PAGES = 4;
const MAX_CANVAS_EDGE = 4096;
const JPEG_QUALITY_DESKTOP = 0.92;
const PREFETCH_NEIGHBORS = 2;
const BG_RENDER_DELAY_MS = 40;
const UPDATE_FLIPBOOK_EVERY = 4;
/** Mismo ancho de libro que usa tablet para rasterizar (solo cálculo en móvil). */
const TABLET_REF_BOOK_WIDTH = 900;
/** Mínimo de píxeles horizontales por página en móvil (texto legible al reducir). */
const MOBILE_RASTER_MIN_WIDTH = 3000;
/** PageFlip dibuja a baja res. en móvil; render interno 2× y se escala con CSS. */
const PAGE_FLIP_PHONE_BOOST = 2;

let pdfDoc = null;
let totalPaginas = 0;
let images = [];
let pageCache = new Map();
let renderInFlight = new Set();
let pageBaseWidth = 700;
let pageBaseHeight = 900;
let probePageWidth = 700;
let probePageHeight = 900;
let pageRenderWidth = 0;
let pageRenderHeight = 0;
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
let fullPagePlaceholderUrl = "";
let backgroundRenderToken = 0;
let lastFlipbookUpdateAt = 0;
const blobUrls = new Set();

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
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
}

function isPhone() {
  if (/iPad/i.test(navigator.userAgent)) return false;
  if (window.innerWidth >= 768) return false;
  return isTouchDevice();
}

function trackBlobUrl(url) {
  if (typeof url === "string" && url.startsWith("blob:")) {
    blobUrls.add(url);
  }
}

function revokeBlobUrls() {
  for (const url of blobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  blobUrls.clear();
}

function getJpegQuality() {
  return JPEG_QUALITY_DESKTOP;
}

function isTouchDevice() {
  return (
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

function useSinglePageMode() {
  return window.innerWidth < 1200 || isMobileLayout();
}

function getPageDisplayWidth(bookWidth) {
  return useSinglePageMode() ? bookWidth : bookWidth / 2;
}

function yieldToMain() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

function capScaleForCanvas(scale) {
  if (!probePageWidth || !probePageHeight) return scale;
  const w = probePageWidth * scale;
  const h = probePageHeight * scale;
  const maxEdge = Math.max(w, h);
  if (maxEdge <= MAX_CANVAS_EDGE) return scale;
  return scale * (MAX_CANVAS_EDGE / maxEdge) * 0.98;
}

/** Escala idéntica a tablet (ancho ref. fijo 900px); el visor en móvil sigue siendo pequeño. */
function computeTabletQualityRenderScale(zoomFactor) {
  const dpr = 2.5;
  const pageWidth = TABLET_REF_BOOK_WIDTH;
  const supersample = 2.35;
  const targetWidthPx = pageWidth * dpr * zoomFactor * supersample;
  let scale = targetWidthPx / probePageWidth;
  scale = Math.max(scale, MOBILE_RASTER_MIN_WIDTH / probePageWidth);
  scale = Math.min(5.5, Math.max(2.65, scale));
  return capScaleForCanvas(scale);
}

function computeRenderScale(bookWidth, zoomFactor) {
  if (isPhone()) {
    return computeTabletQualityRenderScale(zoomFactor);
  }
  const dpr = getPixelRatio();
  const pageWidth = getPageDisplayWidth(bookWidth);
  const touch = isTouchDevice();
  const supersample = touch ? 2.35 : 1.7;
  const targetWidthPx = pageWidth * dpr * zoomFactor * supersample;
  let scale = targetWidthPx / probePageWidth;
  const minScale = touch ? 2.65 : 1.85;
  const maxScale = touch ? 5.5 : 9;
  scale = Math.min(maxScale, Math.max(minScale, scale));
  return capScaleForCanvas(scale);
}

function getFullPagePlaceholder() {
  if (fullPagePlaceholderUrl) return fullPagePlaceholderUrl;
  const w = Math.max(400, pageRenderWidth || 900);
  const h = Math.max(500, pageRenderHeight || 1200);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  fullPagePlaceholderUrl = canvas.toDataURL("image/jpeg", 0.85);
  return fullPagePlaceholderUrl;
}

function isPlaceholderAt(imageIndex) {
  const pageNum = imageIndex + 1;
  return pageNum >= 1 && pageNum <= totalPaginas && !pageCache.has(pageNum);
}

function distanciaEntreToques(t0, t1) {
  const dx = t1.clientX - t0.clientX;
  const dy = t1.clientY - t0.clientY;
  return Math.hypot(dx, dy);
}

function applyZoomAt(clientX, clientY) {
  if (isTouchDevice()) return;
  const rect = zoomWrap.getBoundingClientRect();
  const ox = ((clientX - rect.left) / rect.width) * 100;
  const oy = ((clientY - rect.top) / rect.height) * 100;
  zoomWrap.style.transformOrigin = `${clamp(ox, 0, 100)}% ${clamp(oy, 0, 100)}%`;
  zoomWrap.style.transform = `translateZ(0) scale3d(${zoomScale}, ${zoomScale}, 1)`;
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
  if (isTouchDevice()) return;
  clearTimeout(rerenderDebounce);
  rerenderDebounce = setTimeout(() => ensureRenderScaleForZoom(zoom), 400);
}

async function ensureRenderScaleForZoom(zoom) {
  if (!pdfDoc || isRerendering || !pageFlipInstance || isTouchDevice()) return;
  const { bookWidth } = computeBookDimensions();
  const targetScale = computeRenderScale(bookWidth, Math.max(1, zoom));
  if (targetScale <= currentRenderScale * 1.08) return;

  isRerendering = true;
  backgroundRenderToken += 1;
  const idx = pageFlipInstance.getCurrentPageIndex?.() ?? 0;
  try {
    pageCache.clear();
    await renderAllPages(targetScale);
    destroyFlipbook();
    iniciarFlipbook(idx);
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
  return btn;
}

const loaderStyleTag = document.createElement("style");
loaderStyleTag.textContent = `
.loader-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 12000;
  background: rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
.loader-wrap.is-error { pointer-events: auto; padding: 24px; text-align: center; }
.loader-status { margin: 0; color: #e8f7ff; font: 500 0.9rem/1.35 system-ui, sans-serif; max-width: 18rem; }
.loader-error { margin: 0 0 12px; color: #fff; font: 500 1rem/1.4 system-ui, sans-serif; max-width: 20rem; }
.loader-retry { padding: 8px 16px; border-radius: 999px; border: 1px solid #b4f7ff; background: rgba(70, 74, 84, 0.9); color: #fff; cursor: pointer; font: 600 0.85rem system-ui, sans-serif; }
.loader { width: 48px; height: 48px; border: 3px dotted #72f7ff; border-style: solid solid dotted dotted; border-radius: 50%; display: inline-block; position: relative; box-sizing: border-box; animation: rotation 2s linear infinite; }
.loader::after { content: ''; box-sizing: border-box; position: absolute; inset: 0; margin: auto; border: 3px dotted #FF3D00; border-style: solid solid dotted; width: 24px; height: 24px; border-radius: 50%; animation: rotationBack 1s linear infinite; transform-origin: center center; }
@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes rotationBack { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
.book--phone-sharp .stf__item img,
.book--phone-sharp .stf__item .page {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: high-quality;
}
#flipbook-zoom-wrap--phone {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 52px 10px 80px;
  box-sizing: border-box;
  touch-action: manipulation;
}
#flipbook-phone-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: visible;
  box-sizing: border-box;
}
#flipbook-phone-inner {
  flex-shrink: 0;
  transform-origin: center center;
}
#flipbook-phone-stage #flipbook {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  width: auto !important;
  height: auto !important;
  max-width: none !important;
  margin: 0 !important;
}
`;
document.head.appendChild(loaderStyleTag);

const loaderWrap = document.createElement("div");
loaderWrap.className = "loader-wrap";
const loaderEl = document.createElement("span");
loaderEl.className = "loader";
const loaderStatus = document.createElement("p");
loaderStatus.className = "loader-status";
loaderStatus.textContent = "Cargando revista…";
loaderWrap.append(loaderEl, loaderStatus);
document.body.appendChild(loaderWrap);

function setLoaderMessage(text) {
  loaderStatus.textContent = text;
}

function showLoader() {
  loaderWrap.classList.remove("is-error");
  loaderWrap.style.display = "flex";
  if (!loaderWrap.contains(loaderEl)) loaderWrap.prepend(loaderEl);
  loaderStatus.style.display = "block";
}

function hideLoader() {
  loaderWrap.style.display = "none";
}

function showError(message) {
  loaderWrap.classList.add("is-error");
  loaderWrap.style.display = "flex";
  loaderEl.remove();
  loaderStatus.style.display = "none";
  const msg = document.createElement("p");
  msg.className = "loader-error";
  msg.textContent = message;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "loader-retry";
  retry.textContent = "Reintentar";
  retry.addEventListener("click", () => window.location.reload());
  loaderWrap.replaceChildren(msg, retry);
}

const iconBack10 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7l-5 5 5 5"/><path d="M18 7l-5 5 5 5"/></svg>';
const iconBack1 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7l-5 5 5 5"/></svg>';
const iconNext1 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7l5 5-5 5"/></svg>';
const iconNext10 =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7l5 5-5 5"/><path d="M13 7l5 5-5 5"/></svg>';

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
  btn.style.boxShadow = "0 0 18px rgba(100, 227, 255, 0.35)";
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

const btnBack = crearBotonAccion(
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 7l-5 5 5 5"/></svg>',
  "Regresar"
);
btnBack.onclick = () => postEmbedAction("alamos-embed-back");
const btnHome = crearBotonAccion(
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  "Home"
);
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

controles.append(btnMenos10, btnMenos1, indicadorPagina, btnMas1, btnMas10);
document.body.appendChild(controles);
controles.style.display = "none";

container.style.backfaceVisibility = "hidden";
if (!isTouchDevice()) {
  zoomWrap.style.willChange = "transform";
  zoomWrap.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      setZoom(zoomScale * (e.deltaY < 0 ? 1.08 : 0.92), e.clientX, e.clientY);
    },
    { passive: false }
  );
}

function canvasToImageUrl(canvas) {
  if (!isPhone()) {
    return canvas.toDataURL("image/jpeg", getJpegQuality());
  }
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(canvas.toDataURL("image/png"));
          return;
        }
        const url = URL.createObjectURL(blob);
        trackBlobUrl(url);
        resolve(url);
      },
      "image/png",
      1
    );
  });
}

async function renderPage(pageNum, renderScale) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: renderScale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  if (!pageRenderWidth) {
    pageRenderWidth = canvas.width;
    pageRenderHeight = canvas.height;
  }
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  await page.render({
    canvasContext: ctx,
    viewport,
    intent: isPhone() ? "print" : "display",
  }).promise;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return canvasToImageUrl(canvas);
}

function appendBlankPageIfOdd(list) {
  if (totalPaginas % 2 !== 0) {
    list.push(getFullPagePlaceholder());
  }
  return list;
}

/** PageFlip guarda la imagen al crear cada página; hay que actualizar page.image o updateFromImages. */
function setPageImageInFlipbook(imageIndex, dataUrl) {
  if (imageIndex < 0 || imageIndex >= images.length) return false;
  images[imageIndex] = dataUrl;
  if (!pageFlipInstance?.getPage) return false;

  try {
    const page = pageFlipInstance.getPage(imageIndex);
    if (!page?.image) return false;
    page.isLoad = false;
    page.image.onload = () => {
      page.isLoad = true;
      if (typeof pageFlipInstance.update === "function") {
        pageFlipInstance.update();
      }
    };
    page.image.src = dataUrl;
    if (typeof page.load === "function") page.load();
    return true;
  } catch {
    return false;
  }
}

function safeUpdateFlipbookFromImages() {
  if (!pageFlipInstance?.updateFromImages) return;
  const now = Date.now();
  if (now - lastFlipbookUpdateAt < 280) return;
  lastFlipbookUpdateAt = now;

  const idx = pageFlipInstance.getCurrentPageIndex?.() ?? 0;
  pageFlipInstance.updateFromImages(images.slice());
  if (typeof pageFlipInstance.turnToPage === "function") {
    pageFlipInstance.turnToPage(idx);
  } else if (typeof pageFlipInstance.flip === "function") {
    pageFlipInstance.flip(idx);
  }
}

async function ensurePdfPageRendered(pageNum, renderScale = currentRenderScale) {
  if (pageNum < 1 || pageNum > totalPaginas) return null;
  if (pageCache.has(pageNum)) return pageCache.get(pageNum);
  if (renderInFlight.has(pageNum)) {
    while (renderInFlight.has(pageNum)) {
      await yieldToMain();
    }
    return pageCache.get(pageNum) || null;
  }

  renderInFlight.add(pageNum);
  try {
    const dataUrl = await renderPage(pageNum, renderScale);
    pageCache.set(pageNum, dataUrl);
    const imageIndex = pageNum - 1;
    if (!setPageImageInFlipbook(imageIndex, dataUrl)) {
      safeUpdateFlipbookFromImages();
    }
    return dataUrl;
  } catch (err) {
    console.error(`Error página ${pageNum}:`, err);
    return null;
  } finally {
    renderInFlight.delete(pageNum);
  }
}

async function prefetchAroundFlipIndex(imageIndex) {
  if (!pdfDoc || isRerendering) return;
  const scale = currentRenderScale;
  const tasks = [];
  for (let d = -PREFETCH_NEIGHBORS; d <= PREFETCH_NEIGHBORS; d++) {
    const imageIdx = imageIndex + d;
    if (imageIdx < 0 || imageIdx >= totalPaginas) continue;
    const pageNum = imageIdx + 1;
    if (!pageCache.has(pageNum) && !renderInFlight.has(pageNum)) {
      tasks.push(ensurePdfPageRendered(pageNum, scale));
    }
  }
  for (const t of tasks) {
    await t;
    await yieldToMain();
  }
}

async function renderAllPages(renderScale, { from = 1, to = totalPaginas, onProgress } = {}) {
  for (let i = from; i <= to; i++) {
    const dataUrl = await renderPage(i, renderScale);
    pageCache.set(i, dataUrl);
    images[i - 1] = dataUrl;
    onProgress?.(i, to);
    await yieldToMain();
  }
  if (to === totalPaginas) {
    images = images.slice(0, totalPaginas);
    appendBlankPageIfOdd(images);
    currentRenderScale = renderScale;
  }
}

function destroyFlipbook() {
  if (pageFlipInstance?.destroy) {
    try {
      pageFlipInstance.destroy();
    } catch {
      /* ignore */
    }
  }
  container.innerHTML = "";
  pageFlipInstance = null;
  revokeBlobUrls();
}

async function handleViewportResize() {
  if (!pdfDoc || isRerendering || isTouchDevice()) return;
  updateBookOverflowMode();
  const { bookWidth } = computeBookDimensions();
  if (Math.abs(bookWidth - lastBookWidth) < 24) return;
  lastBookWidth = bookWidth;
  const scale = computeRenderScale(bookWidth, Math.max(1, zoomScale));
  if (scale <= currentRenderScale * 1.05 && pageFlipInstance) return;

  isRerendering = true;
  const idx = pageFlipInstance?.getCurrentPageIndex?.() ?? 0;
  try {
    pageCache.clear();
    revokeBlobUrls();
    images = new Array(totalPaginas);
    showLoader();
    await renderAllPages(scale, {
      onProgress: (cur, tot) => setLoaderMessage(`Página ${cur} de ${tot}…`),
    });
    destroyFlipbook();
    iniciarFlipbook(idx);
  } finally {
    isRerendering = false;
  }
}

function scheduleViewportResize() {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(handleViewportResize, 600);
}

async function cargarPDF() {
  setLoaderMessage("Descargando revista…");
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  totalPaginas = pdfDoc.numPages;

  const probePage = await pdfDoc.getPage(1);
  const probeViewport = probePage.getViewport({ scale: 1 });
  probePageWidth = probeViewport.width;
  probePageHeight = probeViewport.height;
  const ratio = probeViewport.width / probeViewport.height;
  pageBaseHeight = 980;
  pageBaseWidth = Math.max(620, Math.round(pageBaseHeight * ratio));

  const { bookWidth } = computeBookDimensions();
  lastBookWidth = bookWidth;
  currentRenderScale = computeRenderScale(bookWidth, 1);

  images = [];
  pageCache.clear();
  fullPagePlaceholderUrl = "";
  revokeBlobUrls();

  if (isPhone()) {
    container.classList.add("book--phone-sharp");
    for (let i = 1; i <= totalPaginas; i++) {
      setLoaderMessage(`Generando página ${i} de ${totalPaginas}…`);
      const dataUrl = await renderPage(i, currentRenderScale);
      pageCache.set(i, dataUrl);
      images.push(dataUrl);
      if (i % 2 === 0) await yieldToMain();
    }
    appendBlankPageIfOdd(images);
    iniciarFlipbook(0);
    return;
  }

  const firstEnd = Math.min(INITIAL_PAGES, totalPaginas);
  for (let i = 1; i <= firstEnd; i++) {
    setLoaderMessage(`Página ${i} de ${totalPaginas}…`);
    const dataUrl = await renderPage(i, currentRenderScale);
    pageCache.set(i, dataUrl);
    images.push(dataUrl);
    await yieldToMain();
  }
  const placeholder = getFullPagePlaceholder();
  for (let i = firstEnd + 1; i <= totalPaginas; i++) {
    images.push(placeholder);
  }
  appendBlankPageIfOdd(images);

  iniciarFlipbook(0);
  void prefetchAroundFlipIndex(0);
  void renderBookInBackground(firstEnd + 1);
}

async function renderBookInBackground(fromPage) {
  const token = ++backgroundRenderToken;
  for (let i = fromPage; i <= totalPaginas; i++) {
    if (token !== backgroundRenderToken || isRerendering) return;
    if (pageCache.has(i)) continue;
    try {
      const dataUrl = await renderPage(i, currentRenderScale);
      pageCache.set(i, dataUrl);
      const ok = setPageImageInFlipbook(i - 1, dataUrl);
      if (!ok || i % UPDATE_FLIPBOOK_EVERY === 0 || i === totalPaginas) {
        safeUpdateFlipbookFromImages();
      }
    } catch (err) {
      console.error(`Error página ${i}:`, err);
    }
    await new Promise((r) => setTimeout(r, BG_RENDER_DELAY_MS));
  }
  safeUpdateFlipbookFromImages();
}

function bindControlsOnce() {
  if (controlsBound) return;
  controlsBound = true;

  btnMenos1.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    nativeFlipPrev();
  });
  btnMas1.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    nativeFlipNext();
  });
  btnMas10.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    nativeFlipBy(10);
  });
  btnMenos10.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    nativeFlipBy(-10);
  });
}

async function preparePageForFlip(targetIndex) {
  if (targetIndex < 0 || targetIndex >= totalPaginas) return;
  if (!isPlaceholderAt(targetIndex)) return;
  await ensurePdfPageRendered(targetIndex + 1, currentRenderScale);
}

function nativeFlipPrev() {
  if (!pageFlipInstance) return;
  const idx = pageFlipInstance.getCurrentPageIndex?.() ?? 0;
  const target = idx - 1;
  void preparePageForFlip(target).then(() => {
    if (typeof pageFlipInstance.flipPrev === "function") {
      pageFlipInstance.flipPrev();
      return;
    }
    if (target >= 0) pageFlipInstance.flip?.(target);
  });
}

function nativeFlipNext() {
  if (!pageFlipInstance) return;
  const idx = pageFlipInstance.getCurrentPageIndex?.() ?? 0;
  const target = idx + 1;
  void preparePageForFlip(target).then(() => {
    if (typeof pageFlipInstance.flipNext === "function") {
      pageFlipInstance.flipNext();
      return;
    }
    if (target < images.length) pageFlipInstance.flip?.(target);
  });
}

function nativeFlipBy(delta) {
  if (!pageFlipInstance) return;
  const idx = pageFlipInstance.getCurrentPageIndex?.() ?? 0;
  const target = clamp(idx + delta, 0, images.length - 1);
  pageFlipInstance.flip?.(target) || pageFlipInstance.turnToPage?.(target);
}

function iniciarFlipbook(startIndex = 0) {
  const { bookWidth, bookHeight } = computeBookDimensions();
  lastBookWidth = bookWidth;
  const portrait = useSinglePageMode();
  const touch = isTouchDevice();
  const phoneBoost = isPhone() ? PAGE_FLIP_PHONE_BOOST : 1;
  const flipW = Math.floor(bookWidth * phoneBoost);
  const flipH = Math.floor(bookHeight * phoneBoost);

  container.style.width = "";
  container.style.height = "";
  container.style.transform = "";
  container.style.transformOrigin = "";
  container.style.position = "";
  container.style.left = "";
  container.style.top = "";
  container.style.margin = "";
  container.style.maxWidth = "";

  let phoneStage = document.getElementById("flipbook-phone-stage");
  let phoneInner = document.getElementById("flipbook-phone-inner");

  if (phoneBoost > 1) {
    zoomWrap.classList.add("flipbook-zoom-wrap--phone");
    zoomWrap.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:52px 10px 80px;box-sizing:border-box;touch-action:manipulation;z-index:1;";
    if (!phoneStage) {
      phoneStage = document.createElement("div");
      phoneStage.id = "flipbook-phone-stage";
      phoneInner = document.createElement("div");
      phoneInner.id = "flipbook-phone-inner";
      zoomWrap.appendChild(phoneStage);
      phoneStage.appendChild(phoneInner);
      phoneInner.appendChild(container);
    }
    phoneStage.style.width = `${bookWidth}px`;
    phoneStage.style.height = `${bookHeight}px`;
    phoneInner.style.width = `${flipW}px`;
    phoneInner.style.height = `${flipH}px`;
    phoneInner.style.transform = `scale(${1 / phoneBoost})`;
    container.style.width = `${flipW}px`;
    container.style.height = `${flipH}px`;
    container.style.maxWidth = "none";
    container.style.margin = "0";
  } else {
    zoomWrap.classList.remove("flipbook-zoom-wrap--phone");
    if (phoneStage) {
      zoomWrap.appendChild(container);
      phoneStage.remove();
    }
    zoomWrap.style.cssText =
      "width:100%;height:100%;display:grid;place-items:center;touch-action:manipulation;";
  }

  pageFlipInstance = new St.PageFlip(container, {
    width: flipW,
    height: flipH,
    size: "fixed",
    minWidth: flipW,
    maxWidth: flipW,
    minHeight: flipH,
    maxHeight: flipH,
    drawShadow: !touch,
    showCover: false,
    usePortrait: portrait,
    mobileScrollSupport: false,
    swipeDistance: 25,
    useMouseEvents: true,
    maxShadowOpacity: touch ? 0.2 : 0.45,
    flippingTime: touch ? 450 : 700,
    backgroundColor: "#ffffff",
  });

  pageFlipInstance.loadFromImages(images);
  const start = Math.max(0, Math.min(images.length - 1, startIndex));
  if (start > 0) {
    pageFlipInstance.turnToPage?.(start) || pageFlipInstance.flip?.(start);
  }

  flipPrev = nativeFlipPrev;
  flipNext = nativeFlipNext;
  avanzarPaginas = (n) => nativeFlipBy(n);
  retrocederPaginas = (n) => nativeFlipBy(-n);

  pageFlipInstance.on("flip", (e) => {
    const index = e.data;
    indicadorPagina.textContent = `${index + 1} / ${images.length}`;
    if (index < totalPaginas && isPlaceholderAt(index)) {
      void ensurePdfPageRendered(index + 1, currentRenderScale);
    }
    void prefetchAroundFlipIndex(index);
  });

  pageFlipInstance.on("changeState", (e) => {
    if (e.data !== "flipping") return;
    const idx = pageFlipInstance.getCurrentPageIndex?.() ?? 0;
    void prefetchAroundFlipIndex(idx + 1);
    void prefetchAroundFlipIndex(idx);
  });

  bindControlsOnce();
  indicadorPagina.textContent = `${start + 1} / ${images.length}`;

  requestAnimationFrame(() => {
    hideLoader();
    controles.style.display = "flex";
    acciones.style.display = "flex";
    updateBookOverflowMode();
  });
}

window.addEventListener("resize", scheduleViewportResize);
window.addEventListener("orientationchange", scheduleViewportResize);

showLoader();
cargarPDF().catch((error) => {
  console.error(error);
  showError(
    !navigator.onLine
      ? "No se pudo cargar la revista. Revisa tu conexión e inténtalo de nuevo."
      : "No se pudo abrir el PDF. Si el problema continúa, avisa a tu maestro."
  );
});
