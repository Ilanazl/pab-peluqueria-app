// ============================================================
// LANDING.JS - Interacciones de la página de inicio
// Lee los datos del negocio desde data.js (un solo lugar para cambiarlos)
// ============================================================

import { SERVICIOS, NEGOCIO, TESTIMONIOS } from "./data.js";

const landing = document.getElementById('page-landing');

// ------------------------------------------------------------
// 1. Llenar la página con los datos de data.js
// ------------------------------------------------------------

// Estadísticas del hero: se calculan solas, así nunca quedan desactualizadas
document.getElementById('stat-servicios').textContent = SERVICIOS.length;
const precioMinimo = Math.min(...SERVICIOS.map(s => s.precio));
document.getElementById('stat-precio').textContent = `$${precioMinimo.toLocaleString('es-CO')}`;

// Ubicación: si no hay dirección exacta, se usa solo la ciudad
const lugar = [NEGOCIO.direccion, NEGOCIO.ciudad].filter(Boolean).join(', ');
const lugarURL = encodeURIComponent(lugar); // convierte espacios y tildes a formato de URL
document.getElementById('negocio-direccion').textContent = lugar;
document.getElementById('negocio-ciudad').textContent = NEGOCIO.ciudad;
// Mapa de Google sin API key (modo "embed")
document.getElementById('negocio-mapa').src = `https://www.google.com/maps?q=${lugarURL}&output=embed`;
// Botón "Cómo llegar": en celular abre la app de Google Maps
document.getElementById('negocio-ruta').href = `https://www.google.com/maps/search/?api=1&query=${lugarURL}`;

// Horario
document.getElementById('negocio-horario').innerHTML = NEGOCIO.horario
  .map(h => `<li><span>${h.dias}</span><span>${h.horas}</span></li>`)
  .join('');

// Testimonios: solo se muestra la sección si hay opiniones reales
if (TESTIMONIOS.length > 0) {
  document.getElementById('testimonios-grid').innerHTML = TESTIMONIOS
    .map(t => `<blockquote class="testimonial reveal"><p>“${t.texto}”</p><cite>— ${t.autor}</cite></blockquote>`)
    .join('');
  document.getElementById('testimonios').hidden = false;
}

// ------------------------------------------------------------
// 2. Difuminar la foto del hero al bajar
// ------------------------------------------------------------
const heroMedia = document.getElementById('hero-media');
const heroContent = document.getElementById('hero-content');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let ticking = false; // evita recalcular más de una vez por cuadro de pantalla

function actualizarHero() {
  ticking = false;
  // Si estamos en login/dashboard/admin, no hay nada que animar
  if (!landing.classList.contains('active')) return;

  // progreso: 0 = arriba del todo, 1 = ya bajamos una pantalla completa
  const progreso = Math.min(window.scrollY / window.innerHeight, 1);

  heroMedia.style.opacity = 1 - progreso * 0.9;             // se desvanece
  heroMedia.style.filter = `blur(${progreso * 8}px)`;       // se desenfoca
  heroContent.style.opacity = 1 - progreso * 1.6;           // el texto se va más rápido
  heroContent.style.transform = `translateY(${progreso * 60}px)`;
}

if (!reduceMotion) {
  window.addEventListener('scroll', () => {
    // requestAnimationFrame = "hazlo justo antes del próximo dibujo de la pantalla"
    if (!ticking) {
      requestAnimationFrame(actualizarHero);
      ticking = true;
    }
  }, { passive: true });
}

// ------------------------------------------------------------
// 3. Hacer aparecer los elementos cuando llegan a la pantalla
// ------------------------------------------------------------
// IntersectionObserver es un "vigilante" que avisa cuando algo entra en pantalla
const vigilante = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => {
    if (entrada.isIntersecting) {
      entrada.target.classList.add('is-visible');
      vigilante.unobserve(entrada.target); // solo se anima una vez
    }
  });
}, { threshold: 0.15 });

function vigilar(elementos) {
  elementos.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 0.1}s`; // aparecen una tras otra
    vigilante.observe(el);
  });
}

vigilar(document.querySelectorAll('#page-landing .reveal'));

// Las tarjetas de servicios las crea app.js cuando carga la página (DOMContentLoaded).
// Este listener se registró DESPUÉS, así que corre cuando las tarjetas ya existen.
document.addEventListener('DOMContentLoaded', () => {
  const tarjetas = document.querySelectorAll('#services-grid .service-card');
  tarjetas.forEach((tarjeta) => {
    tarjeta.classList.add('reveal');
    // Toda la tarjeta lleva a registrarse para agendar
    tarjeta.insertAdjacentHTML('beforeend', '<span class="service-book">Reservar →</span>');
    tarjeta.addEventListener('click', () => window.showPage('page-register'));
  });
  vigilar(tarjetas);
});

// ------------------------------------------------------------
// 4. Botón flotante de contacto
// ------------------------------------------------------------
const contacto = document.getElementById('contact');
const botonContacto = document.getElementById('contact-btn');
const botonCopiar = document.getElementById('contact-copy');
const textoCopiar = `${NEGOCIO.correo} <small>(copiar)</small>`;

// mailto abre la app de correo con el asunto ya escrito
const asunto = encodeURIComponent('Consulta desde la página web');
const cuerpo = encodeURIComponent('Hola PAB, quisiera preguntar sobre: ');
document.getElementById('contact-mail').href = `mailto:${NEGOCIO.correo}?subject=${asunto}&body=${cuerpo}`;
botonCopiar.innerHTML = textoCopiar;

function cerrarContacto() {
  contacto.classList.remove('is-open');
  botonContacto.setAttribute('aria-expanded', 'false');
}

botonContacto.addEventListener('click', (e) => {
  e.stopPropagation(); // que este clic no lo atrape el "clic afuera" de abajo
  const abierto = contacto.classList.toggle('is-open');
  contacto.classList.add('is-seen'); // apaga el pulso
  botonContacto.setAttribute('aria-expanded', String(abierto));
});

// Cerrar al hacer clic afuera o con la tecla Escape
document.addEventListener('click', (e) => {
  if (!contacto.contains(e.target)) cerrarContacto();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarContacto();
});

// Copiar el correo (útil si el celular no tiene app de correo configurada)
botonCopiar.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(NEGOCIO.correo);
    botonCopiar.textContent = '✅ ¡Correo copiado!';
  } catch {
    botonCopiar.textContent = NEGOCIO.correo;
  }
  setTimeout(() => { botonCopiar.innerHTML = textoCopiar; }, 2000);
});
