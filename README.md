# 🏠 PAB Peluquería — Guía de Instalación Completa

## Lo que incluye este proyecto
- ✅ Página web completa con diseño cálido y profesional
- ✅ Registro e inicio de sesión con Firebase Auth
- ✅ Agendamiento de citas con calendario
- ✅ Panel de cliente: ver y cancelar citas
- ✅ Panel admin CRUD: crear, editar, eliminar citas y usuarios
- ✅ Integración con n8n para envío de correos automáticos

---

## PASO 1 — Instalar herramientas

1. Descarga e instala **VS Code**: https://code.visualstudio.com
2. Descarga e instala **Node.js**: https://nodejs.org (versión LTS)
3. Abre VS Code y abre la carpeta `pab-peluqueria`

---

## PASO 2 — Configurar Firebase

1. Ve a https://console.firebase.google.com
2. Haz clic en **"Crear proyecto"** → Nombre: `pab-peluqueria`
3. Desactiva Google Analytics (no es necesario) → Crear proyecto

### Activar Authentication:
- Ve a **Build → Authentication → Get Started**
- Haz clic en **Email/Password** → Habilitar → Guardar

### Crear base de datos Firestore:
- Ve a **Build → Firestore Database → Create Database**
- Selecciona **"Start in production mode"** → Elige región `us-central1` → Listo
- Ve a la pestaña **Rules** y reemplaza todo con esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    match /appointments/{apptId} {
      allow read, write: if request.auth != null;
    }
  }
}
```
- Haz clic en **Publish**

### Obtener credenciales:
- Ve a **Configuración del proyecto** (ícono ⚙️ arriba a la izquierda)
- Baja hasta **"Tus apps"** → Haz clic en **"</>"** (Web)
- Nombre de la app: `pab-web` → Registrar app
- Copia los datos de `firebaseConfig` que aparecen
- Pégalos en el archivo `firebase-config.js` reemplazando los valores de ejemplo

---

## PASO 3 — Configurar n8n para correos

### Opción A: n8n en la nube (más fácil)
1. Ve a https://n8n.io → Crea cuenta gratis
2. Crea un nuevo **Workflow**
3. Agrega nodo: **Webhook** (modo POST) → Copia la URL del webhook
4. Pega esa URL en `app.js` donde dice `N8N_WEBHOOK_URL`

### Flujo n8n para correos:
```
[Webhook] → [IF event == 'nueva_cita'] → [Gmail/SendGrid: correo al cliente]
                                        → [Gmail/SendGrid: correo al admin]
         → [IF event == 'cita_confirmada'] → [Gmail: correo de confirmación]
         → [IF event == 'nuevo_usuario'] → [Gmail: correo de bienvenida]
```

### Configurar Gmail en n8n:
- Nodo **Send Email** o **Gmail**
- Conecta tu cuenta Gmail (izplopz@gmail.com)
- Para el correo del cliente usa: `{{$json.userEmail}}`
- Para el correo del admin usa: `{{$json.adminEmail}}`

### Plantilla de correo nueva cita:
```
Asunto: ✂️ Nueva cita agendada — PAB Peluquería

Hola {{$json.userName}},

Tu cita ha sido agendada exitosamente:
• Servicio: {{$json.service}}
• Fecha: {{$json.date}}
• Hora: {{$json.time}}

Te esperamos en PAB Peluquería.
¡Gracias por tu preferencia!
```

---

## PASO 4 — Publicar en internet (gratis con Vercel)

1. Crea cuenta en https://vercel.com con tu correo
2. Instala Vercel CLI en VS Code terminal:
   ```
   npm install -g vercel
   ```
3. En la terminal de VS Code, navega a la carpeta del proyecto:
   ```
   cd pab-peluqueria
   vercel
   ```
4. Sigue las instrucciones → En 2 minutos tendrás una URL pública tipo:
   `https://pab-peluqueria.vercel.app`

---

## PASO 5 — Crear tu cuenta de admin

1. Abre tu página web
2. Haz clic en **Registrarse**
3. Regístrate con el correo `izplopz@gmail.com`
4. Firebase detectará que es el admin y te mostrará el panel de administración

---

## Estructura del proyecto

```
pab-peluqueria/
├── index.html          ← Toda la estructura de la página
├── styles.css          ← Diseño y estilos
├── app.js              ← Lógica de la app (auth, CRUD, n8n)
├── firebase-config.js  ← Configuración Firebase (editar con tus datos)
└── README.md           ← Esta guía
```

---

## ¿Necesitas ayuda?

Si algo no funciona, puedes preguntarle a Claude describiendo el error exacto que aparece en la consola del navegador (F12 → Console).
