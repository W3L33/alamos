pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const stage = document.getElementById('flip-stage');
const nextPageEl = document.getElementById('next-page');
const shadowEl = document.getElementById('sheet-shadow');
const sheetEl = document.getElementById('sheet');
const frontEl = sheetEl.querySelector('.front');
const backEl = sheetEl.querySelector('.back');
const SLICE_COUNT = 1;

const rutasPDF = ['../archivo.pdf', '/archivo.pdf', `${window.location.origin}/archivo.pdf`];

let pdfDoc = null;
let totalPaginas = 0;
let paginaActual = 1;
let escalaRender = 1.6;
let animando = false;

let dragActivo = false;
let dragDireccion = null;
let dragDestino = null;
let dragProgress = 0;
let startX = 0;
let dragLastX = 0;
let dragLastT = 0;
let dragVelocityX = 0;
let zoomScale = 1;
let zoomTarget = 1;
let zoomRaf = null;
let zoomFocusX = 0;
let zoomFocusY = 0;
let pinchActivo = false;
let pinchDistBase = 0;
let zoomBase = 1;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanciaEntreToques(t0, t1) {
  const dx = t1.clientX - t0.clientX;
  const dy = t1.clientY - t0.clientY;
  return Math.hypot(dx, dy);
}

function aplicarZoom(centerX, centerY) {
  const rect = stage.getBoundingClientRect();
  const ox = ((centerX - rect.left) / rect.width) * 100;
  const oy = ((centerY - rect.top) / rect.height) * 100;
  stage.style.transformOrigin = `${clamp(ox, 0, 100)}% ${clamp(oy, 0, 100)}%`;
  stage.style.transform = `translateZ(0) scale3d(${zoomScale}, ${zoomScale}, 1)`;
}

function setZoom(nextZoom, centerX, centerY) {
  zoomTarget = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
  zoomFocusX = centerX;
  zoomFocusY = centerY;
  if (zoomRaf) return;
  const tick = () => {
    const delta = zoomTarget - zoomScale;
    if (Math.abs(delta) < 0.0015) {
      zoomScale = zoomTarget;
      aplicarZoom(zoomFocusX, zoomFocusY);
      zoomRaf = null;
      return;
    }
    zoomScale += delta * 0.22;
    aplicarZoom(zoomFocusX, zoomFocusY);
    zoomRaf = requestAnimationFrame(tick);
  };
  zoomRaf = requestAnimationFrame(tick);
}

const pageCache = new Map();
const MAX_CACHE = 6;

const frontSlices = [];
const backSlices = [];

function getSliceBackgroundPos(i) {
  if (SLICE_COUNT <= 1) return '50% 0%';
  return `${(i / (SLICE_COUNT - 1)) * 100}% 0%`;
}

const estado = document.createElement('div');
estado.style.position = 'fixed';
estado.style.top = '10px';
estado.style.left = '50%';
estado.style.transform = 'translateX(-50%)';
estado.style.padding = '8px 12px';
estado.style.fontSize = '12px';
estado.style.color = '#fff';
estado.style.background = 'rgba(0,0,0,0.55)';
estado.style.border = '1px solid rgba(255,255,255,0.25)';
estado.style.borderRadius = '8px';
estado.style.zIndex = 10001;
estado.style.maxWidth = '92vw';
estado.style.textAlign = 'center';
estado.textContent = 'Cargando PDF...';
document.body.appendChild(estado);

const controles = document.createElement('div');
controles.style.position = 'fixed';
controles.style.bottom = '14px';
controles.style.left = '50%';
controles.style.transform = 'translateX(-50%)';
controles.style.display = 'flex';
controles.style.gap = '5px';
controles.style.zIndex = 1000;

function crearBoton(iconoSvg, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.innerHTML = iconoSvg;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.style.width = '27px';
  btn.style.height = '27px';
  btn.style.padding = '0';
  btn.style.cursor = 'pointer';
  btn.style.background = 'rgba(90, 90, 90, 0.35)';
  btn.style.backdropFilter = 'blur(8px)';
  btn.style.webkitBackdropFilter = 'blur(8px)';
  btn.style.border = '1px solid rgba(255,255,255,0.3)';
  btn.style.borderRadius = '999px';
  btn.style.color = '#fff';
  btn.style.opacity = '0.45';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.pointerEvents = 'auto';
  btn.onmouseenter = () => { btn.style.opacity = '0.85'; };
  btn.onmouseleave = () => { btn.style.opacity = '0.45'; };
  return btn;
}

