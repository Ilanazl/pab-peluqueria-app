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
  "12:00 PM", "13:00 PM",
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
  
];

// ============================================================
// DATOS DEL NEGOCIO - se muestran en la página de inicio
// ============================================================
export const NEGOCIO = {
  
  direccion: "Calle 30#14-43",
  
  ciudad: "Buga, Valle del Cauca",
  correo: "pabpeluqueria.contacto@gmail.com",
  horario: [
    { dias: "Lunes a sábado", horas: "7:00 a. m. – 8:00 p. m." },
    { dias: "Domingos y festivos", horas: "Cerrado" },
  ],
};

// Opiniones REALES de clientas (con su permiso). Mientras esta lista esté
// vacía, la sección de testimonios NO se muestra en la página.
// Ejemplo: { texto: "Me encantó el corte, súper rápido agendar", autor: "Laura M." }
export const TESTIMONIOS = [];
