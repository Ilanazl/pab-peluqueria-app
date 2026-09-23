// ============================================================
// DATA.JS - Datos centralizados de PAB Peluquería
// Solo cambia aquí y se actualiza en toda la app
// ============================================================

export const SERVICIOS = [
  { nombre: "Corte Caballero", emoji: "💈", precio: 12000 },
  { nombre: "Corte Dama",      emoji: "💇‍♀️", precio: 12000 },
  { nombre: "Corte Niños",     emoji: "👦",  precio: 10000 },
  { nombre: "Tinte",           emoji: "🎨",  precio: 12000 },
  { nombre: "Cepillado",       emoji: "💨",  precio: 25000 },
  { nombre: "Planchado",       emoji: "🔥",  precio: 25000 },
];

export const HORARIOS = [
  "7:00 AM",
  "08:00 AM", "09:00 AM",
  "10:00 AM", "11:00 AM",
  "12:00 AM", "13:00 PM",
  "14:00 PM", "15:00 PM",
  "16:00 PM", "17:00 PM",
  "18:00 PM", "19:00 PM",
  "20:00 PM",
];

// Cada corte necesita una imagen PNG con FONDO TRANSPARENTE,
// tomada de frente, para que se pueda superponer sobre la foto del cliente.
// Guarda estas imágenes en una carpeta /assets/cortes/
export const CORTES_OVERLAY = [
  { nombre: "Capas largas", imagen: "assets/cortes/capas-largas.png" },
  { nombre: "Mariposa", imagen: "assets/cortes/mariposa.png" },
  { nombre: "Wolf", imagen: "assets/cortes/wolf.png" },
  { nombre: "Bob recto", imagen: "assets/cortes/bob-recto.png" },
  { nombre: "Bob a la mandibula", imagen: "assets/cortes/bob-a-la-mandibula.png" },
  { nombre: "Pixie largo", imagen: "assets/cortes/pixie-largo.png" },
  { nombre: "Midi con capas internas", imagen: "assets/cortes/midi-capas-internas.png" },
  { nombre: "Flequillo cortina", imagen: "assets/cortes/flequillo-cortina.png" },
  { nombre: "Taper fade", imagen: "assets/cortes/taper-fade.png" },
  { nombre: "French crop", imagen: "assets/cortes/french-crop.png" },
  { nombre: "Textured quiff", imagen: "assets/cortes/textured-quiff.png" },
  { nombre: "Mullet moderno", imagen: "assets/cortes/mullet-moderno.png" },
  { nombre: "Clásico lateral", imagen: "assets/cortes/clasico-lateral.png" },
  { nombre: "Pompadour modesto", imagen: "assets/cortes/pompadour-modesto.png" },
  { nombre: "Quiff corto con textura", imagen: "assets/cortes/quiff-corto-textura.png" },
  { nombre: "Corto con textura mate", imagen: "assets/cortes/corto-textura-mate.png" },
];