const iconBack10 = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 7l-5 5 5 5"/><path d="M18 7l-5 5 5 5"/></svg>';
const iconBack1 = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7l-5 5 5 5"/></svg>';
const iconNext1 = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7l5 5-5 5"/></svg>';
const iconNext10 = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7l5 5-5 5"/><path d="M13 7l5 5-5 5"/></svg>';

const btnMenos10 = crearBoton(iconBack10, 'Retroceder 10 paginas');
const btnMenos1 = crearBoton(iconBack1, 'Pagina anterior');
const btnMas1 = crearBoton(iconNext1, 'Pagina siguiente');
const btnMas10 = crearBoton(iconNext10, 'Avanzar 10 paginas');

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
  btn.style.height = "28px";
  btn.style.width = "28px";
  btn.style.padding = "0";
  btn.style.cursor = "pointer";
  btn.style.background = "rgba(90, 90, 90, 0.35)";
  btn.style.backdropFilter = "blur(8px)";
  btn.style.webkitBackdropFilter = "blur(8px)";
  btn.style.border = "1px solid rgba(255,255,255,0.3)";
  btn.style.borderRadius = "999px";
  btn.style.color = "#fff";
  btn.style.fontSize = "0";
  btn.style.lineHeight = "0";
  btn.style.opacity = "0.78";
  btn.onmouseenter = () => { btn.style.opacity = "1"; };
  btn.onmouseleave = () => { btn.style.opacity = "0.78"; };
  return btn;
}

const acciones = document.createElement("div");
acciones.style.position = "fixed";
acciones.style.left = "50%";
acciones.style.top = "10px";
acciones.style.transform = "translateX(-50%)";
acciones.style.display = "flex";
acciones.style.gap = "6px";
acciones.style.zIndex = "10002";

const iconBack = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 7l-5 5 5 5"/></svg>';
const iconHome = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';

const btnBack = crearBotonAccion(iconBack, "Regresar");
btnBack.onclick = () => postEmbedAction("alamos-embed-back");
const btnHome = crearBotonAccion(iconHome, "Home");
btnHome.onclick = () => postEmbedAction("alamos-embed-home");
acciones.append(btnBack, btnHome);
document.body.appendChild(acciones);

const indicadorPagina = document.createElement('span');
indicadorPagina.style.padding = '4px 5px';
indicadorPagina.style.fontSize = 'clamp(0.65rem, 1.2vw, 0.75rem)';
indicadorPagina.style.color = '#fff';
indicadorPagina.style.fontWeight = '600';
indicadorPagina.style.background = 'rgba(90,90,90,0.35)';
indicadorPagina.style.backdropFilter = 'blur(6px)';
indicadorPagina.style.borderRadius = '6px';
indicadorPagina.style.display = 'flex';
indicadorPagina.style.alignItems = 'center';
indicadorPagina.style.justifyContent = 'center';
indicadorPagina.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
indicadorPagina.style.whiteSpace = 'nowrap';

controles.append(btnMenos10, btnMenos1, indicadorPagina, btnMas1, btnMas10);
document.body.appendChild(controles);

function actualizarIndicador() {
  indicadorPagina.textContent = `${paginaActual} / ${totalPaginas}`;
}

function recortarCache() {
  if (pageCache.size <= MAX_CACHE) return;
  const keys = Array.from(pageCache.keys());
  keys.sort((a, b) => Math.abs(a - paginaActual) - Math.abs(b - paginaActual));
  while (keys.length > MAX_CACHE) {
    pageCache.delete(keys.pop());
  }
}

async function cargarPDF() {
  let ultimoError = null;
  for (const ruta of rutasPDF) {
    try {
      pdfDoc = await pdfjsLib.getDocument({ url: ruta, rangeChunkSize: 262144 }).promise;
      break;
    } catch (err) {
      ultimoError = err;
    }
  }
  if (!pdfDoc) {
    for (const ruta of rutasPDF) {
      try {
        pdfDoc = await pdfjsLib.getDocument({ url: ruta, disableWorker: true, rangeChunkSize: 262144 }).promise;
        break;
      } catch (err) {
        ultimoError = err;
      }
    }
  }
  if (!pdfDoc) throw (ultimoError || new Error('No se pudo abrir archivo.pdf'));

  totalPaginas = pdfDoc.numPages;
  const escalaBase = Math.min(window.devicePixelRatio || 1, 2);
  escalaRender = window.innerWidth <= 768 ? Math.max(1.6, escalaBase * 1.2) : 1.8;
}

