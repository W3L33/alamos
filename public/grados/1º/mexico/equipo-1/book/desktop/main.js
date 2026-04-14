pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const container = document.getElementById("flipbook");
container.setAttribute("tabindex", "0");
container.style.outline = "none";
const url = '../archivo.pdf';

let pdfDoc = null;
let totalPaginas = 0;
let images = [];
let zoomScale = 1;
let zoomTarget = 1;
let zoomRaf = null;
let zoomFocusX = 0;
let zoomFocusY = 0;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyZoomAt(clientX, clientY) {
  const rect = container.getBoundingClientRect();
  const ox = ((clientX - rect.left) / rect.width) * 100;
  const oy = ((clientY - rect.top) / rect.height) * 100;
  container.style.transformOrigin = `${clamp(ox, 0, 100)}% ${clamp(oy, 0, 100)}%`;
  container.style.transform = `translateZ(0) scale3d(${zoomScale}, ${zoomScale}, 1)`;
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

container.style.willChange = "transform";
container.style.transition = "none";
container.style.backfaceVisibility = "hidden";
container.addEventListener("wheel", (e) => {
  // Permite zoom con mouse/trackpad directamente sobre el libro.
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.08 : 0.92;
  setZoom(zoomScale * factor, e.clientX, e.clientY);
}, { passive: false });

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

  const dpr = Math.min(window.devicePixelRatio || 1, 2.1);
  const renderFactor = totalPaginas > 50 ? 1.2 : totalPaginas > 30 ? 1.3 : 1.45;
  const minScale = totalPaginas > 50 ? 1.9 : totalPaginas > 30 ? 2.1 : 2.35;
  const escala = Math.max(minScale, dpr * renderFactor);

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
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.92));
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
    images.push(canvasFinal.toDataURL("image/jpeg", 0.92));
  }

  iniciarFlipbook();
}

// -------------------- Inicializar flipbook --------------------
function iniciarFlipbook() {
  const pageFlip = new St.PageFlip(container, {
    width: 700,
    height: 900,
    size: "stretch",
    minWidth: 400,
    maxWidth: 1000,
    minHeight: 300,
    maxHeight: 800,
    drawShadow: true,
    showCover: false,
    backgroundColor: "#ffffff"
  });

  pageFlip.loadFromImages(images);

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
}

// -------------------- Ejecutar --------------------
cargarPDF();


