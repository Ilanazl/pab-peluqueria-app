// ============================================================
// CANVAS SIMULATOR - Prueba de corte sin datos biométricos
// La foto nunca sale del navegador: no hay fetch(), no hay upload.
// ============================================================

import { CORTES_OVERLAY } from "./data.js";

const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');

let baseImage = null;
let overlayImage = null;
let overlayX = canvas.width / 2;
let overlayY = canvas.height / 2;
let overlayScale = 1;
let overlayOpacity = 1;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;

// ------------------------------------------------------------
// 1. Cargar la foto del cliente
// ------------------------------------------------------------
document.getElementById('sim-photo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      baseImage = img;
      drawCanvas();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// ------------------------------------------------------------
// 2. Calcular el recorte "cover" — evita que la foto se deforme
// ------------------------------------------------------------
function getCoverRect(img, targetW, targetH) {
  const imgRatio = img.width / img.height;
  const targetRatio = targetW / targetH;
  let sx, sy, sw, sh;

  if (imgRatio > targetRatio) {
    // La foto es más "ancha" que el canvas -> recortamos los lados
    sh = img.height;
    sw = sh * targetRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // La foto es más "alta" que el canvas -> recortamos arriba/abajo
    sw = img.width;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

// ------------------------------------------------------------
// 3. Cortes disponibles
// ------------------------------------------------------------
function poblarCortesOverlay() {
  const container = document.getElementById('sim-cortes-list');
  container.innerHTML = CORTES_OVERLAY.map(c => `
    <img src="${c.imagen}" alt="${c.nombre}" class="corte-thumb"
         onclick="seleccionarCorte('${c.imagen}', this)" />
  `).join('');
}

window.seleccionarCorte = function(imagenSrc, thumbEl) {
  // Marcar visualmente cuál está seleccionado
  document.querySelectorAll('.corte-thumb').forEach(el => el.classList.remove('selected'));
  if (thumbEl) thumbEl.classList.add('selected');

  const img = new Image();
  img.onload = () => {
    overlayImage = img;
    overlayX = canvas.width / 2;
    overlayY = canvas.height / 2;
    drawCanvas();
  };
  img.src = imagenSrc;
};

// ------------------------------------------------------------
// 4. Dibujar el canvas
// ------------------------------------------------------------
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (baseImage) {
    // Usamos "cover" en vez de estirar la imagen a la fuerza
    const { sx, sy, sw, sh } = getCoverRect(baseImage, canvas.width, canvas.height);
    ctx.drawImage(baseImage, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  if (overlayImage) {
    const w = overlayImage.width * overlayScale;
    const h = overlayImage.height * overlayScale;
    ctx.globalAlpha = overlayOpacity;
    ctx.drawImage(overlayImage, overlayX - w / 2, overlayY - h / 2, w, h);
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------
// 5. Arrastrar — funciona igual para mouse y para dedo
// ------------------------------------------------------------
function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  // Si el evento viene de touch, usamos el primer dedo (touches[0])
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function startDrag(e) {
  if (!overlayImage) return;
  isDragging = true;
  const pos = getPointerPos(e);
  dragStartX = pos.x;
  dragStartY = pos.y;
}

function moveDrag(e) {
  if (!isDragging) return;
  // Sin esto, el celular haría scroll de la página mientras arrastras el corte
  if (e.cancelable) e.preventDefault();

  const pos = getPointerPos(e);
  overlayX += pos.x - dragStartX;
  overlayY += pos.y - dragStartY;
  dragStartX = pos.x;
  dragStartY = pos.y;
  drawCanvas();
}

function endDrag() {
  isDragging = false;
}

// Mouse (computador)
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', moveDrag);
canvas.addEventListener('mouseup', endDrag);
canvas.addEventListener('mouseleave', endDrag);

// Touch (celular) — passive:false en touchmove porque necesitamos preventDefault
canvas.addEventListener('touchstart', startDrag, { passive: true });
canvas.addEventListener('touchmove', moveDrag, { passive: false });
canvas.addEventListener('touchend', endDrag);

// ------------------------------------------------------------
// 6. Sliders
// ------------------------------------------------------------
document.getElementById('sim-scale').addEventListener('input', (e) => {
  overlayScale = parseFloat(e.target.value);
  drawCanvas();
});

document.getElementById('sim-opacity').addEventListener('input', (e) => {
  overlayOpacity = parseFloat(e.target.value);
  drawCanvas();
});

// ------------------------------------------------------------
// 7. Reiniciar y descargar
// ------------------------------------------------------------
window.resetSimulator = function() {
  baseImage = null;
  overlayImage = null;
  document.getElementById('sim-photo-input').value = '';
  document.querySelectorAll('.corte-thumb').forEach(el => el.classList.remove('selected'));
  drawCanvas();
};

window.downloadSimulatorResult = function() {
  const link = document.createElement('a');
  link.download = 'mi-corte-pab-peluqueria.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};

poblarCortesOverlay();