async function renderPaginaAImagen(num) {
  if (pageCache.has(num)) return pageCache.get(num);
  const page = await pdfDoc.getPage(num);
  const rect = stage.getBoundingClientRect();
  const viewportBase = page.getViewport({ scale: 1 });
  const fit = Math.min(rect.width / viewportBase.width, rect.height / viewportBase.height);
  const viewport = page.getViewport({ scale: Math.max(fit * escalaRender, fit) });
  const c = document.createElement('canvas');
  c.width = Math.floor(viewport.width);
  c.height = Math.floor(viewport.height);
  const rctx = c.getContext('2d', { alpha: false });
  await page.render({ canvasContext: rctx, viewport }).promise;
  const url = c.toDataURL('image/jpeg', 0.9);
  pageCache.set(num, url);
  recortarCache();
  return url;
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function aplicarMascaraCurva(progress, direction) {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.02) {
    const rect = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
    sheetEl.style.clipPath = rect;
    sheetEl.style.webkitClipPath = rect;
    return;
  }

  const slices = 12;
  const depth = 1.4 + Math.sin(p * Math.PI) * 6.2; // porcentaje de curvatura
  const pts = [];

  if (direction === 'izquierda') {
    pts.push('0% 0%');
    for (let i = 0; i <= slices; i += 1) {
      const y = (i / slices) * 100;
      const t = i / slices;
      const curve = 1 - Math.pow((t - 0.5) / 0.5, 2); // parabola con pico al centro
      const x = 100 - depth * Math.max(0, curve);
      pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
    }
    pts.push('0% 100%');
  } else {
    pts.push('100% 0%');
    for (let i = 0; i <= slices; i += 1) {
      const y = (i / slices) * 100;
      const t = i / slices;
      const curve = 1 - Math.pow((t - 0.5) / 0.5, 2);
      const x = depth * Math.max(0, curve);
      pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
    }
    pts.push('100% 100%');
  }

  const polygon = `polygon(${pts.join(', ')})`;
  sheetEl.style.clipPath = polygon;
  sheetEl.style.webkitClipPath = polygon;
}

function aplicarProgreso(progress, direction) {
  const p = Math.max(0, Math.min(1, progress));
  // Origen corregido para que el giro siga el sentido del gesto.
  const origin = direction === 'izquierda' ? 'left center' : 'right center';
  // Sentido corregido: swipe izquierda -> hoja gira hacia la izquierda.
  const ang = direction === 'izquierda' ? 180 * p : -180 * p;
  const arco = Math.sin(p * Math.PI);
  const dir = direction === 'izquierda' ? -1 : 1;
  const flex = dir * arco * 4.2;
  const comp = 1 - arco * 0.07;
  const shiftX = dir * arco * 12;
  const shiftY = -arco * 8;
  const pitch = (0.5 - p) * 10;

  sheetEl.style.transformOrigin = origin;
  sheetEl.style.transform =
    `translate3d(${shiftX}px, ${shiftY}px, 0) rotateX(${pitch}deg) rotateY(${ang}deg) skewY(${flex}deg) scaleX(${comp})`;
  aplicarMascaraCurva(p, direction);

  // Sombra real de la hoja en movimiento.
  const shadowDepth = 6 + 22 * arco;
  const shadowSpread = 2 + 10 * arco;
  const shadowAlpha = 0.1 + 0.2 * arco;
  sheetEl.style.filter =
    `drop-shadow(${dir * 2}px ${shadowSpread}px ${shadowDepth}px rgba(0,0,0,${shadowAlpha}))`;

  // Sin segmentacion visible para evitar efecto cortina/franjas.
  const allSlices = frontSlices.concat(backSlices);
  for (let i = 0; i < allSlices.length; i += 1) {
    allSlices[i].style.transform = 'translate3d(0, 0, 0) rotateY(0deg) scaleX(1)';
  }

  const shadowOpacity = Math.min(0.24, 0.06 + Math.sin(p * Math.PI) * 0.2);
  shadowEl.style.opacity = String(shadowOpacity);
  shadowEl.style.background = direction === 'izquierda'
    ? 'linear-gradient(to left, rgba(0,0,0,0.2), rgba(0,0,0,0) 42%)'
    : 'linear-gradient(to right, rgba(0,0,0,0.2), rgba(0,0,0,0) 42%)';
}

async function prepararCapas(targetPage) {
  const actualSrc = await renderPaginaAImagen(paginaActual);
  const nextSrc = await renderPaginaAImagen(targetPage);
  for (let i = 0; i < SLICE_COUNT; i += 1) {
    const pos = getSliceBackgroundPos(i);
    frontSlices[i].style.backgroundImage = `url("${actualSrc}")`;
    frontSlices[i].style.backgroundPosition = pos;
    backSlices[i].style.backgroundImage = `url("${actualSrc}")`;
    backSlices[i].style.backgroundPosition = pos;
  }
  nextPageEl.style.backgroundImage = `url("${nextSrc}")`;
}

async function renderEstadoBase() {
  const src = await renderPaginaAImagen(paginaActual);
  for (let i = 0; i < SLICE_COUNT; i += 1) {
    const pos = getSliceBackgroundPos(i);
    frontSlices[i].style.backgroundImage = `url("${src}")`;
    frontSlices[i].style.backgroundPosition = pos;
    backSlices[i].style.backgroundImage = `url("${src}")`;
    backSlices[i].style.backgroundPosition = pos;
    frontSlices[i].style.transform = 'translateZ(0) rotateY(0deg) scaleX(1)';
    backSlices[i].style.transform = 'translateZ(0) rotateY(0deg) scaleX(1)';
  }
  nextPageEl.style.backgroundImage = `url("${src}")`;
  sheetEl.style.transform = 'rotateY(0deg) skewY(0deg) scaleX(1)';
  sheetEl.style.transformOrigin = 'right center';
  const rect = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  sheetEl.style.clipPath = rect;
  sheetEl.style.webkitClipPath = rect;
  sheetEl.style.filter = 'none';
  shadowEl.style.opacity = '0';
  actualizarIndicador();
}

function resolverDestino(delta) {
  return Math.max(1, Math.min(totalPaginas, paginaActual + delta));
}

async function animarCambio(destino, startProgress, direction) {
  if (animando) return;
  animando = true;
  const dur = Math.max(180, 360 * (1 - startProgress));
  const t0 = performance.now();
  function tick(now) {
    const tr = Math.min(1, (now - t0) / dur);
    const p = startProgress + (1 - startProgress) * ease(tr);
    aplicarProgreso(p, direction);
    if (tr < 1) return requestAnimationFrame(tick);
    paginaActual = destino;
    renderEstadoBase().finally(() => {
      animando = false;
    });
  }
  requestAnimationFrame(tick);
}

async function animarVuelta(fromProgress, direction) {
  if (animando) return;
  animando = true;
  const dur = Math.max(140, 260 * Math.max(0.2, fromProgress));
  const t0 = performance.now();
  function tick(now) {
    const tr = Math.min(1, (now - t0) / dur);
    const p = fromProgress * (1 - ease(tr));
    aplicarProgreso(p, direction);
    if (tr < 1) return requestAnimationFrame(tick);
    renderEstadoBase().finally(() => {
      animando = false;
    });
  }
  requestAnimationFrame(tick);
}

function iniciarDrag(x) {
  dragActivo = true;
  dragProgress = 0;
  dragDireccion = null;
  dragDestino = null;
  startX = x;
  dragLastX = x;
  dragLastT = performance.now();
  dragVelocityX = 0;
}

async function moverDrag(x) {
  if (!dragActivo || animando) return;
  const diff = startX - x;
  const now = performance.now();
  const dt = Math.max(1, now - dragLastT);
  dragVelocityX = dragVelocityX * 0.75 + ((x - dragLastX) / dt) * 0.25;
  dragLastX = x;
  dragLastT = now;

  if (!dragDireccion && Math.abs(diff) > 12) {
    dragDireccion = diff > 0 ? 'izquierda' : 'derecha';
    dragDestino = resolverDestino(dragDireccion === 'izquierda' ? 1 : -1);
    if (dragDestino === paginaActual) {
      dragActivo = false;
      return;
    }
    await prepararCapas(dragDestino);
  }
  if (!dragDireccion) return;

  const ref = Math.max(1, stage.clientWidth * 0.8);
  dragProgress = Math.max(0, Math.min(1, Math.abs(diff) / ref));
  aplicarProgreso(dragProgress, dragDireccion);
}

function finalizarDrag(x) {
  if (!dragActivo || animando || !dragDireccion) return;
  const diff = startX - x;
  const absDiff = Math.abs(diff);
  const mismaDir = (diff > 0 && dragDireccion === 'izquierda') || (diff < 0 && dragDireccion === 'derecha');
  const velocidad = Math.abs(dragVelocityX);
  const impulso = (dragDireccion === 'izquierda' && dragVelocityX < 0) || (dragDireccion === 'derecha' && dragVelocityX > 0);
  const completar = mismaDir && (dragProgress > 0.42 || absDiff > stage.clientWidth * 0.28 || (impulso && velocidad > 0.28));
  dragActivo = false;
  if (completar) animarCambio(dragDestino, dragProgress, dragDireccion);
  else animarVuelta(dragProgress, dragDireccion);
}

async function cambiarPagina(delta) {
  const destino = resolverDestino(delta);
  if (destino === paginaActual || animando) return;
  const dir = delta > 0 ? 'izquierda' : 'derecha';
  await prepararCapas(destino);
  animarCambio(destino, 0, dir);
}

window.addEventListener('resize', () => {
  pageCache.clear();
  renderEstadoBase().catch(console.error);
});

stage.addEventListener('touchstart', (e) => {
  if (animando) return;
  if (e.touches.length === 2) {
    pinchActivo = true;
    dragActivo = false;
    pinchDistBase = distanciaEntreToques(e.touches[0], e.touches[1]);
    zoomBase = zoomScale;
    return;
  }
  iniciarDrag(e.touches[0].clientX);
});

stage.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist = distanciaEntreToques(e.touches[0], e.touches[1]);
    if (!pinchActivo) {
      pinchActivo = true;
      dragActivo = false;
      pinchDistBase = dist;
      zoomBase = zoomScale;
    }
    const ratio = pinchDistBase > 0 ? dist / pinchDistBase : 1;
    const nextZoom = clamp(zoomBase * ratio, ZOOM_MIN, ZOOM_MAX);
    const cx = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
    const cy = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
    setZoom(nextZoom, cx, cy);
    return;
  }
  e.preventDefault();
  moverDrag(e.touches[0].clientX).catch(console.error);
}, { passive: false });

stage.addEventListener('touchend', (e) => {
  if (pinchActivo) {
    if (e.touches.length < 2) pinchActivo = false;
    return;
  }
  finalizarDrag(e.changedTouches[0].clientX);
});
stage.addEventListener('touchcancel', () => {
  pinchActivo = false;
  dragActivo = false;
  renderEstadoBase().catch(console.error);
});

stage.style.willChange = 'transform';
stage.style.transition = 'none';
stage.style.backfaceVisibility = 'hidden';
stage.addEventListener('wheel', (e) => {
  // Soporte adicional para zoom con trackpad/mouse en dispositivos compatibles.
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.08 : 0.92;
  setZoom(zoomTarget * factor, e.clientX, e.clientY);
}, { passive: false });

function bindNavButton(btn, handler) {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler();
  });
  btn.addEventListener("touchend", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler();
  }, { passive: false });
}

bindNavButton(btnMenos1, () => { cambiarPagina(-1).catch(console.error); });
bindNavButton(btnMas1, () => { cambiarPagina(1).catch(console.error); });
bindNavButton(btnMenos10, () => { cambiarPagina(-10).catch(console.error); });
bindNavButton(btnMas10, () => { cambiarPagina(10).catch(console.error); });

async function iniciar() {
  frontEl.style.setProperty('--slice-count', String(SLICE_COUNT));
  backEl.style.setProperty('--slice-count', String(SLICE_COUNT));
  const frontInner = document.createElement('div');
  frontInner.className = 'face-inner';
  const backInner = document.createElement('div');
  backInner.className = 'face-inner';
  frontEl.appendChild(frontInner);
  backEl.appendChild(backInner);
  for (let i = 0; i < SLICE_COUNT; i += 1) {
    const fs = document.createElement('div');
    fs.className = 'slice';
    const bs = document.createElement('div');
    bs.className = 'slice';
    frontInner.appendChild(fs);
    backInner.appendChild(bs);
    frontSlices.push(fs);
    backSlices.push(bs);
  }

  estado.textContent = 'Abriendo PDF...';
  await cargarPDF();
  estado.textContent = 'Renderizando primera pagina...';
  await renderEstadoBase();
  estado.style.display = 'none';
  setTimeout(() => {
    renderPaginaAImagen(Math.min(totalPaginas, paginaActual + 1)).catch(() => {});
    renderPaginaAImagen(Math.max(1, paginaActual - 1)).catch(() => {});
  }, 0);
}

iniciar().catch((error) => {
  indicadorPagina.textContent = 'Error';
  const detalle = error && error.message ? error.message : String(error);
  estado.textContent = `Error al cargar PDF: ${detalle}`;
  console.error(error);
});
